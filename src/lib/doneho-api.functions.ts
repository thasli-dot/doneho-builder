import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Real DoneHo backend (FastAPI on Render). All calls proxy through
// server functions so the base URL and any future auth headers can be
// swapped without touching the client.
const BASE_URL = "https://doneho-api.onrender.com";

async function callBackend<T>(path: string, init: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`DoneHo backend ${path} failed: ${res.status} ${text.slice(0, 200)}`);
	}
	return (await res.json()) as T;
}

// ---------- /session/start ----------
export const startSession = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z.object({ name: z.string(), profession: z.string() }).parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<{ session_id: string }>("/session/start", {
			method: "POST",
			body: JSON.stringify(data),
		});
	});

// ---------- /goals ----------
const taskSchema = z.object({ title: z.string(), is_flexible: z.boolean() });
const goalSchema = z.object({
	category: z.string(),
	traffic: z.number(),
	volatility: z.number(),
	tasks: z.array(taskSchema),
});

export const submitGoals = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z.object({ session_id: z.string(), goals: z.array(goalSchema) }).parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<{
			pending_clarifications: { task_id: string; task_title: string; question: string }[];
			blueprint: any;
			goals: any;
		}>("/goals", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /clarify ----------
export const submitClarifications = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z.object({ session_id: z.string(), answers: z.record(z.string(), z.string()) }).parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<{ blueprint: any }>("/clarify", {
			method: "POST",
			body: JSON.stringify(data),
		});
	});

// ---------- /pass2 ----------
export const submitPass2 = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z
			.object({
				session_id: z.string(),
				caregiving_hours: z.number(),
				planned_event_hours: z.number(),
				other_time_constraint_hours: z.number(),
				sleep_hours_override: z.number().optional(),
				commute_hours_override: z.number().optional(),
				work_hours_override: z.number().optional(),
			})
			.parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<any>("/pass2", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /commit ----------
export const commitBlueprint = createServerFn({ method: "POST" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<any>("/commit", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /state ----------
export const getState = createServerFn({ method: "GET" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<any>(`/state?session_id=${encodeURIComponent(data.session_id)}`, {
			method: "GET",
		});
	});

// ---------- /disruption ----------
export const reportDisruption = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z
			.object({
				session_id: z.string(),
				description: z.string(),
				direction: z.enum(["loss", "gain"]).optional(),
			})
			.parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<any>("/disruption", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /disruption/approve ----------
export const approveDisruption = createServerFn({ method: "POST" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<any>("/disruption/approve", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /day-output/checklist ----------
export const getDayOutputChecklist = createServerFn({ method: "GET" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<{
			checklist: {
				index: number;
				title: string;
				goal_title: string;
				task_title: string;
				expected_hours: number;
				ticked: boolean;
			}[];
		}>(`/day-output/checklist?session_id=${encodeURIComponent(data.session_id)}`, { method: "GET" });
	});

// ---------- /day-output ----------
export const submitDayOutput = createServerFn({ method: "POST" })
	.inputValidator((data) =>
		z
			.object({
				session_id: z.string(),
				day_label: z.string(),
				unticked_indices: z.array(z.number()),
			})
			.parse(data)
	)
	.handler(async ({ data }) => {
		return callBackend<any>("/day-output", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /life-happened ----------
export const triggerLifeHappened = createServerFn({ method: "POST" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<any>("/life-happened", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /nudge/regenerate ----------
export const regenerateNudges = createServerFn({ method: "POST" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<any>("/nudge/regenerate", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /aether-chat ----------
export const chatWithAetherBackend = createServerFn({ method: "POST" })
	.inputValidator((data) => z.object({ session_id: z.string(), message: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<{ reply: string }>("/aether-chat", { method: "POST", body: JSON.stringify(data) });
	});

// ---------- /aether-tip ----------
export const getAetherTip = createServerFn({ method: "GET" })
	.inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
	.handler(async ({ data }) => {
		return callBackend<{ tip: string; used_location: boolean }>(
			`/aether-tip?session_id=${encodeURIComponent(data.session_id)}`,
			{ method: "GET" }
		);
	});
