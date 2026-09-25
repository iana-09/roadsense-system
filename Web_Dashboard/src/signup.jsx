import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ChevronRight, Mail, Building2, ArrowLeft, MapPin, CheckCircle, RefreshCw, Map, FileBarChart2, Bell, Shield, Clock, Loader2, House, X } from 'lucide-react';
import { sendVerificationCode, verifyCode } from './api';
import { API_BASE_URL } from './config';
import PhilippineAddressFields from './components/lgu/PhilippineAddressFields';

// ── Password Validation ───────────────────────────────────────────────────────
const PW_RULES = [
  { id: "len",     label: "At least 8 characters",       test: (v) => v.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",  test: (v) => /[A-Z]/.test(v) },
  { id: "number",  label: "One number (0–9)",            test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "One special character (!@#…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function validatePassword(pw) {
  const failed = PW_RULES.filter((r) => !r.test(pw));
  return { valid: failed.length === 0, failed };
}

function PasswordStrengthBar({ password }) {
  const passed = PW_RULES.filter((r) => r.test(password)).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-teal-500"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < passed ? colors[passed - 1] : "bg-slate-700"}`} />
        ))}
      </div>
      <div className="space-y-1">
        {PW_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <div key={r.id} className={`flex items-center gap-1.5 text-[11px] transition-colors ${ok ? "text-teal-400" : "text-slate-500"}`}>
              {ok
                ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                : <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" /></span>
              }
              {r.label}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function BorderTrail({ size = 60, transition, style }) {
  const BASE = { repeat: Infinity, duration: 5, ease: 'linear' };
  return (
    <div className='pointer-events-none absolute inset-0 rounded-2xl border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]'>
      <motion.div className="absolute aspect-square"
        style={{
          width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: 'linear-gradient(90deg, rgba(20,184,166,0) 0%, rgba(20,184,166,1) 30%, rgba(45,212,191,1) 50%, rgba(20,184,166,1) 70%, rgba(20,184,166,0) 100%)',
          filter: 'brightness(1.5)', ...style,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }} transition={transition ?? BASE}
      />
    </div>
  );
}

function FloatingPaths({ position }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-teal-400" viewBox="0 0 696 316" fill="none">
        {paths.map((p) => (
          <motion.path key={p.id} d={p.d} stroke="currentColor"
            strokeWidth={0.5 + p.id * 0.03} strokeOpacity={0.1 + p.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
            transition={{ duration: 20 + Math.random() * 10, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </svg>
    </div>
  );
}

function AppInput({ label, placeholder, type = "text", value, onChange, onKeyPress, readOnly = false, badge }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  const inputType = isPw ? (show ? "text" : "password") : type;

  return (
    <div className="w-full">
      {label && <label className="block mb-1.5 text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative w-full">
        <input type={inputType} value={value} onChange={onChange} onKeyPress={onKeyPress}
          placeholder={placeholder} readOnly={readOnly}
          className={`peer relative z-10 w-full px-4 ${isPw ? 'pr-10' : badge ? 'pr-20' : 'pr-4'} py-3 border-2 rounded-lg text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200
            ${readOnly
              ? 'bg-slate-800/60 border-slate-700/50 text-slate-400 cursor-not-allowed'
              : 'bg-slate-700/50 border-slate-600/50 focus:bg-slate-700/70 focus:border-teal-500/50'}`}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => !readOnly && setHover(true)} onMouseLeave={() => setHover(false)}
        />
        {hover && !readOnly && <>
          <div className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden"
            style={{ background: `radial-gradient(30px circle at ${pos.x}px 0px, rgba(45,212,191,1) 0%, transparent 70%)` }} />
          <div className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden"
            style={{ background: `radial-gradient(30px circle at ${pos.x}px 2px, rgba(45,212,191,1) 0%, transparent 70%)` }} />
        </>}
        {isPw && !readOnly && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 text-slate-400 hover:text-teal-400 transition-colors">
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
        {badge && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30">
            <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded">{badge}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step Progress Bar ─────────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = [{ n: 1, label: "Details" }, { n: 2, label: "Verify" }, { n: 3, label: "Account" }];
  const displayStep = (current === "pending") ? 2 : current;
  return (
    <div className="flex items-start gap-0 mb-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
              ${displayStep > s.n ? 'bg-teal-500 border-teal-500 text-white'
                : displayStep === s.n ? 'bg-slate-800 border-teal-400 text-teal-300'
                : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
              {displayStep > s.n ? <CheckCircle className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span className={`text-[10px] font-medium transition-colors
              ${displayStep === s.n ? 'text-teal-300' : displayStep > s.n ? 'text-slate-400' : 'text-slate-600'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-[2px] flex-1 mb-4 mx-1 rounded transition-all duration-500 ${displayStep > s.n ? 'bg-teal-500' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Right Brand Panel ─────────────────────────────────────────────────────────
function BrandPanel({ role }) {
  const lguFeatures = [
    { icon: <Map className="w-4 h-4 text-teal-400" />, color: "bg-teal-500/20 border-teal-500/30", title: "Jurisdiction Mapping", desc: "Manage hazards within your city/barangay" },
    { icon: <FileBarChart2 className="w-4 h-4 text-cyan-400" />, color: "bg-cyan-500/20 border-cyan-500/30", title: "DPWH-Compliant Reports", desc: "Generate road condition reports for your area" },
    { icon: <Bell className="w-4 h-4 text-purple-400" />, color: "bg-purple-500/20 border-purple-500/30", title: "Priority Alerts", desc: "Real-time hazard alerts for your jurisdiction" },
  ];

  const features = lguFeatures;
  const heading = "What LGUs get";

  return (
    <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-800/90 backdrop-blur-xl border-l border-slate-600/50 order-1 lg:order-2">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent z-10" />
      <div className="absolute inset-0"><FloatingPaths position={1} /><FloatingPaths position={-1} /></div>

      <div className="relative z-20 flex items-center gap-3">
        <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-teal-500/30" />
        <div>
          <h1 className="text-2xl font-bold text-white">RoadSense</h1>
          <p className="text-sm text-slate-300">Smart monitoring for safer roads</p>
        </div>
      </div>

      <div className="relative z-20 space-y-3 min-h-[180px]">
        <AnimatePresence mode="wait">
          {role && (
            <motion.div key={role} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }} className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{heading}</p>
              {features.filter((item) => item.title !== "User Management").map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 bg-slate-700/40 border border-slate-600/30 rounded-xl">
                  <div className={`w-8 h-8 ${item.color} border rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 right-0 w-64 h-64 opacity-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs><pattern id="g2" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern></defs>
          <rect width="100" height="100" fill="url(#g2)" />
        </svg>
      </div>
    </div>
  );
}

// ── Role Selector ─────────────────────────────────────────────────────────────
function RoleSelector({ onSelect }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Create an Account</h2>
        <p className="text-slate-400 text-sm mt-1">Select the type of account you want to register</p>
      </div>

      <div className="space-y-3">
        <button onClick={() => onSelect("lgu")}
          className="group w-full flex items-center gap-4 p-4 bg-slate-700/50 border-2 border-slate-600/50 rounded-xl text-left transition-all hover:border-cyan-500/50 hover:bg-slate-700/80 hover:shadow-lg hover:shadow-cyan-500/10">
          <div className="w-11 h-11 bg-cyan-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/30 transition-colors">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">LGU Account</p>
            <p className="text-xs text-slate-400 mt-0.5">For local government units and agencies</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">
        Already have an account?{" "}
        <a href="/login" className="text-teal-300 hover:text-teal-200 transition-colors">Sign in</a>
      </p>
      <p className="text-center text-xs text-slate-500 mt-1">
  LGU approved but didn't finish?{" "}
  <a href="/login?resume=1" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
    Resume Registration →
  </a>
</p>
    </motion.div>
  );
}

// ── Admin Signup ──────────────────────────────────────────────────────────────
function AdminSignup({ onBack }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [showStrength, setShowStrength] = useState(false);

  const pwValidation = validatePassword(password);
  const isValid = username.trim() && email.trim() && password && confirmPw && pwValidation.valid;

  const handleCreate = async () => {
    // Client-side password validation
    if (!pwValidation.valid) {
      const missing = pwValidation.failed.map((r) => r.label).join(", ");
      setPwError(`Password must include: ${missing}.`);
      return;
    }
    if (password !== confirmPw) { setPwError("Passwords do not match."); return; }
    setPwError(""); setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: username, email, password, role: "admin" }),
      });
      if (response.ok) { setDone(true); }
      else {
        const err = await response.json();
        // Surface specific backend errors (username taken, email taken, etc.)
        setPwError(err.detail || "Signup failed.");
      }
    } catch { setPwError("Server connection failed. Is the API running?"); }
    finally { setCreating(false); }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
          className="flex justify-center">
          <div className="w-20 h-20 bg-teal-500/20 border border-teal-500/40 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
            <CheckCircle className="w-10 h-10 text-teal-400" />
          </div>
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Admin Account Created!</h2>
          <p className="text-slate-300 text-sm">Welcome, <span className="text-teal-300 font-semibold">{username}</span></p>
          <div className="px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-lg text-left space-y-1.5 mt-3">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <p className="text-sm text-slate-300">Administrator</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <p className="text-sm text-slate-300 truncate">{email}</p>
            </div>
          </div>
        </div>
        <button onClick={() => { window.location.href = "/login"; }}
          className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98]">
          <span className="relative z-10 flex items-center justify-center gap-2">
            Proceed to Login <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-teal-500/20 border border-teal-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Admin Registration</h2>
            <p className="text-slate-400 text-xs">Create your administrator account</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AppInput label="Username" placeholder="Choose a username"
          value={username} onChange={(e) => setUsername(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
        <AppInput label="Email Address" placeholder="admin@gmail.com" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />

        {/* Password with strength indicator */}
        <div>
          <AppInput label="Password" placeholder="Create a password" type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setShowStrength(true); setPwError(""); }}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
          {showStrength && <PasswordStrengthBar password={password} />}
        </div>

        <div>
          <AppInput label="Confirm Password" placeholder="Re-enter your password" type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
          {/* Confirm match indicator */}
          {confirmPw && (
            <p className={`text-[11px] mt-1 flex items-center gap-1 ${confirmPw === password ? "text-teal-400" : "text-red-400"}`}>
              {confirmPw === password
                ? <><CheckCircle className="w-3 h-3" /> Passwords match</>
                : <><X className="w-3 h-3" /> Passwords do not match</>}
            </p>
          )}
        </div>

        <AnimatePresence>
          {pwError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {pwError}
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handleCreate} disabled={creating || !isValid}
          className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
          {creating
            ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account...</span></div>
            : <><span className="relative z-10">Create Admin Account</span><div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" /></>
          }
        </button>
      </div>
    </motion.div>
  );
}

// ── Whitelist Pending Screen ───────────────────────────────────────────────────
function WhitelistPending({ email, city, barangay, onApproved, onBack }) {
  const [whitelistStatus, setWhitelistStatus] = useState("pending");
  const checkCountRef = useRef(0);

const handleCheckStatus = async () => { // Limit checks to prevent spamming the backend
  setWhitelistStatus("checking");
  try {
    const res = await fetch(`${API_BASE_URL}/api/lgu/check/${email}`);
    const data = await res.json();
    setWhitelistStatus(data.status === "approved" ? "approved" : "pending");
  } catch {
    setWhitelistStatus("pending");
  }
};

  return (
    <motion.div key="whitelist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">LGU Registration</h2>
            <p className="text-slate-400 text-xs">Create your government account</p>
          </div>
        </div>
        <StepBar current={2} />
      </div>

      <AnimatePresence mode="wait">
        {(whitelistStatus === "pending" || whitelistStatus === "checking") && (
          <motion.div key="pending-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Clock className="w-9 h-9 text-amber-400" />
                </div>
                <motion.div className="absolute inset-0 rounded-full border border-amber-500/40"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="absolute inset-0 rounded-full border border-amber-500/20"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Awaiting Whitelist Approval</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Your email has been verified. An administrator must approve your LGU before you can complete registration.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Verified Email</p>
                  <p className="text-sm text-white font-medium truncate">{email}</p>
                </div>
                <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded flex-shrink-0">Verified</span>
              </div>
              <div className="h-px bg-slate-700/60" />
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">LGU Jurisdiction</p>
                  <p className="text-sm text-white font-medium">Brgy. {barangay}, {city}</p>
                </div>
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex-shrink-0">Pending</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                The system administrator will review your LGU details. You'll be notified at <span className="text-slate-400 font-medium">{email}</span> once approved. This typically takes 1–2 business days.
              </p>
            </div>

            <button onClick={handleCheckStatus} disabled={whitelistStatus === "checking"}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100">
              {whitelistStatus === "checking"
                ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span>Checking status...</span></div>
                : <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />Check Approval Status</span>
              }
            </button>
          </motion.div>
        )}

        {whitelistStatus === "approved" && (
          <motion.div key="approved-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
                <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <CheckCircle className="w-10 h-10 text-teal-400" />
                </div>
              </motion.div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">LGU Approved!</h3>
                <p className="text-xs text-slate-400">Your LGU has been whitelisted. You can now complete your account setup.</p>
              </div>
            </div>
            <div className="bg-teal-500/10 border border-teal-500/25 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-300 font-medium">Email verified & LGU whitelisted</p>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <p className="text-xs text-slate-300">Brgy. {barangay}, {city}</p>
              </div>
            </div>
            <button onClick={onApproved}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98]">
              <span className="relative z-10 flex items-center justify-center gap-2">
                Continue to Account Setup <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── LGU Signup (3-step + whitelist gate) ─────────────────────────────────────
function LGUSignup({ onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [barangayCode, setBarangayCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!email.trim() || !regionCode || !cityCode || !barangayCode) return;
    setSendingCode(true); setSendError("");
    try {
      await sendVerificationCode(email);
      setCooldown(60); setStep(2);
    } catch (err) {
      setSendError(err.message || "Failed to send code. Check your email and try again.");
    } finally { setSendingCode(false); }
  };

  const handleDigitChange = (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = d;
    setDigits(next); setCodeError("");
    if (d && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleDigitKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === "Enter") handleVerify();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return;
    const next = ["", "", "", "", "", ""];
    p.split("").forEach((d, i) => { next[i] = d; });
    setDigits(next);
    inputRefs.current[Math.min(p.length, 5)]?.focus();
  };

  const handleVerify = async () => { // Verify code and submit LGU request
  const code = digits.join("");
  if (code.length < 6) { setCodeError("Please enter all 6 digits."); return; }
  setVerifying(true); setCodeError("");
  try {
    await verifyCode(email, code);
    // Submit LGU request to admin
    const requestResponse = await fetch(`${API_BASE_URL}/api/lgu/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        region_code: regionCode,
        city_code: cityCode,
        barangay_code: barangayCode,
      }),
    });
    if (!requestResponse.ok) {
      const requestError = await requestResponse.json().catch(() => ({}));
      throw new Error(requestError.detail || "Could not submit the LGU request.");
    }
    setStep("pending");
  } catch (err) {
    setCodeError(err.message || "Invalid or expired code. Try again.");
  } finally { setVerifying(false); }
};
  const handleResend = async () => {
    if (cooldown > 0) return;
    setDigits(["", "", "", "", "", ""]); setCodeError("");
    try {
      await sendVerificationCode(email);
      setCooldown(60);
    } catch (err) { setCodeError("Failed to resend. Try again."); }
  };

  const pwValidation = validatePassword(password);

const handleCreate = async () => {
  if (!pwValidation.valid) {
    const missing = pwValidation.failed.map(r => r.label).join(", ");
    setPwError(`Password must include: ${missing}.`);
    return;
  }
  if (password !== confirmPw) {
    setPwError("Passwords do not match.");
    return;
  }

  setPwError("");
  setCreating(true);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: username.trim(),
        email: email,         // Use the verified email from step 1
        password,
        role: "lgu",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setStep("done");
    } else {
      setPwError(data.detail || "Signup failed. Please try again.");
    }
  } catch (err) {
    console.error(err);
    setPwError("Network error. Is the backend running?");
  } finally {
    setCreating(false);
  }
};

  const goBack = () => {
    if (step === 1) onBack();
    else if (step === 2) setStep(1);
    else if (step === "pending") setStep(2);
    else if (step === 3) setStep("pending");
  };

  const step1Valid = email.trim() && regionCode && cityCode && barangayCode;
  const step3Valid = username.trim() && pwValidation.valid && password === confirmPw;

  const LGUHeader = ({ stepNum }) => (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">LGU Registration</h2>
          <p className="text-slate-400 text-xs">Create your government account</p>
        </div>
      </div>
      <StepBar current={stepNum} />
    </div>
  );

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">

        {/* Step 1 */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <LGUHeader stepNum={1} />

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-xs text-cyan-300 leading-relaxed">
                Enter your official <span className="font-semibold">.gov.ph email</span> and LGU address.
                We'll send a <span className="font-semibold">6-digit verification code</span> to confirm your identity.
              </p>
            </div>

            <div>
              <AppInput label="Official Government Email" placeholder="yourname@lgu.gov.ph"
                type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSendError(""); }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendCode()} />
              <p className="text-xs text-slate-500 mt-1.5">Must be an official <span className="text-slate-400">.gov.ph</span> email address</p>
              <AnimatePresence>{sendError && <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">{sendError}</motion.div>}</AnimatePresence>
            </div>

            <PhilippineAddressFields
              regionCode={regionCode}
              cityCode={cityCode}
              barangayCode={barangayCode}
              onRegionChange={(selectedRegion) => {
                setRegionCode(selectedRegion?.code || "");
                setRegion(selectedRegion?.name || "");
                setCityCode("");
                setCity("");
                setBarangayCode("");
                setBarangay("");
                setSendError("");
              }}
              onCityChange={(selectedCity) => {
                setCityCode(selectedCity?.code || "");
                setCity(selectedCity?.name || "");
                setSendError("");
              }}
              onBarangayChange={(selectedBarangay) => {
                setBarangayCode(selectedBarangay?.code || "");
                setBarangay(selectedBarangay?.name || "");
                setSendError("");
              }}
              error={sendError}
            />

            <button onClick={handleSendCode} disabled={sendingCode || !step1Valid}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {sendingCode
                ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending code...</span></div>
                : <><span className="relative z-10 flex items-center justify-center gap-2">Send Verification Code <Mail className="w-4 h-4" /></span><div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" /></>
              }
            </button>
          </motion.div>
        )}

        {/* Step 2 — OTP */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <LGUHeader stepNum={2} />

            <div className="flex items-center gap-3 px-3 py-3 bg-slate-700/60 border border-slate-600/50 rounded-lg">
              <div className="w-9 h-9 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Verification code sent to</p>
                <p className="text-sm font-semibold text-white truncate">{email}</p>
              </div>
            </div>

            <div>
              <label className="block mb-3 text-sm font-medium text-slate-300">Enter 6-digit code</label>
              <div className="flex gap-2 justify-between">
                {digits.map((d, i) => (
                  <input key={i} ref={(el) => (inputRefs.current[i] = el)}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKey(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    className={`w-11 py-3 text-center text-xl font-bold rounded-lg border-2 bg-slate-700/50 text-white focus:outline-none transition-all duration-200
                      ${codeError ? 'border-red-500/60 bg-red-500/10'
                        : d ? 'border-teal-500/70 bg-teal-500/10'
                        : 'border-slate-600/50 focus:border-teal-500/60 focus:bg-slate-700/70'}`}
                  />
                ))}
              </div>
              <AnimatePresence>
                {codeError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full inline-block flex-shrink-0" />{codeError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button onClick={handleVerify} disabled={verifying || digits.join("").length < 6}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {verifying
                ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Verifying...</span></div>
                : <><span className="relative z-10 flex items-center justify-center gap-2">Verify Code <CheckCircle className="w-4 h-4" /></span><div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" /></>
              }
            </button>

            <div className="text-center">
              <span className="text-xs text-slate-500">Didn't receive it? </span>
              <button onClick={handleResend} disabled={cooldown > 0}
                className="text-xs text-teal-400 hover:text-teal-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Whitelist Pending gate */}
        {step === "pending" && (
          <WhitelistPending key="whitelist" email={email} city={`${city}, ${region}`} barangay={barangay}
            onApproved={() => setStep(3)} onBack={goBack} />
        )}

        {/* Step 3 — Account details */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <LGUHeader stepNum={3} />

            <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <p className="text-xs text-teal-300">Email verified & LGU approved — complete your account setup</p>
            </div>

            <AppInput label="Email" value={email} readOnly badge="Verified" placeholder="" onChange={() => {}} />
            <AppInput label="Username" placeholder="Choose a username"
              value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />

            {/* Password with strength */}
            <div>
              <AppInput label="Password" placeholder="Create a password" type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setShowStrength(true); setPwError(""); }}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
              {showStrength && <PasswordStrengthBar password={password} />}
            </div>

            <div>
              <AppInput label="Confirm Password" placeholder="Re-enter your password" type="password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
              {confirmPw && (
                <p className={`text-[11px] mt-1 flex items-center gap-1 ${confirmPw === password ? "text-teal-400" : "text-red-400"}`}>
                  {confirmPw === password
                    ? <><CheckCircle className="w-3 h-3" /> Passwords match</>
                    : <><X className="w-3 h-3" /> Passwords do not match</>}
                </p>
              )}
            </div>

            <AnimatePresence>
              {pwError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                  {pwError}
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={handleCreate} disabled={creating || !step3Valid}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {creating
                ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account...</span></div>
                : <><span className="relative z-10">Create Account</span><div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" /></>
              }
            </button>
          </motion.div>
        )}

        {/* Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
              className="flex justify-center">
              <div className="w-20 h-20 bg-teal-500/20 border border-teal-500/40 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
                <CheckCircle className="w-10 h-10 text-teal-400" />
              </div>
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Account Created!</h2>
              <p className="text-slate-300 text-sm">Welcome to RoadSense, <span className="text-teal-300 font-semibold">{username}</span></p>
              <div className="px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-lg text-left space-y-1.5 mt-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                  <p className="text-sm text-slate-300 truncate">{email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <p className="text-sm text-slate-300">Brgy. {barangay}, {city}, {region}</p>
                </div>
              </div>
            </div>
            <button onClick={() => { window.location.href = "/login"; }}
              className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98]">
              <span className="relative z-10 flex items-center justify-center gap-2">
                Proceed to Login <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Main Signup Page ──────────────────────────────────────────────────────────
export default function Signup() {
  const [role, setRole] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleBack = () => setRole(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <svg className="hidden"><defs><filter id="blur-signup">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter></defs></svg>
        <div className="h-full w-full blur-lg [filter:url(#blur-signup)_blur(40px)]">
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.3)_0%,_transparent_50%)] animate-moveVertical mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.25)_0%,_transparent_50%)] animate-moveInCircle origin-[calc(50%-400px)] mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25)_0%,_transparent_50%)] animate-moveInCircleSlow origin-[calc(50%+400px)] mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(20,184,166,0.25)_0%,_transparent_50%)] animate-moveHorizontal origin-[calc(50%-200px)] opacity-70 mix-blend-hard-light" />
        </div>
      </div>

      <style>{`
        @keyframes moveVertical { 0%,100%{transform:translateY(-50%)} 50%{transform:translateY(50%)} }
        @keyframes moveHorizontal { 0%,100%{transform:translateX(-50%) translateY(-10%)} 50%{transform:translateX(50%) translateY(10%)} }
        @keyframes moveInCircle { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes moveInCircleSlow { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        .animate-moveVertical{animation:moveVertical 30s ease infinite}
        .animate-moveHorizontal{animation:moveHorizontal 40s ease infinite}
        .animate-moveInCircle{animation:moveInCircle 20s reverse infinite}
        .animate-moveInCircleSlow{animation:moveInCircleSlow 40s linear infinite}
      `}</style>

      <main className="relative w-full max-w-6xl grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        <BorderTrail size={100} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          style={{ boxShadow: '0px 0px 60px 30px rgba(20,184,166,0.4)' }} />

        {/* Form Panel */}
        <div className="relative flex flex-col justify-center p-8 sm:p-10 bg-slate-700/70 backdrop-blur-xl overflow-hidden order-2 lg:order-1 min-h-[520px]"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>

          {role === null ? (
            <a href="/login" className="absolute top-7 left-2 z-20 flex items-center gap-1 px-2 py-1.5 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50">
              <ChevronRight className="w-4 h-4 rotate-180" /><span className="text-sm font-medium">Login</span>
            </a>
          ) : (
            <button onClick={handleBack} className="absolute top-7 left-2 z-20 flex items-center gap-1 px-2 py-1.5 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50">
              <ChevronRight className="w-4 h-4 rotate-180" /><span className="text-sm font-medium">Back</span>
            </button>
          )}

          {hovering && (
            <div className="absolute pointer-events-none w-[500px] h-[500px] bg-gradient-to-r from-teal-300/20 via-cyan-300/20 to-purple-300/20 rounded-full blur-3xl"
              style={{ transform: `translate(${mousePos.x - 250}px, ${mousePos.y - 250}px)`, transition: 'transform 0.1s ease-out' }} />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.15),transparent_50%)]" />

          <a href="/home" title="Home" className="absolute bottom-5 right-5 z-20 p-2.5 text-slate-400 hover:text-white transition-all rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-600/50 group">
            <House className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </a>

          <div className="flex items-center gap-3 mb-6 lg:hidden relative z-10">
            <img src="/roadsense.png" alt="RoadSense" className="w-10 h-10 rounded-lg object-cover" />
            <div><h1 className="text-xl font-bold text-white">RoadSense</h1><p className="text-xs text-slate-300">Road safety monitoring</p></div>
          </div>

          <div className="relative z-10 max-w-sm mx-auto w-full">
            <AnimatePresence mode="wait">
              {role === null && <RoleSelector key="select" onSelect={setRole} />}
              {role === "lgu" && <LGUSignup key="lgu" onBack={handleBack} />}
            </AnimatePresence>
          </div>
        </div>

        <BrandPanel role={role} />
      </main>
    </div>
  );
}


