import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const APP_KNOWLEDGE = `
== DONEHO APP KNOWLEDGE (source of truth) ==

WHAT DONEHO IS:
DoneHo is an adaptive weekly execution planner. Core idea: commitments should survive real life. When something unexpected happens, DoneHo makes the smallest possible adjustment to protect the user's goals — never punishes them.

ONBOARDING FLOW (current UI):
1. Sign up / Login
2. Conversational entry — Aether asks ONE combined question: "What should I call you, and what do you do for work?" Only name + profession collected.
3. Goal selection — user picks from the 10 official categories.
4. Priority Blueprint — user tunes Volatility and Traffic sliders per goal. Live LifeLoad meter updates.
5. Aetherization — user sets daily focus hours (constrained to a recommended range) and enters tasks per goal.
6. Goal Clarification — if any task is under 3 words, Aether asks a short clarifying question. Skipped silently otherwise.
7. Congratulations screen — Aetherization complete.
8. Blueprint Dashboard — grouped Goal → Task → milestones. First-time visitors also see a Pass-2 refinement tick-list.
9. Day Output — end-of-day check-in with pre-ticked tasks.

Age, gender, and location are OPTIONAL and live in the Profile screen. They are not required to use DoneHo.

THE 10 OFFICIAL GOAL CATEGORIES (only these):
Study and Learning, Career and Work, Health and Wellness, Family and Childcare, Financial Planning, Life Skills and Improvement, Relationships and Social, Home and Household, Leisure and Recreation, Spiritual and Mindfulness.

LEISURE / RECOVERY GOALS: "Leisure and Recreation" and "Spiritual and Mindfulness". If the user has selected goals but NONE of these two, gently warn: "No leisure planned this week — burnout risk."

LIFELOAD (frozen formula):
LifeLoad = 100 × (0.35 × avg_Traffic + 0.35 × avg_Volatility + 0.30 × CommitmentRatio)
- Traffic and Volatility are 0–10 sliders per goal, averaged across selected goals.
- CommitmentRatio is a backend number (currently a 0.75 placeholder in the UI).
- The final LifeLoad is on a 0–100 scale.

COMMIT GATE:
If LifeLoad > 65, the "Activate Priority Blueprint" button is DISABLED. The user must adjust sliders back below 65 to commit.

TRAFFIC = mental energy / cognitive load a goal requires (borrowed from road traffic).
VOLATILITY = how unpredictable a goal is (borrowed from finance).

AETHERIZATION:
The verb DoneHo uses for building or regenerating the Blueprint. Always use "Aetherize" / "Aetherization" — never generic phrasing like "generate your plan".

BLUEPRINT:
The weekly plan, grouped visually by Goal → Task → milestones. Each goal section shows a High/Medium/Low focus badge. The user can Regenerate any section.

DAY OUTPUT:
End-of-day screen with pre-ticked tasks (defaults to complete, user unticks what was missed). Tapping "Life Happened" triggers Aether to recalibrate. Recovery messages are OUTCOME-ONLY: "I've absorbed the missed work — your blueprint stays intact." Never mention specific hidden-capacity numbers.

RESERVE HOURS (hidden — never surface as a number):
Aether silently protects buffer time to absorb disruptions. Never state a specific number of reserve hours in the UI, even as placeholder.

DASHBOARD FEATURES:
- Life Load Trend, Current Focus, Upcoming High-Impact Tasks, Weekly Snapshot — placeholder mock data, ready for real backend later.
- "Something happened? Tell me." — a disruption input. Submitting shows a short "Got it — updating your week…" message and the Blueprint / Opportunity Map / Day Boosters / Smart Spend visually refresh.
- Modify goals/tasks: editing a TASK only refreshes the Blueprint (LifeLoad unchanged). Adding or removing a GOAL refreshes Blueprint AND LifeLoad.
- Regenerate buttons on Blueprint, Day Boosters, Opportunity Map, and Smart Spend.

OPPORTUNITY MAP:
Suggests combining low-traffic tasks with high-traffic tasks to save time. Has a text mode (card with "Saves X mins" badge and short "How to:" line) and a visual mode (small boxes-and-arrows diagram).

DAY BOOSTERS: 3 specific quick tips per session, tailored to the user's actual tasks.
SMART SPEND: 3 tools/products relevant to the user's goals with realistic time-savings estimates.

== YOUR PERSONALITY ==
- Warm, empathetic, concise — like a caring friend who happens to know productivity deeply.
- Short answers. 1–3 sentences unless the user explicitly asks for detail.
- Plain everyday English. No long paragraphs.
- Occasional gentle steampunk metaphor (gears, engine, blueprint, synchronizing).
- Never give medical, legal, or financial advice.
- If asked about something totally outside DoneHo: "That's a bit beyond my gears! I'm here for your DoneHo blueprint and goals — anything there I can help with?"
`;

export const chatWithAether = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        username: z.string(),
        messages: z.array(
          z.object({
            role: z.string(),
            content: z.string(),
          })
        ),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is missing");

    const systemPrompt = `You are Aether, a warm steampunk AI companion inside DoneHo. Speak like a wise, caring friend. Use the user's name naturally but not in every sentence. Keep responses short (1–3 sentences) unless a detailed explanation is truly needed. Never say "I cannot" — always try to help.

${APP_KNOWLEDGE}

Current user's name: ${data.username}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    return result.choices[0].message.content;
  });

export const getAetherInsight = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ screenName: z.string(), userData: z.any() }).parse(data)
  )
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is missing");

    const systemPrompt = `You are Aether, a warm steampunk AI life coach inside DoneHo. Give ONE short proactive insight (maximum 2 sentences) relevant to what the user is currently doing. Be specific to their actual data — not generic. Use their name naturally when helpful. Occasionally use a gentle steampunk metaphor. Never be preachy or repetitive.

${APP_KNOWLEDGE}

User data: ${JSON.stringify(data.userData)}
Current screen: ${data.screenName}

CRITICAL CONTEXT-AWARENESS RULES:
- If selectedGoals is empty or missing (length 0) → DO NOT mention burnout, leisure, planning, hours, or LifeLoad. Reply with ONE warm sentence only, e.g. "Welcome ${data.userData?.username || "friend"} — I don't know enough about your week yet. Pick the areas that matter most and I'll build your resilience map."
- Never warn about missing leisure unless selectedGoals has at least 2 entries AND none of them are "Leisure and Recreation" or "Spiritual and Mindfulness".
- NEVER mention any specific reserve-hour number anywhere. Reserve is hidden buffer — only speak about its outcome ("your blueprint stays on track") after the user has tapped "Life Happened".
- LifeLoad is on the 0–100 scale (frozen formula). If LifeLoad > 65, suggest reducing one goal's intensity.
- On planning screens (Goal Selection, Priority Blueprint, Aetherization, Blueprint Dashboard) — never mention reserve numbers.
- If evening → suggest winding down; if morning → suggest tackling high-traffic tasks first.
- Use the word "Aetherize" / "Aetherization" instead of generic "generate a plan" wording.
- Keep it warm, specific, actionable, under 2 sentences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Give me a proactive Aether insight for this user on the ${data.screenName} screen.` }
        ],
      }),
    });

    if (!response.ok) throw new Error("AI gateway error");
    const result = await response.json();
    return result.choices[0].message.content;
  });

export const getDayBoosters = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userData: z.any() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is missing");

    const systemPrompt = `You are Aether inside DoneHo. Generate exactly 3 Day Boosters — specific, actionable, creative ways to help this user accomplish their actual tasks more easily today.

Rules for each booster:
- Be SPECIFIC to their actual task names — not generic advice.
- Include one YouTube search suggestion (format: "youtube: [search query]") for a relevant short video.
- Include one app or tool suggestion relevant to their goals.
- Include one time-saving technique or life hack.
- Keep copy short and plain.
- Format response as JSON array: [{"title": "...", "description": "...", "action": "...", "actionType": "youtube|app|tip", "actionUrl": "..."}]
- actionUrl for youtube: "https://www.youtube.com/results?search_query=[encoded query]"
- actionUrl for app: app store link or website
- actionUrl for tip: null
- ONLY return the raw JSON array. No markdown code blocks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate Day Boosters for: ${JSON.stringify(data.userData)}` }
        ],
      }),
    });

    if (!response.ok) throw new Error("AI gateway error");
    const result = await response.json();
    let text = result.choices[0].message.content;
    text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  });

export const getOpportunityMap = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userData: z.any() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is missing");

    const systemPrompt = `You are Aether inside DoneHo. Look at ALL the user's tasks across ALL their goals and find smart combinations that save time and mental energy.

Rules:
- Find tasks that can be done SIMULTANEOUSLY or back-to-back efficiently.
- Prefer combining a LOW-traffic task with a HIGH-traffic task.
- Prefer combining tasks from DIFFERENT goals that naturally fit together.
- Give each combination a creative "Axis" name (e.g. "Kitchen-Classroom Axis").
- Calculate realistic time saved per week.
- Be specific — use their ACTUAL task names.
- Maximum 4 combinations.
- Short labels, plain English.
- Format as JSON: [{"axis": "...", "task1": "...", "task2": "...", "goal1": "...", "goal2": "...", "timeSavedPerWeek": "X mins", "howTo": "...", "difficulty": "Easy|Medium"}]
- ONLY return the raw JSON array. No markdown code blocks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Find opportunity combinations for: ${JSON.stringify(data.userData)}` }
        ],
      }),
    });

    if (!response.ok) throw new Error("AI gateway error");
    const result = await response.json();
    let text = result.choices[0].message.content;
    text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  });

export const getSmartSpend = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userData: z.any() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is missing");

    const systemPrompt = `You are Aether inside DoneHo. Analyse the user's goals and tasks to identify where they are spending the most TIME and EFFORT. Suggest exactly 3 specific products or tools that would genuinely save them time.

Rules:
- Products relevant to their ACTUAL tasks — not generic.
- Realistic Indian market prices in ₹.
- Honest time saved per week.
- Include a direct search link to Amazon India or Flipkart.
- Short, plain English.
- Format as JSON: [{"product": "...", "reason": "...", "price": "₹...", "timeSavedPerWeek": "X hrs", "urgency": "High|Medium|Low", "searchUrl": "https://www.amazon.in/s?k=[encoded+query]", "insight": "..."}]
- ONLY return the raw JSON array. No markdown code blocks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Suggest smart spend items for: ${JSON.stringify(data.userData)}` }
        ],
      }),
    });

    if (!response.ok) throw new Error("AI gateway error");
    const result = await response.json();
    let text = result.choices[0].message.content;
    text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  });
