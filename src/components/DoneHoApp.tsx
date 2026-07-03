import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAether, getAetherInsight, getDayBoosters, getOpportunityMap, getSmartSpend } from "@/lib/aether.functions";

// Screen-level safety net — if any screen throws, show a small retry card
// instead of bubbling to the root "This page didn't load" boundary.
class ScreenBoundary extends Component<{ onReset: () => void; children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("Screen render error:", err); }
  render() {
    if (this.state.err) {
      return (
        <div className="p-6 flex flex-col items-center justify-center min-h-full text-center">
          <div className="text-3xl">⚙️</div>
          <h3 className="font-serif-d text-[16px] font-bold text-[#2c1810] mt-2">Aether is recalibrating</h3>
          <p className="text-[11px] text-[#5a3a20] mt-1 max-w-[260px]">
            Something tripped a gear on this screen. Your progress is safe — tap below to keep going.
          </p>
          <button
            className="btn-copper mt-4 px-4 py-2 text-xs"
            onClick={() => { this.setState({ err: null }); this.props.onReset(); }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// ============ TYPES ============
type GoalKey = string;
interface GoalSliders { volatility: number; traffic: number; }
interface TaskItem { id: string; goal: string; name: string; minutes: number; done: boolean; }

// ============ CONSTANTS ============
// The 10 official goal categories from the frozen build brief
const DEFAULT_GOALS = [
  "Study and Learning",
  "Career and Work",
  "Health and Wellness",
  "Family and Childcare",
  "Financial Planning",
  "Life Skills and Improvement",
  "Relationships and Social",
  "Home and Household",
  "Leisure and Recreation",
  "Spiritual and Mindfulness",
];

const LEISURE_GOALS = new Set(["Leisure and Recreation", "Spiritual and Mindfulness"]);

const GOAL_DEFAULTS: Record<string, GoalSliders> = {
  "Study and Learning": { volatility: 4, traffic: 8 },
  "Career and Work": { volatility: 5, traffic: 8 },
  "Health and Wellness": { volatility: 3, traffic: 5 },
  "Family and Childcare": { volatility: 9, traffic: 7 },
  "Financial Planning": { volatility: 2, traffic: 7 },
  "Life Skills and Improvement": { volatility: 3, traffic: 5 },
  "Relationships and Social": { volatility: 5, traffic: 3 },
  "Home and Household": { volatility: 6, traffic: 3 },
  "Leisure and Recreation": { volatility: 1, traffic: 1 },
  "Spiritual and Mindfulness": { volatility: 1, traffic: 2 },
};

const GOAL_ICONS: Record<string, string> = {
  "Study and Learning": "📚",
  "Career and Work": "💼",
  "Health and Wellness": "🌿",
  "Family and Childcare": "👶",
  "Financial Planning": "💰",
  "Life Skills and Improvement": "⚙️",
  "Relationships and Social": "🫶",
  "Home and Household": "🏠",
  "Leisure and Recreation": "🎭",
  "Spiritual and Mindfulness": "🕯️",
};

// Placeholder milestone generator (mock — will be swapped for backend later).
// Keyword-based so cards feel specific to the task, not generic filler.
function mockMilestones(task: string): string[] {
  const raw = task.trim();
  if (!raw) return [];
  const t = raw.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("learn", "study", "course", "python", "coding", "language", "spanish", "french"))
    return [
      `Mon: 25-min intro session on ${raw}`,
      `Wed: hands-on exercise + short notes`,
      `Sun: 15-min recap and pick next micro-topic`,
    ];
  if (has("read", "book", "article"))
    return [
      `Split ${raw} into 3 sittings (~20 pages each)`,
      `Mid-week: capture 3 highlights + one question`,
      `Weekend: 10-min reflection, decide next read`,
    ];
  if (has("workout", "gym", "run", "cardio", "strength", "yoga", "stretch", "walk", "cycle", "swim"))
    return [
      `Mon / Wed / Fri: 30-min ${raw} block`,
      `Tue or Thu: light mobility + hydration check`,
      `Sun: 10-min review — reps, RPE, one tweak`,
    ];
  if (has("meditat", "mindful", "breath", "journal", "gratitude", "pray"))
    return [
      `Daily: 8-min ${raw} at wake or wind-down`,
      `Mid-week: 2-line reflection on what shifted`,
      `Sun: pick one intention for next week`,
    ];
  if (has("cook", "recipe", "meal", "diet", "grocer"))
    return [
      `Sun: plan 3 ${raw} + one grocery list`,
      `Tue: prep one base (grain / protein / veg)`,
      `Fri: try one new twist, note the winner`,
    ];
  if (has("save", "budget", "invest", "finance", "expense", "money"))
    return [
      `Mon: 15-min sweep of last week's spend`,
      `Wed: move fixed amount to ${raw} bucket`,
      `Sun: 10-min review, adjust next week's cap`,
    ];
  if (has("write", "blog", "essay", "draft", "portfolio"))
    return [
      `Mon: outline 3 bullets for ${raw}`,
      `Wed: 40-min focused draft block`,
      `Sat: edit pass + share with one person`,
    ];
  if (has("clean", "declutter", "organize", "laundry", "kitchen", "home"))
    return [
      `Split ${raw} into 3 zones over the week`,
      `Mid-week: 20-min reset on the busiest zone`,
      `Sun: quick sweep + restock any essentials`,
    ];
  if (has("call", "friend", "family", "date", "partner", "social"))
    return [
      `Pick 2 people to reach out to for ${raw}`,
      `Wed: 20-min call or coffee scheduled`,
      `Sun: send one thoughtful follow-up`,
    ];
  if (has("plan", "review", "goal", "roadmap", "strategy"))
    return [
      `Mon: 20-min scoping pass on ${raw}`,
      `Wed: refine top 3 priorities`,
      `Sun: retro — what moved, what to drop`,
    ];
  // Default — still task-specific, not generic filler.
  return [
    `Mon: 20-min kick-off block on ${raw}`,
    `Wed: focused mid-week session, 30 min`,
    `Sun: 10-min review + one small next step`,
  ];
}

function focusFor(sliders: GoalSliders | undefined) {
  const combined = (sliders?.traffic ?? 5) + (sliders?.volatility ?? 5);
  if (combined >= 14) return { label: "High focus", color: "#ec4899" };
  if (combined >= 8) return { label: "Medium focus", color: "#06b6d4" };
  return { label: "Low focus", color: "#d4843a" };
}

// ============ SHARED UI ATOMS ============
function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size, height: size,
          background: "radial-gradient(circle, #d4a843, #b87333 60%, #8a5424)",
          border: "2px solid #6b3f1a",
        }}
      >
        <span style={{ color: "#2d4a1e", fontWeight: 900, fontSize: size * 0.55 }}>✓</span>
      </div>
      <span className="font-serif-d font-bold text-[#2c1810]" style={{ fontSize: size * 0.6 }}>
        DoneHo
      </span>
    </div>
  );
}

function BigGear({ size = 80, spin = false, rev = false }: { size?: number; spin?: boolean; rev?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={spin ? (rev ? "gear-spin-rev" : "gear-spin") : ""}>
      <defs>
        <radialGradient id="cg" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#e8b85a" />
          <stop offset="60%" stopColor="#b87333" />
          <stop offset="100%" stopColor="#6b3f1a" />
        </radialGradient>
      </defs>
      <g fill="url(#cg)" stroke="#6b3f1a" strokeWidth="1.5">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const x = 50 + Math.cos(a) * 42;
          const y = 50 + Math.sin(a) * 42;
          return <rect key={i} x={x - 5} y={y - 5} width="10" height="10" transform={`rotate(${i * 30} ${x} ${y})`} />;
        })}
        <circle cx="50" cy="50" r="35" />
      </g>
      <circle cx="50" cy="50" r="12" fill="#2d4a1e" stroke="#6b3f1a" strokeWidth="1.5" />
      <text x="50" y="58" textAnchor="middle" fontSize="18" fill="#d4a843" fontWeight="900">✓</text>
    </svg>
  );
}

function Aether({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size, height: size,
        background: "radial-gradient(circle at 35% 35%, #d4a843, #b87333 70%, #6b3f1a)",
        border: "2px solid #6b3f1a",
      }}
    >
      <span style={{ fontSize: size * 0.55 }}>🦉</span>
      <span className="absolute -top-1 -right-1 text-[10px]">⚙️</span>
    </div>
  );
}

function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="w-full">
      {label && <div className="text-[11px] text-[#2c1810] mb-1 font-semibold">{label}</div>}
      <div className="h-2 w-full rounded-full bg-[#8a6f4a]/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #4a7c59, #6ba070)" }}
        />
      </div>
    </div>
  );
}

function AetherProactiveInsight({ screenName, userData, cache, setCache }: any) {
  const [insight, setInsight] = useState<string>(cache[screenName] || "");
  const [loading, setLoading] = useState(!cache[screenName]);
  const fetchInsight = useServerFn(getAetherInsight);

  const load = async (force = false) => {
    if (!force && cache[screenName]) {
      setInsight(cache[screenName]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchInsight({ data: { screenName, userData } });
      setInsight(res);
      setCache({ ...cache, [screenName]: res });
    } catch {
      setInsight("I'm recalibrating my gears... tap refresh to try again ⚙️");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [screenName, JSON.stringify(userData)]);

  return (
    <div className="flex items-start gap-2 mt-2 fade-in">
      <Aether size={36} />
      <div className="flex-1 bg-[#e8d5a3] border border-[#b87333] rounded-xl p-2 relative">
        {loading ? (
          <div className="h-4 w-3/4 bg-[#b87333]/20 animate-pulse rounded-full my-1"></div>
        ) : (
          <div className="text-[10px] text-[#2c1810] pr-4">{insight}</div>
        )}
        <button onClick={() => load(true)} className="absolute top-1 right-1 text-[#b87333] hover:text-[#8a5424] text-xs">↻</button>
      </div>
    </div>
  );
}

// ============ LIFE LOAD (frozen formula from brief) ============
// LifeLoad = 100 × (0.35·avg_Traffic + 0.35·avg_Volatility + 0.30·CommitmentRatio)
// CommitmentRatio = 0.75 placeholder until backend supplies real value.
const COMMITMENT_RATIO = 0.75;
function computeLifeLoad(selected: string[], sliders: Record<string, GoalSliders>): number {
  if (selected.length === 0) return 0;
  let vSum = 0, tSum = 0;
  selected.forEach((g) => {
    const s = sliders[g] ?? { volatility: 5, traffic: 5 };
    vSum += s.volatility;
    tSum += s.traffic;
  });
  const avgV = (vSum / selected.length) / 10; // normalise 0-1
  const avgT = (tSum / selected.length) / 10;
  const load = 100 * (0.35 * avgT + 0.35 * avgV + 0.30 * COMMITMENT_RATIO);
  return Math.round(load * 10) / 10;
}

// ============ MAIN APP ============
export default function DoneHoApp() {
  const [screen, setScreen] = useState<number>(1);
  const [username, setUsername] = useState<string>("");
  const [profession, setProfession] = useState<string>("");
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>([]);
  const [allGoals, setAllGoals] = useState<string[]>(DEFAULT_GOALS);
  const [goalSliders, setGoalSliders] = useState<Record<string, GoalSliders>>({});
  const [totalHoursPerDay, setTotalHoursPerDay] = useState<number>(5); // default midpoint of recommended range
  const [tasksPerGoal, setTasksPerGoal] = useState<Record<string, string[]>>({});
  const [resilienceScore, setResilienceScore] = useState<number>(70);
  const [reservePool, setReservePool] = useState({
    currentWeekRemaining: 3.5,
    carriedFromLastWeek: 0,
    totalAvailable: 3.5,
    usedThisWeek: 0,
    history: [] as string[]
  });
  const [planningLag, setPlanningLag] = useState({ tasks: [] as string[], totalMins: 0 });
  const [userProfile, setUserProfile] = useState<{ age?: string; gender?: string; location?: string }>({});
  const [aetherInsights, setAetherInsights] = useState<Record<string, string>>({});
  const [panelCache, setPanelCache] = useState<Record<string, any>>({});
  const [vaultedTasks, setVaultedTasks] = useState<string[]>([]);
  const [refinementSeen, setRefinementSeen] = useState(false);
  const [refinementNotes, setRefinementNotes] = useState<string[]>([]);
  const [regenTick, setRegenTick] = useState(0); // bumps to force blueprint reshuffle animation

  const goNext = (n: number) => { setScreen(n); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#1a1410" }}>
      <div
        className="parchment-bg relative overflow-hidden shadow-2xl"
        style={{ width: 375, height: 812, boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px #6b3f1a" }}
      >
        <div key={screen} className="fade-in w-full h-full overflow-y-auto thin-scroll">
          <ScreenBoundary onReset={() => setScreen(8)}>
          {screen === 1 && <Screen1 onJoin={(u) => { setUsername(u); goNext(3); }} onLogin={() => goNext(2)} />}
          {screen === 2 && <Screen2 onVerified={() => goNext(3)} onSignup={() => goNext(1)} />}
          {screen === 3 && (
            <Screen3Chat
              seedName={username}
              onDone={(name, prof) => { setUsername(name); setProfession(prof); goNext(4); }}
            />
          )}
          {screen === 4 && (
            <Screen4
              username={username || "Friend"}
              allGoals={allGoals}
              setAllGoals={setAllGoals}
              selectedGoals={selectedGoals}
              setSelectedGoals={setSelectedGoals}
              onGenerate={() => {
                const sliders: Record<string, GoalSliders> = { ...goalSliders };
                selectedGoals.forEach((g) => {
                  if (!sliders[g]) sliders[g] = GOAL_DEFAULTS[g] ?? { volatility: 5, traffic: 5 };
                });
                setGoalSliders(sliders);
                goNext(5);
              }}
              userProfile={userProfile}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
            />
          )}
          {screen === 5 && (
            <Screen5
              username={username}
              selectedGoals={selectedGoals}
              goalSliders={goalSliders}
              setGoalSliders={setGoalSliders}
              onActivate={() => goNext(6)}
              onModify={() => goNext(4)}
              userProfile={userProfile}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
            />
          )}
          {screen === 6 && (
            <Screen6
              username={username}
              selectedGoals={selectedGoals}
              goalSliders={goalSliders}
              totalHoursPerDay={totalHoursPerDay}
              setTotalHoursPerDay={setTotalHoursPerDay}
              tasksPerGoal={tasksPerGoal}
              setTasksPerGoal={setTasksPerGoal}
              onAetherize={() => {
                // Skip clarification silently if no vague tasks
                const vague = collectVagueTasks(selectedGoals, tasksPerGoal);
                if (vague.length === 0) goNext(7);
                else goNext(65);
              }}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
            />
          )}
          {screen === 65 && (
            <ScreenClarify
              username={username}
              selectedGoals={selectedGoals}
              tasksPerGoal={tasksPerGoal}
              setTasksPerGoal={setTasksPerGoal}
              onDone={() => goNext(7)}
            />
          )}
          {screen === 7 && <Screen7 username={username} onContinue={() => goNext(8)} />}
          {screen === 8 && (
            <Screen8
              username={username}
              selectedGoals={selectedGoals}
              goalSliders={goalSliders}
              tasksPerGoal={tasksPerGoal}
              setTasksPerGoal={setTasksPerGoal}
              setSelectedGoals={setSelectedGoals}
              setGoalSliders={setGoalSliders}
              totalHoursPerDay={totalHoursPerDay}
              vaultedTasks={vaultedTasks}
              onNav={(s: number) => goNext(s)}
              userProfile={userProfile}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
              panelCache={panelCache}
              setPanelCache={setPanelCache}
              refinementSeen={refinementSeen}
              setRefinementSeen={setRefinementSeen}
              refinementNotes={refinementNotes}
              setRefinementNotes={setRefinementNotes}
              regenTick={regenTick}
              setRegenTick={setRegenTick}
            />
          )}
          {screen === 12 && (
            <Screen12
              username={username}
              selectedGoals={selectedGoals}
              goalSliders={goalSliders}
              tasksPerGoal={tasksPerGoal}
              totalHoursPerDay={totalHoursPerDay}
              resilienceScore={resilienceScore}
              setResilienceScore={setResilienceScore}
              reservePool={reservePool}
              setReservePool={setReservePool}
              planningLag={planningLag}
              setPlanningLag={setPlanningLag}
              vaultedTasks={vaultedTasks}
              setVaultedTasks={setVaultedTasks}
              onNav={(s: number) => goNext(s)}
              userProfile={userProfile}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
            />
          )}
          {screen === 13 && (
            <Screen13
              username={username}
              profession={profession}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              selectedGoals={selectedGoals}
              vaultedTasks={vaultedTasks}
              onNav={(s: number) => goNext(s)}
            />
          )}
          </ScreenBoundary>
        </div>
      </div>
    </div>
  );
}

// ============ SCREEN 1 SIGNUP ============
function Screen1({ onJoin, onLogin }: { onJoin: (u: string) => void; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const submit = () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email");
    if (pw.length < 6) return toast.error("Password must be 6+ characters");
    if (pw !== cpw) return toast.error("Passwords don't match");
    const uname = email.split("@")[0].replace(/[^a-z]/gi, "") || "Friend";
    onJoin(uname.charAt(0).toUpperCase() + uname.slice(1));
  };

  return (
    <div className="p-6 flex flex-col items-center min-h-full">
      <div className="mt-4"><BigGear size={72} spin /></div>
      <Logo size={36} />
      <p className="text-[11px] italic text-[#5a3a20] mt-1">Better Days for the Best</p>
      <p className="text-[12px] font-semibold text-[#2c1810] mt-2 text-center">Plans that bend so you don't break.</p>
      <p className="text-[10.5px] text-[#5a3a20] mt-3 text-center leading-snug px-2">
        Life doesn't ask permission before it gets messy. DoneHo catches it quietly and keeps you moving — your week, shaped around real life, not the other way around.
        <br />
        <span className="italic">No pressure. No restarts. Just forward, at your pace.</span>
      </p>
      <h2 className="font-serif-d text-[20px] font-bold text-[#2c1810] mt-4">Join DoneHo</h2>

      <div className="w-full space-y-3 mt-4">
        <div className="input-pill flex items-center gap-2"><span>✉️</span>
          <input className="flex-1 bg-transparent outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="input-pill flex items-center gap-2"><span>🔒</span>
          <input type={showPw ? "text" : "password"} className="flex-1 bg-transparent outline-none" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button onClick={() => setShowPw(!showPw)} className="text-[#8a5424] text-xs">{showPw ? "🙈" : "👁"}</button>
        </div>
        <div className="input-pill flex items-center gap-2"><span>🔒</span>
          <input type={showCpw ? "text" : "password"} className="flex-1 bg-transparent outline-none" placeholder="Confirm password" value={cpw} onChange={(e) => setCpw(e.target.value)} />
          <button onClick={() => setShowCpw(!showCpw)} className="text-[#8a5424] text-xs">{showCpw ? "🙈" : "👁"}</button>
        </div>
      </div>

      <button onClick={submit} className="btn-copper w-full mt-4 py-3 text-sm">Create account</button>
      <button onClick={onLogin} className="mt-3 text-[12px] text-[#2c1810] underline">Already have an account? Log in</button>
    </div>
  );
}

// ============ SCREEN 2 LOGIN ============
function Screen2({ onVerified, onSignup }: { onVerified: () => void; onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const submit = () => {
    if (!email.trim()) return toast.error("Enter your email");
    if (pw.length < 4) return toast.error("Enter your password");
    onVerified();
  };

  return (
    <div className="p-6 flex flex-col items-center min-h-full">
      <div className="mt-6"><BigGear size={64} spin rev /></div>
      <Logo size={30} />
      <h2 className="font-serif-d text-[22px] font-bold text-[#2c1810] mt-6">Welcome back</h2>
      <div className="w-full space-y-3 mt-4">
        <div className="input-pill flex items-center gap-2"><span>✉️</span>
          <input className="flex-1 bg-transparent outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="input-pill flex items-center gap-2"><span>🔒</span>
          <input type="password" className="flex-1 bg-transparent outline-none" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
      </div>
      <button onClick={submit} className="btn-copper w-full mt-4 py-3 text-sm">Log in</button>
      <button onClick={onSignup} className="mt-3 text-[12px] text-[#2c1810] underline">New here? Create an account</button>
    </div>
  );
}

// ============ SCREEN 3 — CONVERSATIONAL ONBOARDING ============
// Single chat question: name + profession. Nothing else asked at this stage.
function Screen3Chat({ seedName, onDone }: { seedName?: string; onDone: (name: string, prof: string) => void }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => { setShowSplash(false); }, 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (!showSplash) inputRef.current?.focus(); }, [showSplash]);

  const submit = () => {
    const raw = input.trim();
    if (!raw) return toast.error("Say a little — your name and what you do");
    // Very light parse: split on common separators. Placeholder — the real backend can parse better later.
    const cleaned = raw.replace(/^(hi|hello|hey|i'?m|i am|my name is|call me)\s+/i, "");
    let name = seedName || "";
    let prof = "";
    if (/,| and | & |\.|—|-/.test(cleaned)) {
      const parts = cleaned.split(/,| and | & |\.|—| - /i).map(s => s.trim()).filter(Boolean);
      name = parts[0] || name;
      prof = parts.slice(1).join(", ");
    } else {
      // Fall back: first word = name, rest = profession
      const parts = cleaned.split(/\s+/);
      name = parts[0] || name;
      prof = parts.slice(1).join(" ");
    }
    if (!name) name = "Friend";
    if (!prof) prof = "—";
    setThinking(true);
    setTimeout(() => onDone(name.replace(/[^a-zA-Z\- ]/g, "").trim() || "Friend", prof.trim()), 700);
  };

  if (showSplash) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-full fade-in">
        <div className="mb-2"><BigGear size={96} spin /></div>
        <Logo size={44} />
        <p className="text-[13px] italic text-[#5a3a20] mt-3">Better Days for the Best</p>
        <div className="mt-6 text-[10px] text-[#5a3a20]">Warming the gears…</div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col min-h-full">

      <Logo size={30} />
      <div className="mt-6 flex items-start gap-2 fade-in">
        <Aether size={42} />
        <div className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-2xl rounded-tl-sm p-3 text-[13px] text-[#2c1810] leading-snug">
          Hi! I'm Aether.
          <br />
          <span className="font-bold">What should I call you, and what do you do for work?</span>
        </div>
      </div>

      <div className="mt-4 text-[10px] italic text-[#5a3a20] pl-14">One line is plenty — e.g. "Thasli, product manager"</div>

      <div className="mt-auto pb-2">
        <div className="input-pill flex items-center gap-2">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm"
            placeholder="Type your answer…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <button onClick={submit} disabled={thinking}
          className={`btn-copper w-full mt-3 py-3 text-sm ${thinking ? "opacity-70" : ""}`}>
          {thinking ? "Aether is listening…" : "Send →"}
        </button>
        <div className="mt-3 pt-1"><ProgressBar pct={25} label="Onboarding" /></div>
      </div>
    </div>
  );
}

// ============ SCREEN 4 GOALS ============
function Screen4({ username, allGoals, setAllGoals, selectedGoals, setSelectedGoals, onGenerate, userProfile, aetherInsights, setAetherInsights }: any) {
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const toggle = (g: string) => {
    setSelectedGoals(selectedGoals.includes(g) ? selectedGoals.filter((x: string) => x !== g) : [...selectedGoals, g]);
  };
  const addGoal = () => {
    if (!newGoal.trim()) return;
    setAllGoals([...allGoals, newGoal.trim()]);
    setSelectedGoals([...selectedGoals, newGoal.trim()]);
    setNewGoal(""); setAdding(false);
  };
  const generate = () => {
    if (selectedGoals.length === 0) return toast.error("Pick at least one goal");
    onGenerate();
  };

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <div className="flex items-start justify-between">
        <Logo size={28} />
        <div className="flex-1 ml-2">
          <AetherProactiveInsight
            screenName="Goal Selection"
            userData={{ username, selectedGoals, timeOfDay: new Date().getHours(), location: userProfile?.location }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
      </div>
      <h2 className="font-serif-d text-[22px] font-bold text-[#2c1810] mt-2">Welcome {username}</h2>
      <p className="text-[11px] text-[#5a3a20]">Pick the areas that matter. Aether shapes the rest.</p>

      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => setChatOpen(true)} className="btn-olive px-3 py-1 text-[11px]">Ask Aether</button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto thin-scroll space-y-2 pr-1" style={{ maxHeight: 380 }}>
        {allGoals.map((g: string) => {
          const sel = selectedGoals.includes(g);
          return (
            <div key={g} onClick={() => toggle(g)} className="goal-card cursor-pointer">
              <span>{GOAL_ICONS[g] ?? "✨"} {g}</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: sel ? "#4a7c59" : "transparent",
                  border: `2px solid ${sel ? "#4a7c59" : "#d4843a"}`,
                  color: "white",
                }}
              >
                {sel ? "✓" : ""}
              </div>
            </div>
          );
        })}
        {adding && (
          <div className="flex gap-2">
            <input className="input-pill flex-1" placeholder="e.g. Learn French" value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)} />
            <button onClick={addGoal} className="btn-copper px-3 text-xs">Add</button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <button onClick={generate} className="btn-olive w-full py-2.5 flex items-center justify-center gap-2 text-[13px]">
          <span>⚙️</span> Continue
        </button>
        <div className="flex items-center justify-between text-[11px] text-[#2c1810]">
          <span>Don't see your goal?</span>
          <button onClick={() => setAdding(true)} className="btn-olive px-3 py-1 text-[10px]">+ Add goal</button>
        </div>
        <ProgressBar pct={45} label="Onboarding" />
      </div>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

// ============ AETHER CHAT POPUP (used everywhere) ============
function AetherChat({ username, onClose }: { username: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Hi ${username || "friend"} — ask me about DoneHo, your plan, or anything unclear. Short answers only ⚙️` }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fetchChat = useServerFn(chatWithAether);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const send = async () => {
    if (!input.trim() || typing) return;
    const userMessage = input.trim();
    const newHistory: { role: "user" | "assistant"; content: string }[] = [...msgs, { role: "user", content: userMessage }];
    setMsgs(newHistory);
    setInput("");
    setTyping(true);
    try {
      const responseText = await fetchChat({ data: { username, messages: newHistory } });
      setMsgs([...newHistory, { role: "assistant", content: responseText }]);
    } catch {
      setMsgs([...newHistory, { role: "assistant", content: "My signal got disrupted — try again ⚙️" }]);
    } finally { setTyping(false); }
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-end z-50 fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#c8b89a] rounded-t-3xl border-t-4 border-[#b87333] shadow-2xl flex flex-col"
        style={{ height: "70%" }}>
        <div className="flex items-center justify-between p-3 border-b border-[#b87333]/30 rounded-t-3xl">
          <div className="flex items-center gap-2"><Aether size={32} /><span className="font-bold text-[#2c1810]">Aether</span></div>
          <button onClick={onClose} className="text-[#2c1810] text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#b87333]/20">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2">
          {msgs.map((m, i) => (
            <div key={i} className={`text-[13px] p-3 rounded-xl max-w-[85%] leading-snug ${m.role === "assistant"
              ? "bg-[#e8d5a3] text-[#2c1810] mr-auto border border-[#b87333]"
              : "bg-[#2c1810] text-[#e8d5a3] ml-auto"}`}>{m.content}</div>
          ))}
          {typing && (
            <div className="text-[13px] p-3 rounded-xl max-w-[85%] bg-[#e8d5a3] text-[#2c1810] mr-auto border border-[#b87333] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#b87333] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#b87333] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#b87333] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 p-3 border-t border-[#b87333]/30">
          <input ref={inputRef} className="input-pill flex-1" placeholder="Ask Aether…" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button onClick={send} disabled={typing} className={`btn-copper px-4 text-xs ${typing ? 'opacity-50' : ''}`}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ============ SCREEN 5 — PRIORITY BLUEPRINT ============
function Screen5({ username, selectedGoals, goalSliders, setGoalSliders, onActivate, onModify, userProfile, aetherInsights, setAetherInsights }: any) {
  const [chatOpen, setChatOpen] = useState(false);
  const lifeLoad = useMemo(() => computeLifeLoad(selectedGoals, goalSliders), [selectedGoals, goalSliders]);

  const updateSlider = (g: string, key: keyof GoalSliders, val: number) => {
    setGoalSliders({ ...goalSliders, [g]: { ...(goalSliders[g] ?? { volatility: 5, traffic: 5 }), [key]: val } });
  };

  // Commit gating: strictly disabled above 65
  const blocked = lifeLoad > 65;
  const noLeisure = selectedGoals.length > 0 && !selectedGoals.some((g: string) => LEISURE_GOALS.has(g));

  const zoneColor = lifeLoad < 30 ? "#4a7c59" : lifeLoad < 50 ? "#a3c54a" : lifeLoad <= 65 ? "#d4a843" : "#c44b3e";
  const needleAngle = -90 + Math.min(180, (lifeLoad / 100) * 180);

  const aetherMsg =
    lifeLoad < 30 ? "Light week. Room to breathe." :
    lifeLoad < 50 ? "Nicely balanced." :
    lifeLoad <= 65 ? "Getting intense. Still safe to commit." :
    `Too heavy ${username}. Ease one goal down before committing.`;

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <Logo size={26} />
      <h2 className="font-serif-d text-[20px] font-bold text-[#2c1810] mt-2">What grounds your week?</h2>

      <AetherProactiveInsight
        screenName="Priority Blueprint"
        userData={{ username, selectedGoals, lifeLoadScore: lifeLoad, goalSliders, hasLeisure: !noLeisure, location: userProfile?.location }}
        cache={aetherInsights}
        setCache={setAetherInsights}
      />
      <div className="flex gap-1 mt-1">
        <button onClick={() => setChatOpen(true)} className="btn-olive px-2 py-0.5 text-[10px]">Ask Aether</button>
      </div>

      <div className="mt-2 flex flex-col items-center">
        <svg width="200" height="110" viewBox="0 0 200 110">
          <defs>
            <linearGradient id="meterG" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#4a7c59" />
              <stop offset="50%" stopColor="#d4a843" />
              <stop offset="100%" stopColor="#c44b3e" />
            </linearGradient>
          </defs>
          <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="url(#meterG)" strokeWidth="14" fill="none" strokeLinecap="round" />
          <line x1="100" y1="100" x2="100" y2="35" stroke="#2c1810" strokeWidth="3" strokeLinecap="round"
            transform={`rotate(${needleAngle} 100 100)`} style={{ transition: "transform 0.3s" }} />
          <circle cx="100" cy="100" r="6" fill={zoneColor} stroke="#6b3f1a" strokeWidth="2" />
        </svg>
        <div className="text-[12px] font-bold text-[#2c1810] -mt-2">LifeLoad: {lifeLoad.toFixed(1)}</div>
        <div className="flex justify-between w-[200px] text-[10px] text-[#5a3a20]"><span>Light</span><span>Intense</span></div>
        <div className="text-[10px] italic text-[#2c1810] mt-1 text-center px-2">{aetherMsg}</div>
      </div>

      {noLeisure && (
        <div className="mt-1 text-[10px] text-[#c44b3e]">⚠️ No leisure planned this week — burnout risk.</div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2 overflow-y-auto thin-scroll flex-1 pr-1" style={{ maxHeight: 280 }}>
        {selectedGoals.map((g: string) => {
          const s = goalSliders[g] ?? { volatility: 5, traffic: 5 };
          return (
            <div key={g} className="dark-card text-[10px] relative">
              <div className="font-bold text-[11px] mb-1">{GOAL_ICONS[g] ?? "✨"} {g}</div>
              <div>Volatility: {s.volatility}</div>
              <input type="range" min={0} max={10} value={s.volatility}
                onChange={(e) => updateSlider(g, "volatility", Number(e.target.value))} className="steam-slider" />
              <div className="mt-1">Traffic: {s.traffic}</div>
              <input type="range" min={0} max={10} value={s.traffic}
                onChange={(e) => updateSlider(g, "traffic", Number(e.target.value))} className="steam-slider" />
            </div>
          );
        })}
      </div>

      <div className="mt-2 space-y-1.5">
        <button
          disabled={blocked}
          onClick={onActivate}
          className={`btn-copper w-full py-2.5 text-[13px] ${blocked ? "opacity-50 cursor-not-allowed" : ""}`}>
          {blocked ? "Reduce LifeLoad below 65 to commit" : "Activate Priority Blueprint"}
        </button>
        <button onClick={onModify} className="w-full py-1.5 rounded-full border-2 border-[#b87333] text-[#2c1810] bg-[#e8d5a3] text-xs font-semibold">
          Modify goals
        </button>
      </div>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

// ============ SCREEN 6 — AETHERIZATION (hours + tasks) ============
function Screen6({ username, selectedGoals, goalSliders, totalHoursPerDay, setTotalHoursPerDay,
  tasksPerGoal, setTasksPerGoal, onAetherize, aetherInsights, setAetherInsights }: any) {
  const [chatOpen, setChatOpen] = useState(false);
  const lifeLoad = computeLifeLoad(selectedGoals, goalSliders);

  // Recommended range (placeholder — will come from backend Commitment Contract)
  const REC_MIN = 4;
  const REC_MAX = 6;
  const REC_DEFAULT = 5;

  useEffect(() => {
    // Ensure hours land inside recommended band
    if (totalHoursPerDay < REC_MIN || totalHoursPerDay > REC_MAX) setTotalHoursPerDay(REC_DEFAULT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedGoals = [...selectedGoals].sort((a: string, b: string) => {
    const sa = (goalSliders[a]?.traffic ?? 0) + (goalSliders[a]?.volatility ?? 0);
    const sb = (goalSliders[b]?.traffic ?? 0) + (goalSliders[b]?.volatility ?? 0);
    return sb - sa;
  });

  const setTask = (g: string, i: number, v: string) => {
    const arr = [...(tasksPerGoal[g] ?? ["", "", "", ""])];
    arr[i] = v;
    setTasksPerGoal({ ...tasksPerGoal, [g]: arr });
  };
  const addMore = (g: string) => {
    const arr = [...(tasksPerGoal[g] ?? ["", "", "", ""])];
    arr.push("");
    setTasksPerGoal({ ...tasksPerGoal, [g]: arr });
  };

  const filledCards = orderedGoals.filter((g: string) =>
    (tasksPerGoal[g] ?? []).filter((t: string) => t.trim()).length >= 2).length;
  const pct = orderedGoals.length === 0 ? 0 : Math.round((filledCards / orderedGoals.length) * 100);

  const aetherMsg =
    pct === 0 ? `Let's start ${username}. Add a couple of tasks per goal.` :
    pct < 50 ? "Nice — every task helps me protect your week." :
    pct < 100 ? "Almost there. A couple more and I can Aetherize." :
    `Ready ${username}! Tap Aetherize.`;

  // Slider position → filled band styling
  const bandPct = ((REC_MAX - REC_MIN) / (REC_MAX - REC_MIN)) * 100;

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <div className="flex items-center justify-between">
        <Logo size={26} />
        <button onClick={() => setChatOpen(true)} className="btn-olive px-2 py-0.5 text-[10px]">Ask Aether</button>
      </div>
      <h2 className="font-serif-d text-[18px] font-bold text-[#2c1810] mt-2">Your hours this week</h2>
      <p className="text-[10px] text-[#5a3a20]">Recommended: {REC_MIN}–{REC_MAX} hrs/day. I'll shape the plan around this.</p>

      {/* Constrained recommended-range slider */}
      <div className="mt-2 bg-[#e8d5a3] border border-[#b87333] rounded-xl p-2">
        <div className="flex items-center justify-between text-[10px] text-[#2c1810] font-semibold">
          <span>Daily focus hours</span>
          <span className="text-[12px] text-[#2d4a1e]">{totalHoursPerDay} hrs/day</span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-[#b87333]/25 overflow-hidden">
          <div className="absolute top-0 h-3 bg-[#4a7c59]/50" style={{ left: "0%", width: `${bandPct}%` }} />
          <div className="absolute top-0 h-3 bg-[#4a7c59]" style={{
            left: `${((totalHoursPerDay - REC_MIN) / (REC_MAX - REC_MIN)) * 100}%`,
            width: 4,
          }} />
        </div>
        <input
          type="range"
          min={REC_MIN}
          max={REC_MAX}
          step={0.5}
          value={totalHoursPerDay}
          onChange={(e) => setTotalHoursPerDay(Number(e.target.value))}
          className="steam-slider w-full mt-1"
        />
        <div className="flex justify-between text-[9px] text-[#5a3a20] mt-1">
          <span>{REC_MIN} hr</span>
          <span>Recommended range</span>
          <span>{REC_MAX} hr</span>
        </div>
      </div>

      <AetherProactiveInsight
        screenName="Aetherization"
        userData={{ username, totalHoursPerDay, lifeLoadScore: lifeLoad, tasksPerGoal, selectedGoals }}
        cache={aetherInsights}
        setCache={setAetherInsights}
      />
      <p className="text-[10px] text-[#2d4a1e] mt-1">{aetherMsg}</p>

      <div className="flex-1 overflow-y-auto thin-scroll mt-2 space-y-2 pr-1" style={{ maxHeight: 400 }}>
        {orderedGoals.map((g: string) => {
          const focus = focusFor(goalSliders[g]);
          const tasks = tasksPerGoal[g] ?? ["", "", "", ""];
          return (
            <div key={g} className="dark-card">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[12px]">{GOAL_ICONS[g] ?? "✨"} {g}</div>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: focus.color, color: "#fff" }}>
                  {focus.label}
                </span>
              </div>
              <div className="space-y-1 mt-2">
                {tasks.map((t: string, i: number) => (
                  <input key={i} value={t} onChange={(e) => setTask(g, i, e.target.value)}
                    placeholder={`Task ${i + 1}`}
                    className="w-full rounded-full px-3 py-1 text-[11px] bg-[#e8d5a3] text-[#2c1810] border border-[#b87333]" />
                ))}
              </div>
              <button onClick={() => addMore(g)} className="text-[10px] text-[#a3c54a] underline mt-1">+ Add more tasks</button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="text-[18px] font-bold text-[#2d4a1e]">{pct}%</div>
        <button disabled={pct < 100} onClick={onAetherize}
          className={`btn-copper flex-1 py-2 text-[12px] ${pct === 100 ? "glow-pulse" : "opacity-60"}`}>
          Aetherize my week
        </button>
      </div>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

// ============ SCREEN 6.5 — GOAL CLARIFICATION ============
// Only flag tasks that are genuinely ambiguous. Self-evident single-word tasks
// like "Meditation", "Workout", or "Cooking" should never trigger a question.
type VagueTask = { goal: string; index: number; text: string; question: string };

const SELF_EVIDENT = new Set([
  "meditation","meditate","workout","exercise","yoga","stretch","stretching",
  "cooking","cook","reading","journal","journaling","prayer","walk","walking",
  "running","cycling","swimming","cleaning","laundry","groceries","sleep",
  "nap","hydration","breakfast","lunch","dinner",
]);

const AMBIGUOUS_SINGLES = new Set([
  "learn","study","improve","practice","work","fitness","health","finance",
  "money","goals","review","plan","reading","project",
]);

function clarifyQuestionFor(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const words = lower.split(/\s+/);

  // Self-evident single-word or short tasks — never ask.
  if (words.length === 1 && SELF_EVIDENT.has(lower)) return null;
  if (words.length <= 2 && words.every((w) => SELF_EVIDENT.has(w))) return null;

  // Only these categories trigger a tailored ask when short/underspecified.
  const isShort = words.length <= 2;
  const has = (...arr: string[]) => arr.some((w) => lower.includes(w));

  if (has("learn", "study", "master") && isShort)
    return `For "${t}" — starting from scratch, or brushing up?`;
  if (has("workout", "fitness", "gym", "train") && isShort)
    return `For "${t}" — which type: cardio, strength, or mobility?`;
  if (has("read", "book") && isShort)
    return `For "${t}" — fiction, non-fiction, or a specific title in mind?`;
  if (has("write", "blog", "draft", "essay") && isShort)
    return `For "${t}" — long-form pieces or short daily entries?`;
  if (has("save", "budget", "invest", "money", "finance") && isShort)
    return `For "${t}" — saving, budgeting, or investing focus?`;
  if (has("cook", "recipe", "meal") && isShort)
    return `For "${t}" — any cuisine or dietary preference to focus on?`;
  if (has("practice") && isShort)
    return `For "${t}" — roughly how many minutes a day feels right?`;
  if (has("improve", "work on", "get better") && isShort)
    return `For "${t}" — what would "better" look like this week?`;

  // Truly single ambiguous word ("Learn", "Study", "Improve") with no object.
  if (words.length === 1 && AMBIGUOUS_SINGLES.has(lower))
    return `"${t}" is a bit broad — what specifically this week?`;

  return null;
}

function collectVagueTasks(selectedGoals: string[], tasksPerGoal: Record<string, string[]>): VagueTask[] {
  const vague: VagueTask[] = [];
  selectedGoals.forEach((g) => {
    (tasksPerGoal[g] ?? []).forEach((t, i) => {
      const clean = t.trim();
      if (!clean) return;
      const q = clarifyQuestionFor(clean);
      if (q) vague.push({ goal: g, index: i, text: clean, question: q });
    });
  });
  return vague;
}

function ScreenClarify({ username, selectedGoals, tasksPerGoal, setTasksPerGoal, onDone }: any) {
  void username;
  const vague = useMemo(() => collectVagueTasks(selectedGoals, tasksPerGoal), [selectedGoals, tasksPerGoal]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");

  useEffect(() => { if (vague.length === 0) onDone(); }, []); // eslint-disable-line

  if (vague.length === 0) return null;
  const current = vague[idx];

  const submit = () => {
    if (answer.trim()) {
      const arr = [...(tasksPerGoal[current.goal] ?? [])];
      arr[current.index] = `${current.text} (${answer.trim()})`;
      setTasksPerGoal({ ...tasksPerGoal, [current.goal]: arr });
    }
    setAnswer("");
    if (idx + 1 >= vague.length) onDone();
    else setIdx(idx + 1);
  };

  return (
    <div className="p-4 flex flex-col min-h-full">
      <Logo size={26} />
      <h2 className="font-serif-d text-[18px] font-bold text-[#2c1810] mt-3">Quick check-in</h2>
      <p className="text-[10px] text-[#5a3a20]">Aether wants to sharpen a couple of tasks before blueprinting.</p>

      <div className="mt-4 flex items-start gap-2 fade-in" key={idx}>
        <Aether size={38} />
        <div className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-2xl rounded-tl-sm p-3 text-[12px] text-[#2c1810]">
          {current.question}
        </div>
      </div>

      <div className="mt-auto pb-2">
        <div className="input-pill flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm"
            placeholder="Short answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => { setAnswer(""); if (idx + 1 >= vague.length) onDone(); else setIdx(idx + 1); }}
            className="w-1/3 py-2 rounded-full border-2 border-[#b87333] text-[#2c1810] bg-[#e8d5a3] text-xs">
            Skip
          </button>
          <button onClick={submit} className="btn-copper flex-1 py-2 text-sm">Next →</button>
        </div>
        <div className="text-center text-[9px] text-[#5a3a20] mt-2">Question {idx + 1} of {vague.length}</div>
      </div>
    </div>
  );
}

// ============ SCREEN 7 CONGRATS ============
function Screen7({ username, onContinue }: { username: string; onContinue: () => void }) {
  const [showBtn, setShowBtn] = useState(false);
  const [typed, setTyped] = useState("");
  const fullText = `Your Blueprint is ready ${username}. I've Aetherized your week around what matters. Let's begin.`;
  useEffect(() => { const t = setTimeout(() => setShowBtn(true), 1600); return () => clearTimeout(t); }, []);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++; setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [fullText]);

  return (
    <div className="p-5 flex flex-col items-center min-h-full">
      <Logo size={30} />
      <h2 className="font-serif-d text-[24px] font-bold text-[#2c1810] mt-3 text-center">Aetherization complete</h2>
      <div className="mt-4 w-full rounded-3xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #3a5e26, #2d4a1e)", border: "3px solid #b87333" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute sparkle" style={{
            top: `${10 + (i * 11) % 80}%`, left: `${5 + (i * 17) % 90}%`,
            animationDelay: `${i * 0.3}s`, color: "#d4a843", fontSize: 10,
          }}>✦</div>
        ))}
        <div className="flex items-center justify-center gap-2 mt-6">
          <BigGear size={48} spin rev />
          <BigGear size={96} spin />
          <BigGear size={48} spin rev />
        </div>
        <div className="h-1 bg-[#b87333] w-1/2 mx-auto mt-3 rounded-full" />
      </div>
      <div className="w-full mt-4"><ProgressBar pct={100} /></div>

      <div className="mt-3 flex items-start gap-2">
        <Aether size={40} />
        <div className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-xl p-2 text-[11px] text-[#2c1810] cursor-blink">
          {typed}
        </div>
      </div>

      {showBtn && (
        <button onClick={onContinue} className="btn-copper px-5 py-2 text-xs mt-auto self-end fade-in">
          Open Blueprint →
        </button>
      )}
    </div>
  );
}

// ============ SCREEN 8 — DASHBOARD / BLUEPRINT ============
function getWeekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function computeDistribution(selected: string[], sliders: Record<string, GoalSliders>, totalHours: number, tasks: Record<string, string[]>) {
  const available = Math.max(1, totalHours);
  const weighted: Record<string, number> = {};
  let sum = 0;
  selected.forEach((g) => {
    const s = sliders[g] ?? { volatility: 5, traffic: 5 };
    const w = Math.max(0.5, (s.traffic + s.volatility));
    weighted[g] = w;
    sum += w;
  });
  const result: { goal: string; hours: number; weighted: number; tasks: { name: string; minutes: number; milestones: string[] }[] }[] = [];
  selected.forEach((g) => {
    let hours = sum > 0 ? (weighted[g] / sum) * available : 0;
    hours = Math.max(0.5, Math.round(hours * 2) / 2);
    const taskList = (tasks[g] ?? []).filter((t) => t.trim());
    const perTask = taskList.length > 0 ? Math.max(10, Math.round((hours * 60) / taskList.length / 5) * 5) : 0;
    result.push({
      goal: g, hours, weighted: weighted[g],
      tasks: taskList.map((t) => ({ name: t, minutes: perTask, milestones: mockMilestones(t) })),
    });
  });
  result.sort((a, b) => b.weighted - a.weighted);
  return result;
}

function Screen8(props: any) {
  const {
    username, selectedGoals, goalSliders, tasksPerGoal, setTasksPerGoal, setSelectedGoals, setGoalSliders,
    totalHoursPerDay, vaultedTasks, onNav, userProfile, aetherInsights, setAetherInsights,
    panelCache, setPanelCache, refinementSeen, setRefinementSeen, refinementNotes, setRefinementNotes,
    regenTick, setRegenTick,
  } = props;

  const dist = useMemo(
    () => computeDistribution(selectedGoals, goalSliders, totalHoursPerDay || 5, tasksPerGoal),
    // regenTick invalidates memo so the visual reshuffle animation re-runs
    [selectedGoals, goalSliders, totalHoursPerDay, tasksPerGoal, regenTick]
  );
  const lifeLoad = useMemo(() => computeLifeLoad(selectedGoals, goalSliders), [selectedGoals, goalSliders]);

  const [panel, setPanel] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showRefinement, setShowRefinement] = useState(!refinementSeen);
  const [modifyOpen, setModifyOpen] = useState(false);

  // Disruption panel
  const [disruption, setDisruption] = useState("");
  const [disruptionMsg, setDisruptionMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [loadTrend, setLoadTrend] = useState(false); // reserved for future
  void loadTrend;

  const submitDisruption = () => {
    if (!disruption.trim()) return;
    setDisruptionMsg("Got it — updating your week…");
    setRefreshing(true);
    // clear caches so panels re-fetch mock/AI content on next open
    setPanelCache({});
    setRegenTick((t: number) => t + 1);
    setTimeout(() => {
      setRefreshing(false);
      setDisruptionMsg("Blueprint updated. Your week stays on track.");
      setDisruption("");
      setTimeout(() => setDisruptionMsg(null), 3500);
    }, 1400);
  };

  const regenerateBlueprint = () => {
    setRefreshing(true);
    setRegenTick((t: number) => t + 1);
    setTimeout(() => setRefreshing(false), 900);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <AetherProactiveInsight
            screenName="Blueprint Dashboard"
            userData={{ username, lifeLoadScore: lifeLoad, selectedGoals, timeOfDay: new Date().getHours(), location: userProfile?.location, totalHoursPerDay }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
        <Logo size={22} />
      </div>

      <div className="px-3 flex items-center gap-2">
        <button onClick={() => setChatOpen(true)} className="btn-olive px-2 py-0.5 text-[10px]">Ask Aether</button>
        <button onClick={() => setModifyOpen(true)} className="btn-copper px-2 py-0.5 text-[10px]">✎ Modify goals/tasks</button>
      </div>

      <div className="px-3 mt-2 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#2d4a1e] rounded-full px-2 py-0.5 text-[10px] text-[#e8d5b0]">
          <span>🔒</span><span>{totalHoursPerDay} hrs/day planned</span>
        </div>
        <div className="flex-1 text-right text-[10px] bg-[#b87333] text-white rounded-full px-2 py-0.5">{getWeekRange()}</div>
      </div>

      {/* Disruption input */}
      <div className="px-3 mt-2">
        <div className="bg-[#2d4a1e] rounded-xl p-2 flex items-center gap-2">
          <span className="text-lg">🌩️</span>
          <input
            value={disruption}
            onChange={(e) => setDisruption(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitDisruption()}
            placeholder="Something happened? Tell me."
            className="flex-1 bg-[#e8d5a3] text-[#2c1810] rounded-full px-3 py-1 text-[11px] outline-none border border-[#b87333]"
          />
          <button onClick={submitDisruption} className="btn-copper px-3 py-1 text-[10px]">Send</button>
        </div>
        {disruptionMsg && <div className="text-[10px] italic text-[#2d4a1e] mt-1 fade-in">{disruptionMsg}</div>}
      </div>

      {/* Placeholder widget row */}
      <div className="px-3 mt-2 grid grid-cols-3 gap-2">
        <PlaceholderCard title="Life Load Trend" body={<MiniTrend />} tag="mock" />
        <PlaceholderCard title="Current Focus" body={
          <div className="text-[10px] text-[#e8d5b0] font-semibold truncate">{dist[0]?.goal ?? "—"}</div>
        } tag="mock" />
        <PlaceholderCard title="Weekly Snapshot" body={<MiniSnapshot />} tag="mock" />
      </div>

      <div className="px-3 mt-2">
        <div className="dark-card">
          <div className="text-[10px] font-bold text-[#e8d5b0]">Upcoming High-Impact Tasks <span className="text-[8px] text-[#d4a843] italic">(placeholder)</span></div>
          <ul className="text-[10px] text-[#e8d5b0]/80 mt-1 space-y-0.5">
            {dist.slice(0, 3).flatMap((d) => d.tasks.slice(0, 1).map((t, i) => (
              <li key={d.goal + i}>• {t.name} <span className="text-[#a3c54a]">({d.goal})</span></li>
            )))}
          </ul>
        </div>
      </div>

      <h3 className="text-center font-serif-d font-bold text-[14px] text-[#2c1810] mt-2">{username}'s Blueprint</h3>
      <div className="text-center text-[9px] text-[#5a3a20] italic">Grouped by goal → task → milestones</div>

      <div className="flex-1 flex gap-2 px-2 mt-1 overflow-hidden">
        <div key={regenTick} className={`flex-1 overflow-y-auto thin-scroll space-y-2 pr-1 ${refreshing ? "opacity-60" : ""} fade-in`}>
          {dist.map((d) => {
            const focus = focusFor(goalSliders[d.goal]);
            return (
              <div key={d.goal} className="dark-card text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{GOAL_ICONS[d.goal] ?? "✨"} {d.goal}</span>
                  <span className="text-[#a3c54a] font-bold">{d.hours} hr/day</span>
                </div>
                <div className="flex gap-1 mt-1">
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: focus.color, color: "#fff" }}>{focus.label}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {d.tasks.length === 0 && <div className="text-[9px] italic text-[#e8d5b0]/70">No tasks yet — add some via Modify.</div>}
                  {d.tasks.map((t, i) => (
                    <div key={i} className="bg-[#e8d5a3] text-[#2c1810] rounded-lg p-1.5">
                      <div className="flex justify-between font-semibold text-[10px]">
                        <span>▸ {t.name}</span>
                        <span className="text-[#4a7c59]">{t.minutes} min/day</span>
                      </div>
                      <ul className="mt-1 space-y-0.5 pl-2">
                        {t.milestones.map((m, k) => (
                          <li key={k} className="text-[9px] text-[#5a3a20]">• {m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={regenerateBlueprint} className="btn-olive w-full py-1.5 text-[11px] mt-1">↻ Regenerate Blueprint</button>
        </div>

        <div className="flex flex-col gap-1.5 py-1">
          {[
            { id: "opp", icon: "🧭" },
            { id: "boost", icon: "🚀" },
            { id: "spend", icon: "💰" },
            { id: "day", icon: "📅" },
          ].map((b) => (
            <button key={b.id} onClick={() => setPanel(b.id)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-base"
              style={{ background: "radial-gradient(circle, #d4a843, #b87333 60%, #6b3f1a)", border: "2px solid #6b3f1a", color: "#fff" }}>
              {b.icon}
            </button>
          ))}
        </div>
      </div>

      <BottomNav onNav={onNav} active={8} />

      {panel && <SidePanel panelId={panel} dist={dist} onClose={() => setPanel(null)} onNav={onNav}
        userData={{ username, selectedGoals, tasksPerGoal, lifeLoadScore: lifeLoad, timeOfDay: new Date().getHours(), totalHoursPerDay, goalSliders, location: userProfile?.location }}
        panelCache={panelCache} setPanelCache={setPanelCache} />}
      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} />}

      {showRefinement && (
        <Pass2RefinementModal
          onClose={() => { setShowRefinement(false); setRefinementSeen(true); }}
          notes={refinementNotes}
          setNotes={setRefinementNotes}
        />
      )}

      {modifyOpen && (
        <ModifyModal
          allGoals={DEFAULT_GOALS}
          selectedGoals={selectedGoals}
          goalSliders={goalSliders}
          tasksPerGoal={tasksPerGoal}
          onClose={() => setModifyOpen(false)}
          onTasksChanged={(next: Record<string, string[]>) => {
            setTasksPerGoal(next);
            // Task-only edit: only Blueprint refreshes, LifeLoad stays put.
            setRefreshing(true);
            setRegenTick((t: number) => t + 1);
            setPanelCache({});
            setTimeout(() => setRefreshing(false), 900);
          }}
          onGoalsChanged={(nextGoals: string[], nextSliders: Record<string, GoalSliders>) => {
            setSelectedGoals(nextGoals);
            setGoalSliders(nextSliders);
            // Goal add/remove: Blueprint AND LifeLoad recalculate visibly.
            setRefreshing(true);
            setRegenTick((t: number) => t + 1);
            setPanelCache({});
            setTimeout(() => setRefreshing(false), 900);
          }}
        />
      )}
    </div>
  );
}

// ============ MINI PLACEHOLDER WIDGETS ============
function PlaceholderCard({ title, body, tag }: { title: string; body: React.ReactNode; tag?: string }) {
  return (
    <div className="dark-card !p-2 relative">
      {tag && <span className="absolute top-1 right-1 text-[7px] uppercase text-[#d4a843]/80">{tag}</span>}
      <div className="text-[9px] font-bold text-[#e8d5b0]">{title}</div>
      <div className="mt-1">{body}</div>
    </div>
  );
}
function MiniTrend() {
  const points = [10, 22, 18, 30, 28, 40, 35];
  const max = 45;
  return (
    <svg viewBox="0 0 70 22" className="w-full h-6">
      <polyline
        fill="none" stroke="#a3c54a" strokeWidth="1.5"
        points={points.map((p, i) => `${i * 11 + 2},${22 - (p / max) * 18}`).join(" ")}
      />
    </svg>
  );
}
function MiniSnapshot() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const filled = [3, 4, 2, 4, 4, 0, 0];
  return (
    <div className="flex items-end gap-0.5 h-6">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1">
          <div className="w-full rounded-t" style={{ height: `${filled[i] * 4}px`, background: "#4a7c59" }} />
          <span className="text-[7px] text-[#e8d5b0]/70">{d}</span>
        </div>
      ))}
    </div>
  );
}

// ============ Pass-2 REFINEMENT MODAL ============
const REFINE_OPTIONS = [
  "Childcare / caregiving",
  "Eldercare",
  "Planned event this week (wedding, travel, exam, etc.)",
  "Sleep or commute different than usual",
  "Something else affecting my time or energy",
];

function Pass2RefinementModal({ onClose, notes, setNotes }: any) {
  const [ticked, setTicked] = useState<string[]>(notes || []);
  const [followUp, setFollowUp] = useState("");
  const [phase, setPhase] = useState<"tick" | "chat">("tick");
  const toggle = (o: string) => setTicked(ticked.includes(o) ? ticked.filter(x => x !== o) : [...ticked, o]);

  const advance = () => {
    if (ticked.length === 0) { onClose(); return; }
    setPhase("chat");
  };
  const submitFollowUp = () => {
    setNotes([...(notes || []), ...ticked, followUp.trim()].filter(Boolean));
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/50 z-50 flex items-end fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#c8b89a] rounded-t-3xl p-4 border-t-4 border-[#b87333]" style={{ maxHeight: "80%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif-d text-[16px] font-bold text-[#2c1810]">One more thing</h3>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>
        {phase === "tick" ? (
          <>
            <p className="text-[11px] text-[#2c1810]">To make your Blueprint fit your real life — anything below apply to your week?</p>
            <div className="mt-2 space-y-1.5">
              {REFINE_OPTIONS.map(o => (
                <label key={o} className="flex items-center gap-2 bg-[#e8d5a3] border border-[#b87333] rounded-lg p-2 text-[11px] text-[#2c1810]">
                  <input type="checkbox" checked={ticked.includes(o)} onChange={() => toggle(o)} />
                  {o}
                </label>
              ))}
            </div>
            <button onClick={advance} className="btn-copper w-full py-2 text-sm mt-3">
              {ticked.length === 0 ? "Nothing this week — Continue" : "Continue →"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-1 flex items-start gap-2">
              <Aether size={34} />
              <div className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-2xl rounded-tl-sm p-3 text-[11px] text-[#2c1810]">
                Roughly how many hours/week for {ticked.join(", ").toLowerCase()}?
                {ticked.some(t => t.includes("event")) && " And what's the event, and how many hours will it take?"}
              </div>
            </div>
            <textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              className="w-full mt-3 rounded-xl border border-[#b87333] bg-[#e8d5a3] p-2 text-[12px] text-[#2c1810] h-20 outline-none"
              placeholder="Short answer — Aether will fold it in." />
            <button onClick={submitFollowUp} className="btn-copper w-full py-2 text-sm mt-2">Save & continue →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============ MODIFY MODAL ============
function ModifyModal({ allGoals, selectedGoals, goalSliders, tasksPerGoal, onClose, onTasksChanged, onGoalsChanged }: any) {
  const [tab, setTab] = useState<"tasks" | "goals">("tasks");
  const [localTasks, setLocalTasks] = useState<Record<string, string[]>>({ ...tasksPerGoal });
  const [localGoals, setLocalGoals] = useState<string[]>([...selectedGoals]);

  const updateTask = (g: string, i: number, v: string) => {
    const arr = [...(localTasks[g] ?? [])];
    arr[i] = v;
    setLocalTasks({ ...localTasks, [g]: arr });
  };
  const addTask = (g: string) => {
    const arr = [...(localTasks[g] ?? []), ""];
    setLocalTasks({ ...localTasks, [g]: arr });
  };
  const removeTask = (g: string, i: number) => {
    const arr = [...(localTasks[g] ?? [])];
    arr.splice(i, 1);
    setLocalTasks({ ...localTasks, [g]: arr });
  };
  const toggleGoal = (g: string) => {
    setLocalGoals(localGoals.includes(g) ? localGoals.filter(x => x !== g) : [...localGoals, g]);
  };

  const saveTasks = () => { onTasksChanged(localTasks); onClose(); };
  const saveGoals = () => {
    const sliders = { ...goalSliders };
    localGoals.forEach(g => { if (!sliders[g]) sliders[g] = GOAL_DEFAULTS[g] ?? { volatility: 5, traffic: 5 }; });
    onGoalsChanged(localGoals, sliders);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/50 z-50 flex items-end fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#c8b89a] rounded-t-3xl p-4 border-t-4 border-[#b87333]" style={{ maxHeight: "82%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif-d text-[16px] font-bold text-[#2c1810]">Modify</h3>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>
        <div className="flex gap-1 mb-2">
          <button onClick={() => setTab("tasks")} className={`px-3 py-1 rounded-full text-[11px] ${tab === "tasks" ? "bg-[#2d4a1e] text-[#e8d5b0]" : "bg-[#e8d5a3] text-[#2c1810]"}`}>Tasks only</button>
          <button onClick={() => setTab("goals")} className={`px-3 py-1 rounded-full text-[11px] ${tab === "goals" ? "bg-[#2d4a1e] text-[#e8d5b0]" : "bg-[#e8d5a3] text-[#2c1810]"}`}>Goals</button>
        </div>
        <div className="text-[9px] italic text-[#5a3a20] mb-2">
          {tab === "tasks" ? "Editing tasks won't change your LifeLoad." : "Adding or removing goals will recalculate LifeLoad."}
        </div>

        <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 380 }}>
          {tab === "tasks" ? (
            <div className="space-y-2">
              {selectedGoals.map((g: string) => (
                <div key={g} className="bg-[#e8d5a3] border border-[#b87333] rounded-lg p-2">
                  <div className="font-bold text-[11px] text-[#2c1810]">{GOAL_ICONS[g] ?? "✨"} {g}</div>
                  <div className="space-y-1 mt-1">
                    {(localTasks[g] ?? []).map((t: string, i: number) => (
                      <div key={i} className="flex gap-1 items-center">
                        <input value={t} onChange={(e) => updateTask(g, i, e.target.value)}
                          className="flex-1 rounded-full px-3 py-1 text-[11px] bg-white text-[#2c1810] border border-[#b87333]" />
                        <button onClick={() => removeTask(g, i)} className="text-[#c44b3e] text-xs px-1">✕</button>
                      </div>
                    ))}
                    <button onClick={() => addTask(g)} className="text-[10px] text-[#2d4a1e] underline">+ Add task</button>
                  </div>
                </div>
              ))}
              <button onClick={saveTasks} className="btn-copper w-full py-2 text-sm">Save tasks</button>
            </div>
          ) : (
            <div className="space-y-2">
              {allGoals.map((g: string) => {
                const sel = localGoals.includes(g);
                return (
                  <div key={g} onClick={() => toggleGoal(g)} className="goal-card cursor-pointer">
                    <span>{GOAL_ICONS[g] ?? "✨"} {g}</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: sel ? "#4a7c59" : "transparent", border: `2px solid ${sel ? "#4a7c59" : "#d4843a"}`, color: "white" }}>
                      {sel ? "✓" : ""}
                    </div>
                  </div>
                );
              })}
              <button onClick={saveGoals} className="btn-copper w-full py-2 text-sm">Save goals</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ BOTTOM NAV ============
function BottomNav({ onNav, active }: { onNav: (s: number) => void; active: number }) {
  const items = [
    { icon: "🏠", label: "Dashboard", screen: 8 },
    { icon: "☀️", label: "Day", screen: 12 },
    { icon: "👤", label: "Profile", screen: 13 },
  ];
  return (
    <div className="flex justify-around items-center py-1.5 border-t-2 border-[#b87333]" style={{ background: "#2d4a1e" }}>
      {items.map((it) => (
        <button key={it.label} onClick={() => onNav(it.screen)} className="flex flex-col items-center text-[#e8d5b0] relative">
          <span className="text-lg">{it.icon}</span>
          <span className="text-[8px]">{it.label}</span>
          {active === it.screen && <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[#d4a843]" />}
        </button>
      ))}
    </div>
  );
}

// ============ PANELS (Day Boosters / Opportunity Map / Smart Spend) ============
function AISkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-[#e8d5a3] p-2 rounded-lg animate-pulse">
          <div className="h-2 bg-[#b87333]/40 rounded w-1/2 mb-2"></div>
          <div className="h-2 bg-[#b87333]/20 rounded w-full mb-1"></div>
          <div className="h-2 bg-[#b87333]/20 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );
}

function DayBoostersPanel({ userData, panelCache, setPanelCache }: any) {
  const fetchBoosters = useServerFn(getDayBoosters);
  const [data, setData] = useState<any[] | null>(panelCache.boost || null);
  const [loading, setLoading] = useState(!panelCache.boost);
  const [error, setError] = useState(false);

  const load = async (force = false) => {
    if (!force && panelCache.boost) return;
    setLoading(true); setError(false);
    try {
      const res = await fetchBoosters({ data: { userData } });
      setData(res);
      setPanelCache({ ...panelCache, boost: res });
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!panelCache.boost) load(); }, []);

  if (loading) return <AISkeleton />;
  if (error || !data) return (
    <div className="text-center text-[11px] text-[#2c1810] italic">
      Aether is recalibrating…
      <button onClick={() => load(true)} className="btn-copper px-3 py-1 mt-2 text-xs block mx-auto">Retry</button>
    </div>
  );

  return (
    <div className="space-y-2">
      {data.map((b, i) => (
        <div key={i} className="bg-[#e8d5a3] border border-[#b87333] rounded-lg p-2">
          <div className="font-bold text-[12px] text-[#2c1810]">🚀 {b.title}</div>
          <div className="text-[10px] text-[#5a3a20] mt-1">{b.description}</div>
          {b.actionType !== "tip" && b.actionUrl && (
            <a href={b.actionUrl} target="_blank" rel="noopener" className="btn-copper inline-block px-3 py-1 text-[10px] mt-1.5">
              {b.actionType === "youtube" ? "▶ Watch" : "Open App →"}
            </a>
          )}
        </div>
      ))}
      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Regenerate Boosters</button>
    </div>
  );
}

function OpportunityMapPanel({ userData, panelCache, setPanelCache }: any) {
  const fetchOpp = useServerFn(getOpportunityMap);
  const [data, setData] = useState<any[] | null>(panelCache.opp || null);
  const [loading, setLoading] = useState(!panelCache.opp);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<"text" | "visual">("text");

  const load = async (force = false) => {
    if (!force && panelCache.opp) return;
    setLoading(true); setError(false);
    try {
      const res = await fetchOpp({ data: { userData } });
      setData(res);
      setPanelCache({ ...panelCache, opp: res });
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!panelCache.opp) load(); }, []);

  if (loading) return <AISkeleton />;
  if (error || !data) return (
    <div className="text-center text-[11px] text-[#2c1810] italic">
      Aether is recalibrating…
      <button onClick={() => load(true)} className="btn-copper px-3 py-1 mt-2 text-xs block mx-auto">Retry</button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button onClick={() => setMode("text")}
          className={`px-3 py-1 rounded-full text-[10px] ${mode === "text" ? "bg-[#2d4a1e] text-[#e8d5b0]" : "bg-[#e8d5a3] text-[#2c1810]"}`}>Text</button>
        <button onClick={() => setMode("visual")}
          className={`px-3 py-1 rounded-full text-[10px] ${mode === "visual" ? "bg-[#2d4a1e] text-[#e8d5b0]" : "bg-[#e8d5a3] text-[#2c1810]"}`}>Visual</button>
      </div>

      {mode === "text" && data.map((c, i) => (
        <div key={i} className="rounded-lg p-2" style={{ background: "#2d4a1e", color: "#e8d5b0" }}>
          <div className="font-bold text-[12px] text-[#d4a843]">⚡ {c.axis}</div>
          <div className="text-[10px] mt-1">
            <div>• {c.task1} <span className="text-[#a3c54a] text-[8px]">({c.goal1})</span></div>
            <div>• {c.task2} <span className="text-[#a3c54a] text-[8px]">({c.goal2})</span></div>
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[9px] bg-[#4a7c59] text-white px-2 py-0.5 rounded-full">Saves {c.timeSavedPerWeek}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full ${c.difficulty === "Easy" ? "bg-[#4a7c59]" : "bg-[#d4843a]"} text-white`}>{c.difficulty}</span>
          </div>
          <div className="text-[9px] italic mt-1 text-[#e8d5b0]/80">How to: {c.howTo}</div>
        </div>
      ))}

      {mode === "visual" && (
        <div className="space-y-2">
          {data.map((c, i) => (
            <div key={i} className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-lg p-2">
              <div className="font-bold text-[11px] text-[#2c1810]">⚡ {c.axis}</div>
              <div className="flex items-center gap-1 mt-2">
                <FlowBox label={c.task1} sub={c.goal1} />
                <FlowArrow />
                <FlowBox label={c.task2} sub={c.goal2} highlight />
                <FlowArrow />
                <FlowBox label={`Saves ${c.timeSavedPerWeek}`} pill />
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Regenerate Map</button>
    </div>
  );
}

function FlowBox({ label, sub, highlight, pill }: { label: string; sub?: string; highlight?: boolean; pill?: boolean }) {
  return (
    <div
      className={`flex-1 min-w-0 ${pill ? "rounded-full" : "rounded-md"} px-1.5 py-1 text-center`}
      style={{
        background: pill ? "#4a7c59" : highlight ? "#d4a843" : "#2d4a1e",
        color: pill ? "#fff" : highlight ? "#2c1810" : "#e8d5b0",
        border: "1px solid #6b3f1a",
      }}
    >
      <div className="text-[9px] font-bold truncate">{label}</div>
      {sub && <div className="text-[7px] italic truncate opacity-80">{sub}</div>}
    </div>
  );
}
function FlowArrow() {
  return <div className="text-[#6b3f1a] text-xs shrink-0">→</div>;
}

function SmartSpendPanel({ userData, panelCache, setPanelCache }: any) {
  const fetchSpend = useServerFn(getSmartSpend);
  const [data, setData] = useState<any[] | null>(panelCache.spend || null);
  const [loading, setLoading] = useState(!panelCache.spend);
  const [error, setError] = useState(false);

  const load = async (force = false) => {
    if (!force && panelCache.spend) return;
    setLoading(true); setError(false);
    try {
      const res = await fetchSpend({ data: { userData } });
      setData(res);
      setPanelCache({ ...panelCache, spend: res });
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!panelCache.spend) load(); }, []);

  if (loading) return <AISkeleton />;
  if (error || !data) return (
    <div className="text-center text-[11px] text-[#2c1810] italic">
      Aether is recalibrating…
      <button onClick={() => load(true)} className="btn-copper px-3 py-1 mt-2 text-xs block mx-auto">Retry</button>
    </div>
  );

  const urgencyColor = (u: string) => u === "High" ? "bg-[#c44b3e]" : u === "Medium" ? "bg-[#d4843a]" : "bg-[#4a7c59]";

  return (
    <div className="space-y-2">
      {data.map((s, i) => (
        <div key={i} className="bg-[#e8d5a3] border border-[#b87333] rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-[#2c1810] flex-1">{s.product}</span>
            <span className={`text-[8px] px-2 py-0.5 rounded-full text-white ${urgencyColor(s.urgency)}`}>{s.urgency}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-[#b87333] text-[12px]">{s.price}</span>
            <span className="text-[9px] bg-[#4a7c59] text-white px-2 py-0.5 rounded-full">Saves {s.timeSavedPerWeek}</span>
          </div>
          <div className="text-[10px] italic text-[#2c1810] mt-1">{s.insight}</div>
          <a href={s.searchUrl} target="_blank" rel="noopener" className="btn-copper inline-block px-3 py-1 text-[10px] mt-1.5">Search →</a>
        </div>
      ))}
      <div className="text-[8px] italic text-[#5a3a20] text-center">Prices approximate.</div>
      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Regenerate Suggestions</button>
    </div>
  );
}

function SidePanel({ panelId, dist, onClose, onNav, userData, panelCache, setPanelCache }: any) {
  let title = ""; let content: React.ReactNode = null;
  if (panelId === "opp") {
    title = "Opportunity Map";
    content = <OpportunityMapPanel userData={userData} panelCache={panelCache} setPanelCache={setPanelCache} />;
  } else if (panelId === "boost") {
    title = "Day Boosters";
    content = <DayBoostersPanel userData={userData} panelCache={panelCache} setPanelCache={setPanelCache} />;
  } else if (panelId === "spend") {
    title = "Smart Spend";
    content = <SmartSpendPanel userData={userData} panelCache={panelCache} setPanelCache={setPanelCache} />;
  } else if (panelId === "day") {
    title = "Day Blueprint";
    content = (
      <div className="text-[11px] space-y-2">
        {dist.flatMap((d: any) => d.tasks.slice(0, 1).map((t: any, i: number) => (
          <div key={d.goal + i} className="bg-[#e8d5a3] p-2 rounded-lg flex justify-between">
            <span>{t.name}</span><span className="text-[#4a7c59]">{t.minutes} min</span>
          </div>
        )))}
        <button onClick={() => { onClose(); onNav(12); }} className="btn-copper w-full mt-2 py-2 text-xs">View Day Output</button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/40 z-40 flex items-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#c8b89a] rounded-t-3xl p-4 border-t-4 border-[#b87333]" style={{ maxHeight: "70%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif-d text-[18px] font-bold text-[#2c1810]">{title}</h3>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>
        <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 440 }}>{content}</div>
      </div>
    </div>
  );
}

// ============ SCREEN 12 — DAY OUTPUT ============
function Screen12({ username, selectedGoals, goalSliders, tasksPerGoal, totalHoursPerDay,
  resilienceScore, setResilienceScore, reservePool, setReservePool, planningLag, setPlanningLag,
  vaultedTasks, setVaultedTasks, onNav, userProfile, aetherInsights, setAetherInsights }: any) {

  const dist = useMemo(() => computeDistribution(selectedGoals, goalSliders, totalHoursPerDay || 5, tasksPerGoal),
    [selectedGoals, goalSliders, totalHoursPerDay, tasksPerGoal]);

  const allTasks: TaskItem[] = useMemo(() => {
    const list: TaskItem[] = [];
    dist.forEach((d) => d.tasks.forEach((t, i) => {
      list.push({ id: `${d.goal}-${i}`, goal: d.goal, name: t.name, minutes: t.minutes, done: true });
    }));
    return list;
  }, [dist]);

  const [tasks, setTasks] = useState<TaskItem[]>(allTasks);
  const [result, setResult] = useState<null | { type: "A" | "B" | "C" | "D" }>(null);
  const [recalibrating, setRecalibrating] = useState(false);

  useEffect(() => { setTasks(allTasks); }, [allTasks]);

  const toggle = (id: string) => setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const missed = tasks.filter((t) => !t.done);

  const isSaturday = new Date().getDay() === 6;

  const lifeHappened = () => {
    setRecalibrating(true);
    setTimeout(() => {
      setRecalibrating(false);
      if (isSaturday && missed.length > 0) {
        setVaultedTasks([...vaultedTasks, ...missed.map((m: TaskItem) => m.name)]);
        setResilienceScore(resilienceScore + 8);
        setResult({ type: "D" });
      } else if (missed.length <= 2) {
        // Silently use hidden reserve — never show numbers.
        setReservePool({ ...reservePool, usedThisWeek: (reservePool.usedThisWeek || 0) + missed.length * 0.5 });
        setResilienceScore(resilienceScore + 10);
        setResult({ type: "A" });
      } else if (missed.length <= 4) {
        setPlanningLag({ tasks: [...planningLag.tasks, ...missed.map((m: TaskItem) => m.name)], totalMins: planningLag.totalMins + missed.length * 15 });
        setResilienceScore(resilienceScore + 5);
        setResult({ type: "B" });
      } else {
        setPlanningLag({ tasks: [...planningLag.tasks, ...missed.map((m: TaskItem) => m.name)], totalMins: planningLag.totalMins + missed.length * 20 });
        setResilienceScore(resilienceScore + 3);
        setResult({ type: "C" });
      }
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <AetherProactiveInsight
            screenName="Day Output"
            userData={{ username, completedTasks: tasks.filter(t => t.done).map(t => t.name), missedTasks: missed.map(m => m.name), timeOfDay: new Date().getHours() }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
        <Logo size={22} />
      </div>

      <div className="px-4">
        <h2 className="font-serif-d text-[20px] font-bold text-[#2c1810]">How was your day?</h2>
        <div className="text-[10px] text-[#5a3a20]">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        <div className="text-[11px] font-bold text-[#2c1810] mt-2">Performance Recap (Auto-Validated)</div>
        <div className="text-[9px] italic text-[#5a3a20]">I've marked your tasks as done {username}. Untick anything life didn't allow — no judgment.</div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-3 mt-2 space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="bg-[#e8d5a3] border border-[#b87333] rounded-xl p-2 flex items-center gap-2">
            <button onClick={() => toggle(t.id)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: t.done ? "#4a7c59" : "transparent",
                border: `2px solid ${t.done ? "#4a7c59" : "#c44b3e"}`,
                color: "white",
              }}>{t.done ? "✓" : ""}</button>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-[#2c1810]">{t.name}</div>
              <div className="text-[9px] text-[#5a3a20]">{t.goal} • {t.minutes} min</div>
            </div>
          </div>
        ))}
      </div>

      {missed.length > 0 && !result && (
        <div className="px-3 py-2 space-y-1">
          <div className="text-[10px] text-[#2c1810]">Tasks missed: {missed.length}</div>
          <button onClick={lifeHappened} className="btn-copper w-full py-2 text-xs">LIFE HAPPENED</button>
          <div className="text-[9px] text-center text-[#5a3a20] italic">Aether will recalibrate — no guilt, no penalty.</div>
        </div>
      )}

      {recalibrating && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#e8d5a3] p-5 rounded-2xl text-center">
            <BigGear size={60} spin />
            <div className="text-[12px] font-bold text-[#2c1810] mt-2">Aether is Aetherizing your week…</div>
          </div>
        </div>
      )}

      {result && (
        <div className="px-3 py-2">
          <div className="p-3 rounded-xl text-white" style={{
            background: result.type === "A" ? "#4a7c59" :
              result.type === "B" ? "#d4a843" :
                result.type === "C" ? "#d4843a" : "#3a6f9c",
          }}>
            <div className="font-bold text-[13px]">
              {result.type === "A" && "Day Healed ✓"}
              {result.type === "B" && "Partially Healed ✓"}
              {result.type === "C" && "Blueprint Recalibrated"}
              {result.type === "D" && "Tasks Vaulted Safely ✓"}
            </div>
            <div className="text-[10px] mt-1">
              {result.type === "A" && "I've absorbed the missed work — your blueprint stays intact."}
              {result.type === "B" && "Some was absorbed, the rest redistributed across your week."}
              {result.type === "C" && "High-priority tasks protected. The rest redistributed."}
              {result.type === "D" && "Tasks moved to Saturday Vault. Your week stays on track."}
            </div>
          </div>
          <button onClick={() => { setResult(null); setTasks(tasks.map((t) => ({ ...t, done: true }))); }}
            className="btn-olive w-full py-1.5 text-xs mt-2">Continue</button>
        </div>
      )}

      <BottomNav onNav={onNav} active={12} />
    </div>
  );
}

// ============ SCREEN 13 — PROFILE (with optional demographics) ============
function Screen13({ username, profession, userProfile, setUserProfile, selectedGoals, vaultedTasks, onNav }: any) {
  const [editing, setEditing] = useState(false);
  const [age, setAge] = useState(userProfile?.age || "");
  const [gender, setGender] = useState(userProfile?.gender || "");
  const [location, setLocation] = useState(userProfile?.location || "");
  const tasksPlanned = selectedGoals.length * 4;

  const save = () => {
    setUserProfile({ age, gender, location });
    setEditing(false);
    toast.success("Optional details saved");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between">
        <Logo size={26} />
      </div>
      <div className="px-4 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
          style={{ background: "radial-gradient(circle, #d4a843, #b87333 60%, #6b3f1a)", border: "3px solid #6b3f1a", color: "#fff" }}>
          {(username?.[0] || "?").toUpperCase()}
        </div>
        <h2 className="font-serif-d text-[22px] font-bold text-[#2c1810] mt-2">{username || "Friend"}</h2>
        <div className="text-[11px] text-[#5a3a20]">{profession || "—"} · DoneHo member</div>
      </div>

      <div className="px-4 mt-4">
        <div className="text-[11px] font-bold text-[#2c1810] mb-2">Weekly Snapshot <span className="text-[9px] italic text-[#5a3a20]">(mock)</span></div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Weeks planned", value: "1" },
            { label: "Tasks planned", value: String(tasksPlanned) },
            { label: "Goals active", value: String(selectedGoals.length) },
            { label: "Vaulted safely", value: String(vaultedTasks?.length || 0) },
          ].map((s) => (
            <div key={s.label} className="bg-[#e8d5a3] border border-[#b87333] rounded-lg p-2">
              <div className="text-[18px] font-bold text-[#2d4a1e]">{s.value}</div>
              <div className="text-[9px] text-[#5a3a20]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional demographic fields — clearly separate, non-blocking */}
      <div className="px-4 mt-4">
        <div className="bg-[#e8d5a3]/60 border border-dashed border-[#b87333] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#2c1810]">Optional details</div>
              <div className="text-[9px] italic text-[#5a3a20]">Optional — helps with future personalization features.</div>
            </div>
            <button onClick={() => setEditing(!editing)} className="btn-olive px-2 py-0.5 text-[10px]">{editing ? "Cancel" : "Edit"}</button>
          </div>
          {!editing ? (
            <div className="text-[11px] text-[#2c1810] mt-2 space-y-0.5">
              <div>Age: {userProfile?.age || <span className="italic text-[#5a3a20]">not set</span>}</div>
              <div>Gender: {userProfile?.gender || <span className="italic text-[#5a3a20]">not set</span>}</div>
              <div>Location: {userProfile?.location || <span className="italic text-[#5a3a20]">not set</span>}</div>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <input value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Age" className="input-pill w-full text-sm" />
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="input-pill w-full text-sm">
                <option value="">Gender</option>
                <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
              </select>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="City" className="input-pill w-full text-sm" />
              <button onClick={save} className="btn-copper w-full py-1.5 text-[11px]">Save</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />
      <BottomNav onNav={onNav} active={13} />
    </div>
  );
}
