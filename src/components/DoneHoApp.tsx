import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAether, getAetherInsight, getDayBoosters, getOpportunityMap, getSmartSpend } from "@/lib/aether.functions";


// ============ TYPES ============
type GoalKey = string;
interface GoalSliders { volatility: number; traffic: number; }
interface TaskItem { id: string; goal: string; name: string; minutes: number; done: boolean; }

// ============ CONSTANTS ============
const DEFAULT_GOALS = [
  "Health and Wellness",
  "Study and Learning",
  "Entertainment and Leisure",
  "Life Skills and Improvement",
  "Finance Planning and Budget",
  "Household Management",
  "Child/Elderly Care",
  "Career Planning",
];

const GOAL_DEFAULTS: Record<string, GoalSliders> = {
  "Career Planning": { volatility: 5, traffic: 8 },
  "Child/Elderly Care": { volatility: 9, traffic: 7 },
  "Health and Wellness": { volatility: 3, traffic: 5 },
  "Household Management": { volatility: 6, traffic: 3 },
  "Finance Planning and Budget": { volatility: 2, traffic: 7 },
  "Entertainment and Leisure": { volatility: 1, traffic: 1 },
  "Study and Learning": { volatility: 4, traffic: 8 },
  "Life Skills and Improvement": { volatility: 3, traffic: 5 },
};

const GOAL_MULTIPLIERS: Record<string, number> = {
  "Child/Elderly Care": 1.3,
  "Career Planning": 1.2,
  "Study and Learning": 1.1,
  "Health and Wellness": 0.8,
  "Household Management": 0.9,
  "Entertainment and Leisure": -0.5,
  "Finance Planning and Budget": 1.0,
  "Life Skills and Improvement": 0.9,
};

const GOAL_ICONS: Record<string, string> = {
  "Health and Wellness": "🌿",
  "Study and Learning": "📚",
  "Entertainment and Leisure": "🎭",
  "Life Skills and Improvement": "⚙️",
  "Finance Planning and Budget": "💰",
  "Household Management": "🏠",
  "Child/Elderly Care": "👶",
  "Career Planning": "💼",
};

function suggestionFor(task: string): string {
  const t = task.toLowerCase();
  if (/(course|module|class)/.test(t)) return "Integrate with low focus kitchen works. Use 1.5x speed for recap.";
  if (/(interview|prep|mock)/.test(t)) return "AI Mocks, mirror self interviews, practice with Yoodli app.";
  if (/(project|portfolio|freelance)/.test(t)) return "Connect with freelancers, check out peers in DoneHo community.";
  if (/(notes|writing|documentation)/.test(t)) return "Voice notes in mobile recorder, AI voice to text conversion.";
  if (/(feeding|baby|infant)/.test(t)) return "Work division with partner, pumping & storing, age-specific toys.";
  if (/(workout|exercise|gym)/.test(t)) return "Combine with audio learning, track with wearable, morning slot preferred.";
  if (/(cooking|meal|kitchen)/.test(t)) return "Batch cook weekends, 3-tier steamer, combine with podcast.";
  if (/(budget|finance|savings)/.test(t)) return "Use Walnut or YNAB, review weekly, automate SIPs.";
  if (/(meditation|yoga)/.test(t)) return "Morning slot before phone, breathing exercises, 10 mins minimum.";
  if (/(reading|book|study)/.test(t)) return "Text-to-speech during commute, 20 pages per day minimum.";
  if (/(cleaning|chores)/.test(t)) return "Batch on weekends, delegate to family, robotic vacuum daily.";
  if (/(health|recovery)/.test(t)) return "Combine gentle movement with audio, track symptoms daily.";
  return "Break into 10-minute chunks. Track daily. Celebrate small wins.";
}

// ============ SUB COMPONENTS ============
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
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={spin ? (rev ? "gear-spin-rev" : "gear-spin") : ""}
    >
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
      className="relative flex items-center justify-center rounded-full"
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

function ResilienceGauge({ score }: { score: number }) {
  const label = score >= 90 ? "Thriving" : score >= 70 ? "Resilient" : score >= 50 ? "Recovering" : "Rebuilding";
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{
          background: "radial-gradient(circle, #d4a843, #b87333 60%, #6b3f1a)",
          border: "2px solid #6b3f1a",
        }}
      >
        {score}
      </div>
      <span className="text-[9px] text-[#2c1810] font-semibold mt-0.5">{label}</span>
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
    } catch (e) {
      setInsight("I'm recalibrating my gears... tap refresh to try again ⚙️");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [screenName, JSON.stringify(userData)]); // re-run if major data changes

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

// ============ MAIN APP ============
export default function DoneHoApp() {
  // ---- GLOBAL STATE ----
  const [screen, setScreen] = useState<number>(1);
  const [username, setUsername] = useState<string>("");
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>([]);
  const [allGoals, setAllGoals] = useState<string[]>(DEFAULT_GOALS);
  const [goalSliders, setGoalSliders] = useState<Record<string, GoalSliders>>({});
  const [totalHoursPerDay, setTotalHoursPerDay] = useState<number>(0);
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
  const [userProfile, setUserProfile] = useState<{ location?: string }>({});
  const [aetherInsights, setAetherInsights] = useState<Record<string, string>>({});
  const [panelCache, setPanelCache] = useState<Record<string, any>>({});
  const [vaultedTasks, setVaultedTasks] = useState<string[]>([]);

  const goNext = (n: number) => { setScreen(n); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#1a1410" }}>
      <div
        className="parchment-bg relative overflow-hidden shadow-2xl"
        style={{
          width: 375, height: 812,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px #6b3f1a",
        }}
      >
        <div key={screen} className="fade-in w-full h-full overflow-y-auto thin-scroll">
          {screen === 1 && <Screen1 onJoin={(u) => { setUsername(u); goNext(3); }} onLogin={() => goNext(2)} />}
          {screen === 2 && <Screen2 onVerified={() => goNext(3)} onSignup={() => goNext(1)} />}
          {screen === 3 && (
            <Screen3
              onContinue={(name, loc) => { setUsername(name); setUserProfile({ location: loc }); goNext(4); }}
              onSkip={() => { if (!username) setUsername("Friend"); goNext(4); }}
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
                const sliders: Record<string, GoalSliders> = {};
                selectedGoals.forEach((g) => {
                  sliders[g] = GOAL_DEFAULTS[g] ?? { volatility: 5, traffic: 5 };
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
              reservePool={reservePool}
              onAetherize={() => goNext(7)}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
            />
          )}
          {screen === 7 && <Screen7 username={username} onContinue={() => goNext(8)} />}
          {screen === 8 && (
            <Screen8
              username={username}
              selectedGoals={selectedGoals}
              goalSliders={goalSliders}
              tasksPerGoal={tasksPerGoal}
              totalHoursPerDay={totalHoursPerDay}
              resilienceScore={resilienceScore}
              vaultedTasks={vaultedTasks}
              reservePool={reservePool}
              planningLag={planningLag}
              onNav={(s: number) => goNext(s)}
              userProfile={userProfile}
              aetherInsights={aetherInsights}
              setAetherInsights={setAetherInsights}
              panelCache={panelCache}
              setPanelCache={setPanelCache}
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
    if (!email || !pw || !cpw) return toast.error("All fields required");
    if (!email.includes("@") && !/^[A-Za-z0-9._-]{3,}$/.test(email)) return toast.error("Please enter valid email");
    if (email.includes("@") && !email.includes("@")) return toast.error("Please enter valid email");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== cpw) return toast.error("Passwords don't match");
    const uname = email.includes("@") ? email.split("@")[0] : email;
    toast.success("Welcome to DoneHo!");
    onJoin(uname);
  };

  return (
    <div className="p-5 pt-6 flex flex-col items-center min-h-full">
      <div className="flex flex-col items-center mb-6">
        <BigGear size={68} />
        <h1 className="font-serif-d text-[36px] font-bold text-[#2c1810] mt-1">DoneHo</h1>
        <p className="text-[13px] text-[#2c1810] font-semibold">Better Days for the Best</p>
        <p className="text-[11px] italic text-[#5a3a20] mt-0.5 mb-4">Your day, synchronized</p>
        
        <div className="bg-[#e8d5a3]/70 border border-[#b87333]/50 rounded-xl p-4 text-center space-y-2 w-full max-w-[320px]">
          <h3 className="font-bold text-[#2d4a1e] text-[14px]">Your Personal Resilience Engine</h3>
          <p className="text-[12px] text-[#2c1810] leading-snug">
            DoneHo isn't just a task list. It builds a personalized weekly blueprint based on your life load, 
            available hours, and unexpected interruptions. No guilt, no stress.
          </p>
        </div>
      </div>

      <div className="w-full mt-5 space-y-3">
        <input className="input-pill" placeholder="Email or Username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input
            className="input-pill pr-10" type={showPw ? "text" : "password"}
            placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)}
          />
          <button onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8a5424]">
            {showPw ? "🙈" : "👁"}
          </button>
        </div>
        <div className="relative">
          <input
            className="input-pill pr-10" type={showCpw ? "text" : "password"}
            placeholder="Confirm Password" value={cpw} onChange={(e) => setCpw(e.target.value)}
          />
          <button onClick={() => setShowCpw(!showCpw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8a5424]">
            {showCpw ? "🙈" : "👁"}
          </button>
        </div>
      </div>

      <button onClick={submit} className="btn-olive w-full mt-5 py-3 flex items-center justify-center gap-2 text-sm">
        <span>⚙️</span> Join DoneHo (Sign up)
      </button>

      <div className="mt-auto pt-6 flex items-center gap-2">
        <span className="text-[12px] text-[#2c1810]">Already a user?</span>
        <button onClick={onLogin} className="btn-olive px-4 py-1.5 text-xs">Log In 🔒</button>
      </div>
    </div>
  );
}

// ============ SCREEN 2 LOGIN ============
function Screen2({ onVerified, onSignup }: { onVerified: () => void; onSignup: () => void }) {
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const [verified, setVerified] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const onOtp = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = [...otp];
    arr[i] = v;
    setOtp(arr);
    if (v && i < 3) refs.current[i + 1]?.focus();
  };
  const onOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const isInputValid = tab === "phone" ? /^\d{10}$/.test(phone) : email.includes("@");

  const sendOtp = () => {
    setOtpSent(true);
    toast.success("OTP sent successfully! ✅");
    setCountdown(45);
  };

  const verify = () => {
    if (otp.join("").length !== 4) return toast.error("Please enter 4-digit OTP");
    setVerified(true);
    setTimeout(onVerified, 1000);
  };

  return (
    <div className="p-5 flex flex-col items-center min-h-full">
      <Logo size={38} />
      <h2 className="font-serif-d text-[28px] font-bold text-[#2c1810] mt-3">Login</h2>

      <div className="flex w-full mt-3 border-b-2 border-[#b87333]/30">
        {(["phone", "email"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setOtpSent(false); setOtp(["","","",""]); }}
            className={`flex-1 py-2 text-sm font-semibold relative ${tab === t ? "text-[#2c1810]" : "text-[#5a3a20]/60"}`}>
            {t === "phone" ? "Phone Number" : "Email ID"}
            {tab === t && <div className="absolute bottom-[-2px] left-1/4 right-1/4 h-1 bg-[#b87333] rounded" />}
          </button>
        ))}
      </div>

      <div className="w-full mt-4">
        {tab === "phone" ? (
          <div className="input-pill flex items-center gap-2">
            <span>🇮🇳 +91</span>
            <input className="flex-1 bg-transparent outline-none" inputMode="numeric" maxLength={10}
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" />
          </div>
        ) : (
          <input className="input-pill" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
      </div>

      {!otpSent && (
        <button onClick={sendOtp} disabled={!isInputValid}
          className={`btn-olive w-full mt-5 py-3 text-sm ${!isInputValid ? 'opacity-40 grayscale' : ''}`}>
          Send OTP
        </button>
      )}

      {otpSent && (
        <div className="w-full mt-4 fade-in">
          <div className="text-[12px] text-[#2c1810] font-semibold mb-2 text-center">Mobile OTP / Email OTP</div>
          <div className="flex gap-2 justify-center">
            {otp.map((v, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={v} onChange={(e) => onOtp(i, e.target.value)} onKeyDown={(e) => onOtpKey(i, e)}
                maxLength={1} inputMode="numeric"
                className="w-12 h-12 text-center text-lg font-bold rounded-lg"
                style={{ background: "#e8d5a3", border: "2px solid #b87333", color: "#2c1810" }}
              />
            ))}
          </div>

          <button onClick={verify} className="btn-olive w-full mt-5 py-3 text-sm relative">
            {verified ? <span className="text-2xl">✅</span> : "Verify OTP"}
          </button>

          {countdown > 0 ? (
            <div className="mt-3 text-[12px] text-[#5a3a20]/70 font-semibold text-center">
              Resend OTP in 0:{countdown.toString().padStart(2, "0")}
            </div>
          ) : (
            <button onClick={sendOtp} className="mt-3 text-[12px] text-[#2d4a1e] font-semibold block mx-auto underline">
              Resend OTP
            </button>
          )}
        </div>
      )}

      <button className="mt-auto text-[11px] text-[#4a7c59] underline">Forgot Login Credentials?</button>

      <div className="mt-3 pt-2 text-[12px] text-[#2c1810]">
        New to DoneHo?{" "}
        <button onClick={onSignup} className="italic text-[#2d4a1e] font-bold underline">Sign up</button>
      </div>
    </div>
  );
}

// ============ SCREEN 3 PROFILE ============
const FALLBACK_CITIES = [
  "New York, United States", "London, United Kingdom", "Tokyo, Japan", "Paris, France", 
  "Singapore, Singapore", "Dubai, United Arab Emirates", "Sydney, Australia", "Mumbai, India", 
  "Toronto, Canada", "Berlin, Germany", "Hong Kong, China", "Seoul, South Korea",
  "Los Angeles, United States", "Chicago, United States", "Rome, Italy", "Madrid, Spain",
  "Amsterdam, Netherlands", "São Paulo, Brazil", "Istanbul, Turkey", "Delhi, India"
];

const PROFESSIONS = [
  "Accountant", "Actor", "Architect", "Artist", "Astronomer",
  "Banker", "Biologist", "Business Analyst", "Chef", "Civil Engineer",
  "Coach", "Consultant", "Content Creator", "Copywriter", "Data Analyst",
  "Data Scientist", "Dentist", "Designer", "Doctor", "Driver",
  "Economist", "Electrician", "Entrepreneur", "Event Planner", "Fashion Designer",
  "Financial Analyst", "Freelancer", "Graphic Designer", "HR Professional", "Homemaker",
  "Journalist", "Judge", "Lawyer", "Lecturer", "Librarian",
  "Manager", "Marketing Professional", "Mechanical Engineer", "Nurse", "Nutritionist",
  "Pharmacist", "Photographer", "Physiotherapist", "Pilot", "Plumber",
  "Police Officer", "Product Manager", "Professor", "Psychologist", "Real Estate Agent",
  "Researcher", "Retired", "Sales Executive", "Social Worker", "Software Engineer",
  "Student", "Surgeon", "Teacher", "UX Designer", "Veterinarian",
  "Web Developer", "Writer", "Yoga Instructor"
];

function Screen3({ onContinue, onSkip }: { onContinue: (n: string, loc: string) => void; onSkip: () => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [loc, setLoc] = useState("");
  const [prof, setProf] = useState("");
  const [locFocused, setLocFocused] = useState(false);
  const [profFocused, setProfFocused] = useState(false);
  const [locMatches, setLocMatches] = useState<string[]>([]);
  const [locLoading, setLocLoading] = useState(false);

  useEffect(() => {
    if (!loc || loc.length < 2) {
      setLocMatches([]);
      setLocLoading(false);
      return;
    }
    setLocLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&addressdetails=1&limit=6&featuretype=city`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        const results = data.map((place: any) => {
          const city = place.address?.city || place.address?.town || place.address?.village || place.name;
          const country = place.address?.country;
          if (!city || !country) return null;
          return `${city}, ${country}`;
        }).filter(Boolean);
        
        // Remove duplicates
        const uniqueResults = Array.from(new Set(results)) as string[];
        setLocMatches(uniqueResults);
      } catch (err) {
        // Fallback to static list
        const lower = loc.toLowerCase();
        setLocMatches(FALLBACK_CITIES.filter(c => c.toLowerCase().includes(lower)).slice(0, 6));
      } finally {
        setLocLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [loc]);

  const profMatches = useMemo(() => {
    if (!prof || prof.length < 1) return [];
    const lower = prof.toLowerCase();
    return PROFESSIONS
      .filter(p => p.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(lower);
        const bStarts = b.toLowerCase().startsWith(lower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 6);
  }, [prof]);

  const submit = () => {
    if (!name.trim()) return toast.error("Name is required");
    if (age && (Number(age) < 10 || Number(age) > 100)) return toast.error("Age must be 10-100");
    if (loc && locMatches.length === 0 && loc.length < 3) return toast.error("Please enter a valid city or location");
    if (prof && profMatches.length === 0 && prof.length < 3) return toast.error("Please enter a valid profession");
    onContinue(name.trim(), loc.trim());
  };

  return (
    <div className="p-5 flex flex-col min-h-full">
      <Logo size={32} />
      <h2 className="font-serif-d text-[24px] font-bold text-[#2c1810] mt-3 leading-tight">Let's Get to Know You</h2>
      <p className="text-[11px] text-[#5a3a20] mt-1">A few more details to create your personalized time map</p>

      <div className="space-y-3 mt-4 flex-1">
        <div className="input-pill flex items-center gap-2">
          <span>👤</span>
          <input className="flex-1 bg-transparent outline-none" placeholder="Name (Required)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="input-pill flex items-center gap-2">
          <span>📅</span>
          <input className="flex-1 bg-transparent outline-none" placeholder="Age" inputMode="numeric"
            value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </div>
        <div className="input-pill flex items-center gap-2">
          <span>⚧</span>
          <select className="flex-1 bg-transparent outline-none" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Gender</option>
            <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
          </select>
        </div>

        <div className="relative">
          <div className="input-pill flex items-center gap-2">
            <span>📍</span>
            <input className="flex-1 bg-transparent outline-none" placeholder="Location (eg; City)" value={loc}
              onChange={(e) => setLoc(e.target.value)}
              onFocus={() => setLocFocused(true)} onBlur={() => setTimeout(() => setLocFocused(false), 150)} />
            {locLoading && <div className="w-3 h-3 border-2 border-[#b87333] border-t-transparent rounded-full animate-spin" />}
          </div>
          {locFocused && loc.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-[#e8d5a3] border-2 border-[#b87333] rounded-2xl shadow-xl overflow-hidden">
              {locMatches.length > 0 ? locMatches.map(c => (
                <div key={c} onMouseDown={(e) => { e.preventDefault(); setLoc(c); setLocFocused(false); }} className="px-4 py-2 text-[13px] text-[#2c1810] hover:bg-[#b87333] hover:text-white cursor-pointer border-b border-[#b87333]/20 last:border-0">{c}</div>
              )) : (
                <div className="px-4 py-2 text-[11px] text-[#8a5424] italic">{locLoading ? "Searching..." : "No matching location found. Try another city name."}</div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <div className="input-pill flex items-center gap-2">
            <span>💼</span>
            <input className="flex-1 bg-transparent outline-none" placeholder="Profession" value={prof}
              onChange={(e) => setProf(e.target.value)}
              onFocus={() => setProfFocused(true)} onBlur={() => setTimeout(() => setProfFocused(false), 150)} />
          </div>
          {profFocused && prof.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-[#e8d5a3] border-2 border-[#b87333] rounded-2xl shadow-xl overflow-hidden">
              {profMatches.length > 0 ? profMatches.map(p => (
                <div key={p} onMouseDown={(e) => { e.preventDefault(); setProf(p); setProfFocused(false); }} className="px-4 py-2 text-[13px] text-[#2c1810] hover:bg-[#b87333] hover:text-white cursor-pointer border-b border-[#b87333]/20 last:border-0">{p}</div>
              )) : (
                <div className="px-4 py-2 text-[11px] text-[#8a5424] italic">Please enter a valid profession</div>
              )}
            </div>
          )}
        </div>
      </div>

      <button onClick={submit} className="btn-olive w-full mt-4 py-3 flex items-center justify-center gap-2 text-sm">
        <span>⚙️</span> Continue to your day
      </button>
      <button onClick={onSkip} className="mt-2 text-[12px] text-[#2c1810] underline mx-auto">Skip for now</button>

      <div className="mt-3 pt-2">
        <ProgressBar pct={25} label="Profile completion" />
      </div>
    </div>
  );
}

// ============ SCREEN 4 GOALS ============
function Screen4({ username, allGoals, setAllGoals, selectedGoals, setSelectedGoals, onGenerate, userProfile, aetherInsights, setAetherInsights }: any) {
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartMic, setChatStartMic] = useState(false);

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
    if (selectedGoals.length === 0) return toast.error("Please select at least one goal");
    onGenerate();
  };

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <div className="flex items-start justify-between">
        <Logo size={28} />
        <div className="flex-1 ml-2">
          <AetherProactiveInsight
            screenName="Goal Selection"
            userData={{ username, selectedGoals, hasLeisure: selectedGoals.includes('Entertainment and Leisure'), timeOfDay: new Date().getHours(), location: userProfile.location }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
      </div>
      <h2 className="font-serif-d text-[22px] font-bold text-[#2c1810] mt-2">Welcome {username}</h2>
      <p className="text-[11px] text-[#5a3a20]">Select your focus. Aether engineers the rest</p>

      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => { setChatStartMic(false); setChatOpen(true); }} className="btn-olive px-3 py-1 text-[11px]">Ask me ∞</button>
        <button onClick={() => { setChatStartMic(true); setChatOpen(true); }} className="btn-copper px-2 py-1 text-[11px]">🎤</button>
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
            <input className="input-pill flex-1" placeholder="eg; Learn French, Yoga" value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)} />
            <button onClick={addGoal} className="btn-copper px-3 text-xs">Add</button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <button onClick={generate} className="btn-olive w-full py-2.5 flex items-center justify-center gap-2 text-[13px]">
          <span>⚙️</span> Generate Resilient Blueprint
        </button>
        <div className="flex items-center justify-between text-[11px] text-[#2c1810]">
          <span>Don't see your goal?</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setAdding(true)} className="btn-olive px-3 py-1 text-[10px]">+ Add goal</button>
            <button onClick={generate} className="underline">Skip</button>
          </div>
        </div>
        <ProgressBar pct={60} label="Profile completion" />
      </div>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} startWithMic={chatStartMic} />}
    </div>
  );
}

// ============ AETHER KNOWLEDGE ============
const AETHER_KNOWLEDGE: { match: RegExp; text: string }[] = [
  { match: /(what is doneho|how does doneho work|about doneho)/i, text: "DoneHo is your empathetic day planner, [username]! I'm Aether, your resilience engine. Together we build a blueprint of your week based on your real life — goals, energy, and unexpected moments included." },
  { match: /resilience\s*score|my score/i, text: "Your Resilience Score starts at 70 and only goes up, [username]! It measures how well you adapt when life interrupts. Complete tasks, use reserve hours, or vault tasks to Saturday — each action earns points. Tiers: Thriving (90-100), Resilient (70-89), Recovering (50-69), Rebuilding (below 50)." },
  { match: /reserve\s*hour|safety net/i, text: "Reserve hours are your hidden safety net, [username]. I quietly keep 1 hour/day (7 hrs/week) in reserve. When you miss tasks and tap 'Life Happened', I use these reserve hours to heal your day — no guilt, no punishment!" },
  { match: /vault|saturday/i, text: "The Vault is your Saturday safety net, [username]! When reserve hours run out and tasks are still missed, I move them safely to your Saturday Vault. Open it on weekends to catch up stress-free." },
  { match: /life\s*load/i, text: "Life Load is your weekly stress meter, [username]. It combines how unpredictable (Volatility) and mentally demanding (Traffic) your goals are. Too high and your engine overheats — I'll warn you before that happens!" },
  { match: /volatility|unpredictab/i, text: "Volatility measures how unpredictable a goal is, [username]. Childcare can change every hour — high volatility. Your gym workout happens on your own terms — low volatility. Honest input helps me protect you better!" },
  { match: /traffic|mental energy|focus level/i, text: "Traffic means mental energy needed, [username]. Career planning needs 100% of your brain — high traffic. Entertainment needs almost none — low traffic. It's not about time, it's about focus!" },
  { match: /blueprint/i, text: "Your Blueprint is your personalized week plan, [username]! I calculate exactly how many minutes each task needs based on your hours, goals, and life load. It's always fair and always adjustable." },
  { match: /who are you|what are you|aether/i, text: "I'm Aether — your steampunk resilience companion, [username]! I live inside DoneHo to make sure your week never falls apart completely. Think of me as the engineer keeping your life's gears turning smoothly." },
  { match: /how (to|do i) use|getting started|how to start|guide me/i, text: "Here's your journey, [username]: Set up your profile → Pick your life goals → Calibrate your energy levels → Allot your daily hours → Get your Blueprint → Check in daily on Day Output. I'll guide you every step!" },
  { match: /goal|select goal|which goal/i, text: "Choose goals that matter to YOU right now, [username]. You can select multiple — I'll balance them. If life gets too intense (Life Load above 8.5), I'll ask you to reduce intensity, not give up goals entirely." },
];

// ============ AETHER CHAT POPUP ============
function AetherChat({ username, onClose, startWithMic = false }: {
  username: string; onClose: () => void; startWithMic?: boolean;
}) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Hi ${username}! I'm Aether, your resilience companion ⚙️ Ask me anything about DoneHo — what terms mean, how to navigate, or how your Blueprint works. I'm here to keep your gears turning smoothly!` }
  ]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (startWithMic) setTimeout(() => toggleMic(), 200);
    return () => { try { recogRef.current?.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported on this browser. Please type your question."); return; }
    if (recording) { try { recogRef.current?.stop(); } catch {} setRecording(false); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onstart = () => setRecording(true);
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput((prev) => prev ? prev + " " + t : t);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access needed. Please allow in browser settings.");
      }
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recogRef.current = rec;
    try { rec.start(); } catch { setRecording(false); }
  };

  const fetchChat = useServerFn(chatWithAether);

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
    } catch (e) {
      // Fallback if API fails
      setMsgs([...newHistory, { role: "assistant", content: `My signal got disrupted! Try again — I'm still here ⚙️` }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-end z-50 fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#c8b89a] rounded-t-3xl border-t-4 border-[#b87333] shadow-2xl flex flex-col"
        style={{ height: "70%" }}>
        <div className="flex items-center justify-between p-3 border-b border-[#b87333]/30 bg-[#c8b89a] rounded-t-3xl">
          <div className="flex items-center gap-2"><Aether size={32} /><span className="font-bold text-[#2c1810]">Aether</span></div>
          <button onClick={onClose} className="text-[#2c1810] text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#b87333]/20">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2 bg-[#c8b89a]">
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
          {recording && <div className="text-[11px] text-red-600 font-bold flex items-center gap-1"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />Listening...</div>}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 p-3 border-t border-[#b87333]/30 bg-[#c8b89a]">
          <div className="flex-1 relative">
            <input ref={inputRef} className="input-pill w-full pr-10" placeholder="Ask Aether..." value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button onClick={toggleMic} className={`absolute right-3 top-1/2 -translate-y-1/2 text-base ${recording ? "text-red-600 animate-pulse" : "text-[#8a5424]"}`}>🎤</button>
          </div>
          <button onClick={send} disabled={typing} className={`btn-copper px-4 text-xs ${typing ? 'opacity-50' : ''}`}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ============ SCREEN 5 PRIORITY BLUEPRINT ============
function computeLifeLoad(selected: string[], sliders: Record<string, GoalSliders>): number {
  if (selected.length === 0) return 0;
  let sum = 0;
  selected.forEach((g) => {
    const s = sliders[g] ?? { volatility: 5, traffic: 5 };
    const raw = (s.volatility + s.traffic) / 2;
    const mult = GOAL_MULTIPLIERS[g] ?? 1.0;
    sum += raw * mult;
  });
  return Math.max(0, sum / selected.length);
}

function Screen5({ username, selectedGoals, goalSliders, setGoalSliders, onActivate, onModify, userProfile, aetherInsights, setAetherInsights }: any) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartMic, setChatStartMic] = useState(false);
  const lifeLoad = useMemo(() => computeLifeLoad(selectedGoals, goalSliders), [selectedGoals, goalSliders]);

  const updateSlider = (g: string, key: keyof GoalSliders, val: number) => {
    setGoalSliders({ ...goalSliders, [g]: { ...goalSliders[g], [key]: val } });
  };

  const aetherMsg =
    lifeLoad <= 3 ? "Great balance! Your engine is ready." :
    lifeLoad <= 5 ? "Good load. Manageable week ahead." :
    lifeLoad <= 7 ? "Moderate load. Watch your energy levels." :
    lifeLoad <= 8 ? "This looks challenging. Don't worry — allot your time wisely, I will assist you." :
    lifeLoad <= 8.5 ? "Heavy load detected. Consider reducing one goal's intensity." :
    `This load is beyond what I can protect ${username}. Please reduce at least one goal.`;

  const blocked = lifeLoad > 8.5;
  const needleAngle = -90 + Math.min(180, (lifeLoad / 10) * 180);
  const meterColor = lifeLoad <= 3 ? "#4a7c59" : lifeLoad <= 5 ? "#a3c54a" : lifeLoad <= 7 ? "#d4a843" : lifeLoad <= 8 ? "#d4843a" : "#c44b3e";

  // cross-goal warnings
  const warns: string[] = [];
  const cs = goalSliders["Child/Elderly Care"], cr = goalSliders["Career Planning"];
  if (cs?.volatility > 8 && cr?.traffic > 7) warns.push("When childcare gets intense I'll shift career to passive mode.");
  const st = goalSliders["Study and Learning"];
  if (st?.traffic > 7 && cr?.traffic > 7) warns.push("Two high-focus goals! I'll separate with recovery buffers.");
  if (!selectedGoals.includes("Entertainment and Leisure")) warns.push("No leisure planned. Burnout risk detected.");

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <Logo size={26} />
      <h2 className="font-serif-d text-[20px] font-bold text-[#2c1810] mt-2">What grounds your week?</h2>

      <AetherProactiveInsight
        screenName="Priority Blueprint"
        userData={{ username, selectedGoals, lifeLoadScore: lifeLoad, goalSliders, hasLeisure: selectedGoals.includes('Entertainment and Leisure'), location: userProfile?.location, timeOfDay: new Date().getHours() }}
        cache={aetherInsights}
        setCache={setAetherInsights}
      />
      <div className="flex gap-1 mt-1">
        <button onClick={() => { setChatStartMic(false); setChatOpen(true); }} className="btn-olive px-2 py-0.5 text-[10px] glow-pulse">Ask me</button>
        <button onClick={() => { setChatStartMic(true); setChatOpen(true); }} className="btn-copper px-1.5 py-0.5 text-[10px]">🎤</button>
      </div>

      {/* Meter */}
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
          <circle cx="100" cy="100" r="6" fill={meterColor} stroke="#6b3f1a" strokeWidth="2" />
        </svg>
        <div className="text-[12px] font-bold text-[#2c1810] -mt-2">Life Load: {lifeLoad.toFixed(1)}</div>
        <div className="flex justify-between w-[200px] text-[10px] text-[#5a3a20]"><span>Light</span><span>Intense</span></div>
        <div className="text-[10px] italic text-[#2c1810] mt-1 text-center px-2">{aetherMsg}</div>
      </div>

      {warns.length > 0 && (
        <div className="mt-1 text-[9px] text-[#c44b3e] space-y-0.5">
          {warns.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {/* Goal cards grid */}
      <div className="grid grid-cols-2 gap-2 mt-2 overflow-y-auto thin-scroll flex-1 pr-1" style={{ maxHeight: 280 }}>
        {selectedGoals.map((g: string) => {
          const s = goalSliders[g] ?? { volatility: 5, traffic: 5 };
          const both = s.volatility > 7 && s.traffic > 7;
          return (
            <div key={g} className="dark-card text-[10px] relative">
              {both && <span className="absolute -top-1 -right-1 text-sm">⚠️</span>}
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
        <button disabled={blocked} onClick={onActivate}
          className="btn-copper w-full py-2.5 text-[13px]">Activate Priority Blueprint</button>
        <button onClick={onModify} className="w-full py-1.5 rounded-full border-2 border-[#b87333] text-[#2c1810] bg-[#e8d5a3] text-xs font-semibold">
          Modify goals
        </button>
        <div className="text-[9px] italic text-[#2c1810] text-center">Initialization complete; Planning path validated</div>
      </div>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} startWithMic={chatStartMic} />}
    </div>
  );
}

// ============ SCREEN 6 AETHERIZATION ============
function Screen6({ username, selectedGoals, goalSliders, totalHoursPerDay, setTotalHoursPerDay,
  tasksPerGoal, setTasksPerGoal, reservePool, onAetherize, aetherInsights, setAetherInsights }: any) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartMic, setChatStartMic] = useState(false);
  const lifeLoad = computeLifeLoad(selectedGoals, goalSliders);
  const blocked = lifeLoad > 8;

  const hourSuggestion =
    lifeLoad <= 3 ? "3-4 hours — Light week! Even 3 focused hours moves goals forward." :
    lifeLoad <= 5 ? "4-5 hours — Balanced. Keeps you productive without burnout." :
    lifeLoad <= 7 ? "5-6 hours — Moderate load. Your sweet spot." :
    "6-7 hours — Challenging. Don't worry — allot wisely.";

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
    pct === 0 ? `Let's start ${username}. Add tasks — I'll handle blueprinting.` :
    pct < 50 ? "Good start! Every task helps me protect your goals." :
    pct < 75 ? "Halfway! Your blueprint is taking shape." :
    pct < 100 ? "Almost done! Just a few more tasks." :
    `Blueprint complete ${username}! Tap Aether-ize — let's begin.`;

  if (blocked) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-full">
        <Logo size={32} />
        <div className="mt-8 p-5 rounded-2xl bg-[#c44b3e] text-white text-center">
          <div className="text-3xl">⚠️</div>
          <h3 className="font-bold mt-2">Please reduce Life Load first</h3>
          <p className="text-xs mt-2">Your Life Load is too high to plan a week safely.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-full relative">
      <div className="flex items-center justify-between">
        <Logo size={26} />
        <div className="flex gap-1">
          <button onClick={() => { setChatStartMic(false); setChatOpen(true); }} className="btn-olive px-2 py-0.5 text-[10px]">Ask me</button>
          <button onClick={() => { setChatStartMic(true); setChatOpen(true); }} className="btn-copper px-1.5 py-0.5 text-[10px]">🎤</button>
        </div>
      </div>
      <h2 className="font-serif-d text-[18px] font-bold text-[#2c1810] mt-2">Allot your hours for this week</h2>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 bg-[#2d4a1e] rounded-full px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] text-[#e8d5b0]">Total hours/day</span>
          <input
            inputMode="numeric" value={totalHoursPerDay || ""}
            onChange={(e) => setTotalHoursPerDay(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="w-12 rounded-md text-center bg-[#e8d5a3] text-[#2c1810] font-bold text-xs"
            placeholder="---"
          />
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold text-[#2d4a1e]">{pct}%</div>
          <button disabled={pct < 100} onClick={onAetherize}
            className={`btn-copper px-3 py-1 text-[10px] ${pct === 100 ? "glow-pulse" : ""}`}>Aether-ize</button>
        </div>
      </div>
      <p className="text-[9px] italic text-[#5a3a20] mt-1">{hourSuggestion}</p>
      {totalHoursPerDay > 0 && (
        <p className="text-[9px] text-[#2d4a1e] mt-0.5">Available: {Math.max(0, totalHoursPerDay - 0.5)} hrs/day · 0.5 hr/day held in reserve</p>
      )}
      <AetherProactiveInsight
        screenName="Aetherization"
        userData={{ username, totalHoursPerDay, availableHours: Math.max(0, totalHoursPerDay - 0.5), lifeLoadScore: lifeLoad, tasksPerGoal, selectedGoals, reservePool }}
        cache={aetherInsights}
        setCache={setAetherInsights}
      />
      <p className="text-[10px] text-[#2d4a1e] mt-1">{aetherMsg}</p>

      <div className="flex-1 overflow-y-auto thin-scroll mt-2 space-y-2 pr-1" style={{ maxHeight: 480 }}>
        {orderedGoals.map((g: string) => {
          const combined = (goalSliders[g]?.traffic ?? 0) + (goalSliders[g]?.volatility ?? 0);
          const focus = combined >= 14 ? { label: "High focus", color: "#ec4899" } :
            combined >= 8 ? { label: "Medium focus", color: "#06b6d4" } :
              { label: "Low focus", color: "#d4843a" };
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

      <button onClick={() => { onAetherize(); toast.success("Hours locked! Aether is blueprinting your week."); }}
        className="btn-copper w-full mt-2 py-2 text-[11px]">Lock in Hours</button>

      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} startWithMic={chatStartMic} />}
    </div>
  );
}

// ============ SCREEN 7 CONGRATS ============
function Screen7({ username, onContinue }: { username: string; onContinue: () => void }) {
  const [showBtn, setShowBtn] = useState(false);
  const [typed, setTyped] = useState("");
  const fullText = `Your blueprint is ready ${username}! I've synchronized all your goals, tasks and hours into a resilient week. Let's begin.`;

  useEffect(() => {
    const t = setTimeout(() => setShowBtn(true), 2000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [fullText]);

  return (
    <div className="p-5 flex flex-col items-center min-h-full">
      <Logo size={30} />
      <h2 className="font-serif-d text-[24px] font-bold text-[#2c1810] mt-3 text-center">Congratulations {username}</h2>

      <div className="mt-4 w-full rounded-3xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #3a5e26, #2d4a1e)", border: "3px solid #b87333" }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl">🎓</div>
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

      <div className="w-full mt-4">
        <ProgressBar pct={100} />
        <div className="text-center mt-1 text-[12px] font-bold text-[#2d4a1e]">Aether-ization complete</div>
        <div className="text-center text-[20px] font-bold text-[#2c1810]">100%</div>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <Aether size={40} />
        <div className="bg-[#e8d5a3] border-2 border-[#b87333] rounded-xl p-2 text-[11px] text-[#2c1810] cursor-blink">
          {typed}
        </div>
      </div>

      {showBtn && (
        <button onClick={onContinue} className="btn-copper px-5 py-2 text-xs mt-auto self-end fade-in">
          Blueprint →
        </button>
      )}
    </div>
  );
}

// ============ SCREEN 8 DASHBOARD ============
function getWeekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function computeDistribution(selected: string[], sliders: Record<string, GoalSliders>, totalHours: number, tasks: Record<string, string[]>) {
  const available = Math.max(0, totalHours - 0.5);
  const weighted: Record<string, number> = {};
  let sum = 0;
  selected.forEach((g) => {
    const s = sliders[g] ?? { volatility: 5, traffic: 5 };
    const w = (s.traffic + s.volatility) * (GOAL_MULTIPLIERS[g] ?? 1.0);
    weighted[g] = Math.max(0.1, w);
    sum += weighted[g];
  });
  const result: { goal: string; hours: number; weighted: number; tasks: { name: string; minutes: number }[] }[] = [];
  selected.forEach((g) => {
    let hours = sum > 0 ? (weighted[g] / sum) * available : 0;
    hours = Math.max(0.5, Math.round(hours * 2) / 2);
    const taskList = (tasks[g] ?? []).filter((t) => t.trim());
    const perTask = taskList.length > 0 ? Math.max(10, Math.round((hours * 60) / taskList.length / 5) * 5) : 0;
    result.push({
      goal: g, hours, weighted: weighted[g],
      tasks: taskList.map((t) => ({ name: t, minutes: perTask })),
    });
  });
  result.sort((a, b) => b.weighted - a.weighted);
  return result;
}

function Screen8({ username, selectedGoals, goalSliders, tasksPerGoal, totalHoursPerDay, resilienceScore, vaultedTasks, reservePool, planningLag, onNav, userProfile, aetherInsights, setAetherInsights, panelCache, setPanelCache }: any) {
  const dist = useMemo(() => computeDistribution(selectedGoals, goalSliders, totalHoursPerDay || 6, tasksPerGoal),
    [selectedGoals, goalSliders, totalHoursPerDay, tasksPerGoal]);
  const [panel, setPanel] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartMic, setChatStartMic] = useState(false);
  const lifeLoad = useMemo(() => computeLifeLoad(selectedGoals, goalSliders), [selectedGoals, goalSliders]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <AetherProactiveInsight
            screenName="Blueprint Dashboard"
            userData={{ username, lifeLoadScore: lifeLoad, selectedGoals, reservePool, planningLag, resilienceScore, timeOfDay: new Date().getHours(), location: userProfile?.location, totalHoursPerDay }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Logo size={22} />
          <ResilienceGauge score={resilienceScore} />
        </div>
      </div>

      {planningLag?.totalMins > 0 && (
        <div className="mx-3 mb-1 p-2 bg-[#d4843a]/30 border border-[#d4843a] rounded-lg text-[10px] text-[#2c1810]">
          ⚠️ {planningLag.totalMins} mins of planning lag carried over. No rush, no guilt.
        </div>
      )}

      <div className="px-3 flex gap-1">
        <button onClick={() => { setChatStartMic(false); setChatOpen(true); }} className="btn-olive px-2 py-0.5 text-[10px]">Ask me</button>
        <button onClick={() => { setChatStartMic(true); setChatOpen(true); }} className="btn-copper px-1.5 py-0.5 text-[10px]">🎤</button>
      </div>

      <div className="px-3 mt-2 flex items-center gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 bg-[#2d4a1e] rounded-full px-2 py-0.5 text-[10px] text-[#e8d5b0]">
            <span>🔒</span>
            <span>{totalHoursPerDay || 6} hrs/day</span>
          </div>
          <span className="text-[8px] text-[#5a3a20] mt-0.5">
            {reservePool?.currentWeekRemaining ?? 3.5} hrs reserve this week
            {reservePool?.carriedFromLastWeek > 0 && ` + ${reservePool.carriedFromLastWeek} hrs carried`}
          </span>
        </div>
        <div className="flex-1 text-right text-[10px] bg-[#b87333] text-white rounded-full px-2 py-0.5">{getWeekRange()}</div>
      </div>

      <h3 className="text-center font-serif-d font-bold text-[14px] text-[#2c1810] mt-1">{username}'s Balanced Blueprint</h3>

      <div className="flex-1 flex gap-2 px-2 mt-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto thin-scroll space-y-2 pr-1">
          {dist.map((d) => {
            const badge = d.weighted >= 13 ? { l: "High", c: "#ec4899" } :
              d.weighted >= 8 ? { l: "Medium", c: "#06b6d4" } : { l: "Low", c: "#d4843a" };
            const volatile = (goalSliders[d.goal]?.volatility ?? 0) > 7;
            return (
              <div key={d.goal} className="dark-card text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{GOAL_ICONS[d.goal] ?? "✨"} {d.goal}</span>
                  <span className="text-[#a3c54a] font-bold">{d.hours} hr/day</span>
                </div>
                <div className="flex gap-1 mt-1">
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: badge.c, color: "#fff" }}>
                    {badge.l}
                  </span>
                  {volatile && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#d4843a] text-white">Volatile</span>}
                </div>
                <div className="mt-1 space-y-1">
                  {d.tasks.map((t, i) => (
                    <div key={i} className="bg-[#e8d5a3] text-[#2c1810] rounded-lg p-1.5">
                      <div className="flex justify-between font-semibold text-[10px]">
                        <span>{t.name}</span>
                        <span className="text-[#4a7c59]">{t.minutes} min/day</span>
                      </div>
                      <div className="flex items-start gap-1 mt-0.5">
                        <span className="text-[9px]">🏷️</span>
                        <span className="text-[8px] italic flex-1">{suggestionFor(t.name)}</span>
                        <span className="text-[10px]">?</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* right side icons */}
        <div className="flex flex-col gap-1.5 py-1">
          {[
            { id: "opp", icon: "🧭" },
            { id: "boost", icon: "🚀" },
            { id: "spend", icon: "💰" },
            { id: "recal", icon: "⚙️" },
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

      <BottomNav vault={vaultedTasks.length} onNav={onNav} active={8} />

      {panel && <SidePanel panelId={panel} dist={dist} onClose={() => setPanel(null)} onNav={onNav}
        userData={{ username, selectedGoals, tasksPerGoal, lifeLoadScore: lifeLoad, timeOfDay: new Date().getHours(), totalHoursPerDay, goalSliders, location: userProfile?.location, resilienceScore }}
        panelCache={panelCache} setPanelCache={setPanelCache} />}
      {chatOpen && <AetherChat username={username} onClose={() => setChatOpen(false)} startWithMic={chatStartMic} />}
    </div>
  );
}

function BottomNav({ vault, onNav, active }: { vault: number; onNav: (s: number) => void; active: number }) {
  const items = [
    { icon: "🏠", label: "Dashboard", screen: 8 },
    { icon: "📋", label: "Blueprint", screen: 8 },
    { icon: "☀️", label: "Day", screen: 12 },
    { icon: "🔒", label: "Vault", screen: 8, badge: vault },
    { icon: "👤", label: "Profile", screen: 3 },
  ];
  return (
    <div className="flex justify-around items-center py-1.5 border-t-2 border-[#b87333]" style={{ background: "#2d4a1e" }}>
      {items.map((it) => (
        <button key={it.label} onClick={() => onNav(it.screen)} className="flex flex-col items-center text-[#e8d5b0] relative">
          <span className="text-lg">{it.icon}</span>
          <span className="text-[8px]">{it.label}</span>
          {it.badge !== undefined && it.badge > 0 && (
            <span className="absolute -top-1 right-2 bg-[#c44b3e] text-white text-[8px] rounded-full px-1">{it.badge}</span>
          )}
          {active === it.screen && <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[#d4a843]" />}
        </button>
      ))}
    </div>
  );
}

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
      Aether is recalibrating... tap refresh to try again ⚙️
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
      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Refresh Boosters</button>
    </div>
  );
}

function OpportunityMapPanel({ userData, panelCache, setPanelCache }: any) {
  const fetchOpp = useServerFn(getOpportunityMap);
  const [data, setData] = useState<any[] | null>(panelCache.opp || null);
  const [loading, setLoading] = useState(!panelCache.opp);
  const [error, setError] = useState(false);

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
      Aether is recalibrating... tap refresh to try again ⚙️
      <button onClick={() => load(true)} className="btn-copper px-3 py-1 mt-2 text-xs block mx-auto">Retry</button>
    </div>
  );

  return (
    <div className="space-y-2">
      {data.map((c, i) => (
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
      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Generate New Map</button>
    </div>
  );
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
      Aether is recalibrating... tap refresh to try again ⚙️
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
          <div className="text-[9px] text-[#5a3a20] mt-0.5">{s.reason}</div>
          <a href={s.searchUrl} target="_blank" rel="noopener" className="btn-copper inline-block px-3 py-1 text-[10px] mt-1.5">Search on Amazon →</a>
        </div>
      ))}
      <div className="text-[8px] italic text-[#5a3a20] text-center">Prices approximate. Search for current offers.</div>
      <button onClick={() => load(true)} className="btn-olive w-full py-1.5 text-[11px]">↻ Refresh Suggestions</button>
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
  } else if (panelId === "recal") {
    title = "Recalibrate";
    content = (
      <ul className="space-y-2 text-[11px]">
        {dist.map((d: any) => (
          <li key={d.goal} className="bg-[#e8d5a3] p-2 rounded-lg flex items-center justify-between">
            <span className="font-semibold">{d.goal}</span>
            <span className="flex items-center gap-1">
              <button className="btn-copper px-2 py-0">-</button>
              <span className="font-bold">{d.hours}</span>
              <button className="btn-copper px-2 py-0">+</button>
            </span>
          </li>
        ))}
      </ul>
    );
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
        <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 400 }}>{content}</div>
      </div>
    </div>
  );
}

// ============ SCREEN 12 DAY OUTPUT ============
function Screen12({ username, selectedGoals, goalSliders, tasksPerGoal, totalHoursPerDay,
  resilienceScore, setResilienceScore, reservePool, setReservePool, planningLag, setPlanningLag,
  vaultedTasks, setVaultedTasks, onNav, userProfile, aetherInsights, setAetherInsights }: any) {

  const dist = useMemo(() => computeDistribution(selectedGoals, goalSliders, totalHoursPerDay || 6, tasksPerGoal),
    [selectedGoals, goalSliders, totalHoursPerDay, tasksPerGoal]);

  const allTasks: TaskItem[] = useMemo(() => {
    const list: TaskItem[] = [];
    dist.forEach((d) => d.tasks.forEach((t, i) => {
      list.push({ id: `${d.goal}-${i}`, goal: d.goal, name: t.name, minutes: t.minutes, done: true });
    }));
    return list;
  }, [dist]);

  const [tasks, setTasks] = useState<TaskItem[]>(allTasks);
  const [result, setResult] = useState<null | { type: "A" | "B" | "C" | "D"; mins: number }>(null);
  const [recalibrating, setRecalibrating] = useState(false);

  useEffect(() => { setTasks(allTasks); }, [allTasks]);

  const toggle = (id: string) => setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const missed = tasks.filter((t) => !t.done);
  const missedMin = missed.reduce((s, t) => s + t.minutes, 0);

  const aetherMsg =
    missed.length === 0 ? `Stellar work ${username}! Every gear turned perfectly. Resilience Score: ${resilienceScore}. Rest well.` :
    missed.length === tasks.length ? `Life had other plans ${username}. Tap Life Happened — I'll recalibrate. Your goals are safe.` :
    `${username}, I see friction today. No guilt — reserve hours are for this. Deselect what life interrupted.`;

  const isSaturday = new Date().getDay() === 6;

  const lifeHappened = () => {
    setRecalibrating(true);
    setTimeout(() => {
      setRecalibrating(false);
      const carried = reservePool.carriedFromLastWeek || 0;
      const current = reservePool.currentWeekRemaining || 0;
      const totalReserveMin = (carried + current) * 60;

      if (isSaturday && missed.length > 0) {
        setVaultedTasks([...vaultedTasks, ...missed.map((m: TaskItem) => m.name)]);
        setResilienceScore(resilienceScore + 8);
        setResult({ type: "D", mins: missedMin });
      } else if (totalReserveMin >= missedMin) {
        // use carried first, then current
        let remaining = missedMin / 60;
        const useCarried = Math.min(carried, remaining);
        remaining -= useCarried;
        const useCurrent = Math.min(current, remaining);
        setReservePool({
          ...reservePool,
          carriedFromLastWeek: carried - useCarried,
          currentWeekRemaining: current - useCurrent,
          usedThisWeek: (reservePool.usedThisWeek || 0) + useCarried + useCurrent,
          totalAvailable: (carried - useCarried) + (current - useCurrent),
        });
        setResilienceScore(resilienceScore + 10);
        setResult({ type: "A", mins: missedMin });
      } else if (totalReserveMin > 0) {
        setReservePool({ ...reservePool, carriedFromLastWeek: 0, currentWeekRemaining: 0, totalAvailable: 0, usedThisWeek: (reservePool.usedThisWeek || 0) + carried + current });
        const lagMin = missedMin - totalReserveMin;
        setPlanningLag({ tasks: [...planningLag.tasks, ...missed.map((m: TaskItem) => m.name)], totalMins: planningLag.totalMins + lagMin });
        setResilienceScore(resilienceScore + 5);
        setResult({ type: "B", mins: totalReserveMin });
      } else {
        setPlanningLag({ tasks: [...planningLag.tasks, ...missed.map((m: TaskItem) => m.name)], totalMins: planningLag.totalMins + missedMin });
        setResilienceScore(resilienceScore + 3);
        setResult({ type: "C", mins: missedMin });
      }
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <AetherProactiveInsight
            screenName="Day Output"
            userData={{ username, completedTasks: tasks.filter(t => t.done).map(t => t.name), missedTasks: missed.map(m => m.name), reservePool, resilienceScore, timeOfDay: new Date().getHours(), planningLag }}
            cache={aetherInsights}
            setCache={setAetherInsights}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Logo size={22} />
          <ResilienceGauge score={resilienceScore} />
        </div>
      </div>

      <div className="px-4">
        <h2 className="font-serif-d text-[20px] font-bold text-[#2c1810]">How was your day?</h2>
        <div className="text-[10px] text-[#5a3a20]">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        <div className="text-[11px] font-bold text-[#2c1810] mt-2">Performance Recap (Auto-Validated)</div>
        <div className="text-[9px] italic text-[#5a3a20]">I've marked targets as achieved {username}. Untick anything life didn't allow — no judgment.</div>
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
          <div className="text-[10px] text-[#2c1810]">Tasks missed: {missed.length} | Time: {missedMin} mins</div>
          <div className="text-[10px] text-[#2c1810]">Reserve available: {(reservePool.totalAvailable || 0).toFixed(1)} hrs</div>
          <button onClick={lifeHappened} className="btn-copper w-full py-2 text-xs">LIFE HAPPENED</button>
          <div className="text-[9px] text-center text-[#5a3a20]">Reserve hours this week: {(reservePool.currentWeekRemaining || 0).toFixed(1)}{reservePool.carriedFromLastWeek > 0 && ` + ${reservePool.carriedFromLastWeek.toFixed(1)} carried`}</div>
        </div>
      )}

      {recalibrating && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#e8d5a3] p-5 rounded-2xl text-center">
            <BigGear size={60} spin />
            <div className="text-[12px] font-bold text-[#2c1810] mt-2">Aether is recalibrating your week...</div>
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
              {result.type === "A" && `Missed tasks absorbed by reserve. Remaining: ${(reservePool.totalAvailable || 0).toFixed(1)} hrs. Blueprint unchanged.`}
              {result.type === "B" && `Reserve covered ${result.mins} mins. Remaining redistributed.`}
              {result.type === "C" && "Reserve fully used. High Priority protected. Medium/Low redistributed."}
              {result.type === "D" && `Tasks moved to Saturday Vault. Vault holds ${vaultedTasks.length} items.`}
            </div>
          </div>
          <button onClick={() => { setResult(null); setTasks(tasks.map((t) => ({ ...t, done: true }))); }}
            className="btn-olive w-full py-1.5 text-xs mt-2">Continue</button>
        </div>
      )}

      <BottomNav vault={vaultedTasks.length} onNav={onNav} active={12} />
    </div>
  );
}
