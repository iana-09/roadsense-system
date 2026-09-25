import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, ChevronRight, Shield, Building2, ArrowLeft,
  UserRound, ExternalLink, Map, FileBarChart2, Bell,
  Mail, MapPin, CheckCircle, RefreshCw, Clock, Loader2, House,
  Cpu, Globe, Users, X,
} from 'lucide-react';
import { sendVerificationCode, verifyCode } from './api';
import { API_BASE_URL } from './config';
import PhilippineAddressFields from './components/lgu/PhilippineAddressFields';

// ── Password Validation ───────────────────────────────────────────────────────
const PW_RULES = [
  { id: "len",     label: "At least 8 characters",        test: (v) => v.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",   test: (v) => /[A-Z]/.test(v) },
  { id: "number",  label: "One number (0–9)",             test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "One special character (!@#…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function validatePassword(pw) {
  const failed = PW_RULES.filter((r) => !r.test(pw));
  return { valid: failed.length === 0, failed };
}

function PasswordStrengthBar({ password }) {
  const passed = PW_RULES.filter((r) => r.test(password)).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-teal-500"];

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
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: 'linear-gradient(90deg, rgba(20,184,166,0) 0%, rgba(20,184,166,1) 30%, rgba(45,212,191,1) 50%, rgba(20,184,166,1) 70%, rgba(20,184,166,0) 100%)',
          filter: 'brightness(1.5)', ...style,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={transition ?? BASE}
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
            ${readOnly ? 'bg-slate-800/60 border-slate-700/50 text-slate-400 cursor-not-allowed' : 'bg-slate-700/50 border-slate-600/50 focus:bg-slate-700/70 focus:border-teal-500/50'}`}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => !readOnly && setHover(true)} onMouseLeave={() => setHover(false)}
        />
        {hover && !readOnly && <>
          <div className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden" style={{ background: `radial-gradient(30px circle at ${pos.x}px 0px, rgba(45,212,191,1) 0%, transparent 70%)` }} />
          <div className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden" style={{ background: `radial-gradient(30px circle at ${pos.x}px 2px, rgba(45,212,191,1) 0%, transparent 70%)` }} />
        </>}
        {isPw && !readOnly && (
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 z-30 text-slate-400 hover:text-teal-400 transition-colors">
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
  const displayStep = current === "pending" ? 2 : current;
  return (
    <div className="flex items-start gap-0 mb-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
              ${displayStep > s.n ? 'bg-teal-500 border-teal-500 text-white' : displayStep === s.n ? 'bg-slate-800 border-teal-400 text-teal-300' : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
              {displayStep > s.n ? <CheckCircle className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span className={`text-[10px] font-medium transition-colors ${displayStep === s.n ? 'text-teal-300' : displayStep > s.n ? 'text-slate-400' : 'text-slate-600'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`h-[2px] flex-1 mb-4 mx-1 rounded transition-all duration-500 ${displayStep > s.n ? 'bg-teal-500' : 'bg-slate-700'}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Nova About Card overlay ───────────────────────────────────────────────────
function NovaAboutCard({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="absolute inset-0 z-50 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 0 0 1px rgba(45,212,191,0.18), 0 32px 64px rgba(0,0,0,0.6)' }}
    >
      <div className="absolute inset-0 bg-slate-900/96 backdrop-blur-2xl" />
      <div className="relative z-10 h-full overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">About the developer</span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-800/80 border border-teal-500/20 rounded-xl">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0">
            <img src="/images/nova_logo.png" alt="Nova Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">Nova</p>
            <p className="text-xs text-teal-400 font-medium mt-0.5">Technology & Innovation Company</p>
            <p className="text-[10px] text-slate-500 mt-1">Philippines · Est. 2024</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Nova is a technology company focused on developing intelligent systems for public safety and
          infrastructure monitoring. RoadSense is our flagship product — a smart road distress detection
          platform powered by YOLOv8 and DeepSORT, built to help local government units monitor and
          maintain safer roads across the Philippines.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-4 h-4 bg-teal-500/20 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[11px] font-semibold text-teal-300">Mission</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">Empower LGUs with intelligent, data-driven tools that make road monitoring efficient and accessible.</p>
          </div>
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-4 h-4 bg-cyan-500/20 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <p className="text-[11px] font-semibold text-cyan-300">Vision</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">Every hazard detected in real-time, every report DPWH-compliant, every community safer.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Model', value: 'YOLOv8' },
            { label: 'mAP@50', value: '92.8%' },
          ].map(s => (
            <div key={s.label} className="p-2.5 bg-slate-800/70 border border-slate-700/50 rounded-lg text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-bold text-teal-300 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { icon: <Cpu className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />, text: "23ms/frame inference · RTX 3050" },
            { icon: <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />, text: "152 km of monitored Philippine roads" },
            { icon: <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />, text: "156 active crowdsource contributors" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg">
              {icon}<p className="text-xs text-slate-300">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['YOLOv8', 'DeepSORT', 'PostGIS', 'React', 'Computer Vision'].map(tag => (
            <span key={tag} className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] rounded-full font-medium">{tag}</span>
          ))}
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-auto pt-1">© 2026 Nova Technology. All rights reserved.</p>
      </div>
    </motion.div>
  );
}

// ── Brand Panel ───────────────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-800/90 backdrop-blur-xl border-r border-slate-600/50">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent z-10" />
      <div className="absolute inset-0"><FloatingPaths position={1} /><FloatingPaths position={-1} /></div>
      <div className="relative z-20 flex items-center gap-3">
        <img src="/roadsense.png" alt="RoadSense" className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-teal-500/30" />
        <div>
          <h1 className="text-2xl font-bold text-white">RoadSense</h1>
          <p className="text-sm text-slate-300">Smart monitoring for safer roads</p>
        </div>
      </div>
      <div className="relative z-20 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Platform Access</p>
        {[
          { icon: <Building2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />, bg: "bg-slate-700/40 border-slate-600/30", title: "Local Government Unit", desc: "Manage your jurisdiction's road data and reports" },
          { icon: <UserRound className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />, bg: "bg-slate-700/40 border-slate-600/30", title: "Guest", desc: "Browse public data or request an LGU account" },
        ].map((item) => (
          <div key={item.title} className={`flex items-start gap-3 p-3.5 ${item.bg} border rounded-xl`}>
            {item.icon}
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 right-0 w-64 h-64 opacity-10 z-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs><pattern id="g" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern></defs>
          <rect width="100" height="100" fill="url(#g)" />
        </svg>
      </div>
    </div>
  );
}


// ── Role Selection ─────────────────────────────────────────────────────────────
function RoleSelection({ onSignIn, onGuest, onResume }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome to RoadSense</h2>
        <p className="text-slate-400 text-sm mt-1">Select your access type to continue</p>
      </div>
      <div className="space-y-3">
        <button onClick={onGuest}
          className="group w-full flex items-center gap-4 p-4 bg-slate-700/30 border-2 border-slate-700/50 rounded-xl text-left transition-all hover:border-slate-500/60 hover:bg-slate-700/60">
          <div className="w-11 h-11 bg-slate-600/30 border border-slate-600/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600/50 transition-colors">
            <UserRound className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-300">Continue as Guest</p>
            <p className="text-xs text-slate-500 mt-0.5">Browse public data · Request LGU access</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
        </button>
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700/60" />
          <span className="text-xs text-slate-500 flex-shrink-0">or sign in</span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>
        <button onClick={onSignIn}
          className="group w-full flex items-center gap-4 p-4 bg-slate-700/50 border-2 border-slate-600/50 rounded-xl text-left transition-all hover:border-teal-500/50 hover:bg-slate-700/80 hover:shadow-lg hover:shadow-teal-500/10">
          <div className="w-11 h-11 bg-teal-500/20 border border-teal-500/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/30 transition-colors">
            <Shield className="w-5 h-5 text-teal-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Sign In</p>
            <p className="text-xs text-slate-400 mt-0.5">SAE or LGU account</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
        </button>
      </div>
      <p className="text-center text-xs text-slate-500">
        Don't have an account?{" "}
        <a href="/signup" className="text-teal-300 hover:text-teal-200 transition-colors font-medium">Create account</a>
      </p>
      <p className="text-xs text-slate-600 text-center mt-1">
  LGU approved but didn't finish?{" "}
  <button
    onClick={onResume}   // ← you'll need to pass setView or onResume as a prop
    className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
    Resume Registration →
  </button>
</p>
    </motion.div>
  );
}

// ── CombinedLogin ─────────────────────────────────────────────────────────────
function CombinedLogin({ onBack, onRequestAccount, onReapply }) {
  const [tab, setTab] = useState("lgu");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState(""); // "not_found" | "wrong_password" | "pending" | "rejected" | "generic"
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
 
  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      setErrorType("generic");
      return;
    }
    setIsLoading(true);
    setError(""); setErrorType("");
 
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role: tab }),
      });
 
      if (response.ok) {
        const userData = await response.json();
        localStorage.setItem('user', JSON.stringify(userData));
        setSuccess(true);
      } else {
        const err = await response.json().catch(() => ({}));
        const detail = err.detail || "Login failed.";
        const status = response.status;
 
        // Map specific backend errors to error types
        if (status === 404) {
          setErrorType("not_found");
        } else if (status === 401) {
          setErrorType("wrong_password");
        } else if (status === 403 && detail.toLowerCase().includes("pending")) {
          setErrorType("pending");
        } else if (status === 403 && detail.toLowerCase().includes("rejected")) {
          setErrorType("rejected");
        } else {
          setErrorType("generic");
        }
        setError(detail);
      }
    } catch (err) {
      setError("Server connection failed. Is the API running?");
      setErrorType("generic");
    } finally {
      setIsLoading(false);
    }
  };
 
  const switchTab = (t) => {
    if (t === tab) return;
    setTab(t);
    setUsername(""); setPassword("");
    setError(""); setErrorType("");
    setIsLoading(false);
  };
 
  // Error box styles by type
  const errorStyles = {
    not_found:     { box: "bg-slate-800/80 border-slate-600/60", text: "text-slate-300", icon: "⚠️" },
    wrong_password:{ box: "bg-red-500/10 border-red-500/20",     text: "text-red-400",   icon: "🔑" },
    pending:       { box: "bg-amber-500/10 border-amber-500/25", text: "text-amber-400", icon: "⏳" },
    rejected:      { box: "bg-red-500/10 border-red-500/20",     text: "text-red-400",   icon: "✗" },
    generic:       { box: "bg-red-500/10 border-red-500/20",     text: "text-red-400",   icon: "!" },
  };
  const es = errorStyles[errorType] || errorStyles.generic;
 
  if (success) {
    const isAdmin = tab === "admin";
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            Welcome{isAdmin ? " back" : ""},{" "}
            <span className={isAdmin ? "text-teal-300" : "text-cyan-300"}>{username.trim()}</span>
          </h2>
          <p className="text-slate-300 text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Login successful
          </p>
        </div>
        <button
          onClick={() => { window.location.href = isAdmin ? "/dashboard" : "/lgu-dashboard"; }}
          className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
          <span className="relative z-10 flex items-center justify-center gap-2">
            Go to {isAdmin ? "Admin Dashboard" : "LGU Dashboard"}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </motion.div>
    );
  }
 
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-xl font-bold text-white">Sign In</h2>
        <p className="text-slate-400 text-xs mt-0.5">Enter your credentials to continue</p>
      </div>
 
      {/* ── Error display ──────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`p-3.5 rounded-xl border ${es.box}`}>
          <div className={`flex items-start gap-2.5 ${es.text}`}>
            <span className="text-base flex-shrink-0 mt-0.5">{es.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{error}</p>
 
              {/* Contextual help links */}
              {errorType === "not_found" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={onRequestAccount}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">
                    Register as LGU →
                  </button>
                  <span className="text-slate-600 text-xs">or</span>
                  <a href="/signup" className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors">
                    Create an account →
                  </a>
                </div>
              )}
 
              {errorType === "pending" && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-amber-300/70">
                    Your access may have been revoked. Check your email for details.
                  </p>
                  <button
                    onClick={() => onReapply()}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">
                    Re-apply with your LGU email →
                  </button>
                </div>
              )}
 
              {errorType === "rejected" && (
                <p className="text-xs mt-1.5 text-red-300/70">
                  Contact your system administrator for assistance.
                </p>
              )}
 
              {errorType === "wrong_password" && (
                <div className="mt-1.5">
                  <a href="/forgot-password" className="text-xs text-red-300/80 hover:text-red-300 underline underline-offset-2 transition-colors">
                    Forgot your password?
                  </a>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
 
      {/* ── Tab switcher ───────────────────────────────────────────────────── */}
      <div className="flex rounded-xl bg-slate-800/70 border border-slate-700/50 p-1 gap-1">
        {[{ id: "lgu", Icon: Building2, label: "LGU" }, { id: "admin", Icon: Shield, label: "Admin" }].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => switchTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200
              ${tab === id
                ? id === "lgu"
                  ? "bg-gradient-to-r from-cyan-700/50 to-cyan-600/40 text-cyan-200 shadow-sm"
                  : "bg-gradient-to-r from-teal-800/50 to-teal-700/40 text-teal-200 shadow-sm"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
 
      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSignIn} className="space-y-3">
        <AppInput
          label="Username"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); setErrorType(""); }}
        />
        <AppInput
          label="Password"
          placeholder="Enter your password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); setErrorType(""); }}
        />
 
        <button
          type="submit"
          disabled={isLoading || !username.trim() || !password.trim()}
          className={`group relative w-full px-6 py-3 bg-gradient-to-r ${
            tab === "lgu" ? 'from-cyan-500 to-teal-500' : 'from-teal-500 to-cyan-500'
          } text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : <span className="relative z-10">Sign In</span>}
        </button>
      </form>
 
      {/* ── LGU signup prompt ──────────────────────────────────────────────── */}
      {tab === "lgu" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-[11px] text-slate-500 flex-shrink-0">no account yet?</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>
          <button
            onClick={onRequestAccount}
            className="group w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-cyan-300 hover:text-cyan-200 text-sm font-medium rounded-lg transition-all">
            <Building2 className="w-4 h-4" />
            Request an LGU Account
            <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-all" />
          </button>
        </motion.div>
      )}
 
      <a href="/forgot-password" className="block text-xs text-teal-300 hover:text-teal-200 transition-colors">
        Forgot password?
      </a>
    </motion.div>
  );
}

// ── Guest View ────────────────────────────────────────────────────────────────
function GuestView({ onBack, onRequestAccount }) {
  const [entering, setEntering] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-slate-600/40 border border-slate-500/40 rounded-lg flex items-center justify-center"><UserRound className="w-4 h-4 text-slate-300" /></div>
          <div><h2 className="text-xl font-bold text-white">Guest Access</h2><p className="text-slate-400 text-xs">Limited public view — no account required</p></div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What you can access</p>
        {[
          { icon: <Map className="w-3.5 h-3.5 text-teal-400" />, text: "Public road hazard map (read-only)" },
          { icon: <FileBarChart2 className="w-3.5 h-3.5 text-cyan-400" />, text: "Published road condition reports" },
          { icon: <Bell className="w-3.5 h-3.5 text-slate-400" />, text: "Public hazard alerts (view only)" },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-800/50 border border-slate-700/40 rounded-lg">
            {item.icon}<p className="text-xs text-slate-300">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="relative flex items-center gap-3"><div className="flex-1 h-px bg-slate-700/60" /><span className="text-xs text-slate-500 flex-shrink-0">or</span><div className="flex-1 h-px bg-slate-700/60" /></div>
      <div className="relative rounded-xl overflow-hidden border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 to-teal-500/5 p-4 space-y-3">
        <motion.div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-cyan-400/10 blur-2xl pointer-events-none" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="flex items-start gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5"><Building2 className="w-4 h-4 text-cyan-400" /></div>
          <div><p className="text-sm font-semibold text-white">Are you an LGU?</p><p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Register your local government unit to unlock full jurisdiction management.</p></div>
        </div>
        <button onClick={onRequestAccount} className="relative z-10 group w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
          <Building2 className="w-4 h-4" />Request LGU Account
        </button>
      </div>
      <button onClick={() => { setEntering(true); setTimeout(() => { window.location.href = "/guest-dashboard"; }, 800); }} disabled={entering}
        className="group w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/90 text-slate-300 hover:text-white text-sm font-semibold rounded-lg transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed">
        {entering ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /><span>Entering...</span></> : <><UserRound className="w-4 h-4" /><span>Continue as Guest</span><ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>}
      </button>
    </motion.div>
  );
}

// ── LGU Signup Inline ─────────────────────────────────────────────────────────
function LGUSignupInline({ onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(""); const [region, setRegion] = useState(""); const [city, setCity] = useState(""); const [barangay, setBarangay] = useState("");
  const [regionCode, setRegionCode] = useState(""); const [cityCode, setCityCode] = useState(""); const [barangayCode, setBarangayCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState(""); const [verifying, setVerifying] = useState(false); const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState(""); const [creating, setCreating] = useState(false);
  const [whitelistStatus, setWhitelistStatus] = useState("pending"); const checkCountRef = useRef(0);
  const [showStrength, setShowStrength] = useState(false);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const [sendError, setSendError] = useState("");

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
  const handleDigitChange = (i, val) => { const d = val.replace(/\D/g, "").slice(-1); const next = [...digits]; next[i] = d; setDigits(next); setCodeError(""); if (d && i < 5) inputRefs.current[i + 1]?.focus(); };
  const handleDigitKey = (i, e) => { if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus(); if (e.key === "Enter") handleVerify(); };
  const handlePaste = (e) => { e.preventDefault(); const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (!p) return; const next = ["", "", "", "", "", ""]; p.split("").forEach((d, i) => { next[i] = d; }); setDigits(next); inputRefs.current[Math.min(p.length, 5)]?.focus(); };
const handleVerify = async () => {
  const code = digits.join("");
  if (code.length < 6) { setCodeError("Please enter all 6 digits."); return; }
  setVerifying(true); setCodeError("");
  try {
    await verifyCode(email, code);
    const res = await fetch(`${API_BASE_URL}/api/lgu/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, region_code: regionCode, city_code: cityCode, barangay_code: barangayCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setCodeError(err.detail || "Could not submit the LGU request.");
      return;
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
  const handleCheckStatus = async () => { // Limit checks to every 15 seconds to avoid spamming the API while waiting for manual approval
  setWhitelistStatus("checking");
  try {
    const res = await fetch(`${API_BASE_URL}/api/lgu/check/${email}`);
    const data = await res.json();
    setWhitelistStatus(data.status === "approved" ? "approved" : "pending");
  } catch {
    setWhitelistStatus("pending");
  }
};

  const pwValidation = validatePassword(password);

  const handleCreate = async () => {
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
        body: JSON.stringify({ full_name: username, email, password, role: "lgu" }),
      });
      if (response.ok) { setStep("done"); }
      else {
        const err = await response.json();
        setPwError(err.detail || "Signup failed.");
      }
    } catch { setPwError("Server connection failed. Is the API running?"); }
    finally { setCreating(false); }
  };

  const goBack = () => { if (step === 1) onBack(); else if (step === 2) setStep(1); else if (step === "pending") setStep(2); else if (step === 3) setStep("pending"); };

  const step1Valid = email.trim() && regionCode && cityCode && barangayCode;
  const step3Valid = username.trim() && pwValidation.valid && password === confirmPw;

  const LGUHeader = ({ stepNum }) => (
    <div>
      <div className="flex items-center gap-2.5 mb-4"><div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-cyan-400" /></div><div><h2 className="text-xl font-bold text-white">LGU Registration</h2><p className="text-slate-400 text-xs">Create your government account</p></div></div>
      <StepBar current={stepNum} />
    </div>
  );

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        {step === 1 && (<motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <div><button onClick={goBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button><LGUHeader stepNum={1} /></div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3"><p className="text-xs text-cyan-300 leading-relaxed">Enter your official <span className="font-semibold">.gov.ph email</span> and LGU address. We'll send a <span className="font-semibold">6-digit verification code</span>.</p></div>
          <div>
            <AppInput label="Official Government Email" placeholder="yourname@lgu.gov.ph" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSendError(""); }} onKeyPress={(e) => e.key === 'Enter' && handleSendCode()} />
            <p className="text-xs text-slate-500 mt-1.5">Must be an official <span className="text-slate-400">.gov.ph</span> email</p>
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
          <button onClick={handleSendCode} disabled={sendingCode || !step1Valid} className="group relative w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
            {sendingCode ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending code...</span></div> : <span className="relative z-10 flex items-center justify-center gap-2">Send Verification Code<Mail className="w-4 h-4" /></span>}
          </button>
        </motion.div>)}

        {step === 2 && (<motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
          <div><button onClick={goBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button><LGUHeader stepNum={2} /></div>
          <div className="flex items-center gap-3 px-3 py-3 bg-slate-700/60 border border-slate-600/50 rounded-lg"><div className="w-9 h-9 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-teal-400" /></div><div className="min-w-0"><p className="text-xs text-slate-400">Verification code sent to</p><p className="text-sm font-semibold text-white truncate">{email}</p></div></div>
          <div>
            <label className="block mb-3 text-sm font-medium text-slate-300">Enter 6-digit code</label>
            <div className="flex gap-2 justify-between">{digits.map((d, i) => (<input key={i} ref={(el) => (inputRefs.current[i] = el)} type="text" inputMode="numeric" maxLength={1} value={d} onChange={(e) => handleDigitChange(i, e.target.value)} onKeyDown={(e) => handleDigitKey(i, e)} onPaste={i === 0 ? handlePaste : undefined} className={`w-11 py-3 text-center text-xl font-bold rounded-lg border-2 bg-slate-700/50 text-white focus:outline-none transition-all duration-200 ${codeError ? 'border-red-500/60 bg-red-500/10' : d ? 'border-teal-500/70 bg-teal-500/10' : 'border-slate-600/50 focus:border-teal-500/60 focus:bg-slate-700/70'}`} />))}</div>
            <AnimatePresence>{codeError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-red-400 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-full inline-block flex-shrink-0" />{codeError}</motion.p>}</AnimatePresence>
          </div>
          <button onClick={handleVerify} disabled={verifying || digits.join("").length < 6} className="group relative w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
            {verifying ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Verifying...</span></div> : <span className="relative z-10 flex items-center justify-center gap-2">Verify Code<CheckCircle className="w-4 h-4" /></span>}
          </button>
          <div className="text-center"><span className="text-xs text-slate-500">Didn't receive it? </span><button onClick={handleResend} disabled={cooldown > 0} className="text-xs text-teal-400 hover:text-teal-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" />{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button></div>
        </motion.div>)}

        {step === "pending" && (<motion.div key="whitelist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
          <div><button onClick={goBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button><LGUHeader stepNum={2} /></div>
          <AnimatePresence mode="wait">
            {(whitelistStatus === "pending" || whitelistStatus === "checking") && (<motion.div key="wl-pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <div className="flex flex-col items-center py-5 gap-4"><div className="relative"><div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center"><Clock className="w-9 h-9 text-amber-400" /></div><motion.div className="absolute inset-0 rounded-full border border-amber-500/40" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} /></div><div className="text-center space-y-1"><h3 className="text-base font-bold text-white">Awaiting Whitelist Approval</h3><p className="text-xs text-slate-400 leading-relaxed">An administrator must approve your LGU before you can complete registration.</p></div></div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0"><Mail className="w-3.5 h-3.5 text-teal-400" /></div><div className="min-w-0 flex-1"><p className="text-[10px] text-slate-500 uppercase tracking-wider">Verified Email</p><p className="text-sm text-white font-medium truncate">{email}</p></div><span className="text-[10px] text-teal-400 font-semibold bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded flex-shrink-0">Verified</span></div>
                <div className="h-px bg-slate-700/60" />
                <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 text-cyan-400" /></div><div className="flex-1"><p className="text-[10px] text-slate-500 uppercase tracking-wider">LGU Jurisdiction</p><p className="text-sm text-white font-medium">Brgy. {barangay}, {city}, {region}</p></div><span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex-shrink-0">Pending</span></div>
              </div>
              <button onClick={handleCheckStatus} disabled={whitelistStatus === "checking"} className="group relative w-full px-6 py-3 bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100">
                {whitelistStatus === "checking" ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span>Checking status...</span></div> : <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />Check Approval Status</span>}
              </button>
            </motion.div>)}
            {whitelistStatus === "approved" && (<motion.div key="wl-approved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-4"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}><div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg shadow-teal-500/20"><CheckCircle className="w-10 h-10 text-teal-400" /></div></motion.div><div className="text-center space-y-1"><h3 className="text-base font-bold text-white">LGU Approved!</h3><p className="text-xs text-slate-400">Your LGU has been whitelisted. Complete your account setup.</p></div></div>
              <button onClick={() => setStep(3)} className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"><span className="relative z-10 flex items-center justify-center gap-2">Continue to Account Setup<ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span></button>
            </motion.div>)}
          </AnimatePresence>
        </motion.div>)}

        {step === 3 && (<motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <div><button onClick={goBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button><LGUHeader stepNum={3} /></div>
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-lg"><CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" /><p className="text-xs text-teal-300">Email verified & LGU approved — complete your account setup</p></div>
          <AppInput label="Email" value={email} readOnly badge="Verified" placeholder="" onChange={() => {}} />
          <AppInput label="Username" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />

          {/* Password with strength bar */}
          <div>
            <AppInput label="Password" placeholder="Create a password" type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setShowStrength(true); setPwError(""); }}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
            {showStrength && <PasswordStrengthBar password={password} />}
          </div>

          <div>
            <AppInput label="Confirm Password" placeholder="Re-enter your password" type="password" value={confirmPw}
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

          <AnimatePresence>{pwError && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">{pwError}</motion.div>}</AnimatePresence>
          <button onClick={handleCreate} disabled={creating || !step3Valid} className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
            {creating ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account...</span></div> : <span className="relative z-10">Create Account</span>}
          </button>
        </motion.div>)}

        {step === "done" && (<motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }} className="flex justify-center"><div className="w-20 h-20 bg-teal-500/20 border border-teal-500/40 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20"><CheckCircle className="w-10 h-10 text-teal-400" /></div></motion.div>
          <div className="space-y-2"><h2 className="text-2xl font-bold text-white">Account Created!</h2><p className="text-slate-300 text-sm">Welcome to RoadSense, <span className="text-teal-300 font-semibold">{username}</span></p><div className="px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-lg text-left space-y-1.5 mt-3"><div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" /><p className="text-sm text-slate-300 truncate">{email}</p></div><div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /><p className="text-sm text-slate-300">Brgy. {barangay}, {city}</p></div></div></div>
          <button onClick={() => window.location.href = "/login"} className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"><span className="relative z-10 flex items-center justify-center gap-2">Sign In to Your Account<ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span></button>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
// ── Resume Registration ───────────────────────────────────────────────────────
function ResumeRegistration({ onBack }) {
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(null); // null | { email, city, barangay }
  const [step, setStep] = useState("check"); // "check" | "create" | "done"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showStrength, setShowStrength] = useState(false);

  const PW_RULES = [
    { id: "len",     label: "At least 8 characters",        test: (v) => v.length >= 8 },
    { id: "upper",   label: "One uppercase letter (A–Z)",   test: (v) => /[A-Z]/.test(v) },
    { id: "number",  label: "One number (0–9)",             test: (v) => /[0-9]/.test(v) },
    { id: "special", label: "One special character (!@#…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
  ];
  const pwValidation = { 
    valid: PW_RULES.every(r => r.test(password)), 
    failed: PW_RULES.filter(r => !r.test(password)) 
  };
  const step3Valid = username.trim() && pwValidation.valid && password === confirmPw;

  const handleCheck = async () => {
    if (!email.trim()) return;
    setChecking(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/lgu/resume/${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (res.ok && data.can_resume) {
        setApproved(data);
        setStep("create");
      } else {
        setError(data.detail || "Unable to resume registration.");
      }
    } catch {
      setError("Server connection failed. Is the API running?");
    } finally { setChecking(false); }
  };

  const handleCreate = async () => {
    if (!pwValidation.valid) {
      setPwError(`Password must include: ${pwValidation.failed.map(r => r.label).join(", ")}.`);
      return;
    }
    if (password !== confirmPw) { setPwError("Passwords do not match."); return; }
    setPwError(""); setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: username, email: approved.email, password, role: "lgu" }),
      });
      if (res.ok) { setStep("done"); }
      else { const err = await res.json(); setPwError(err.detail || "Signup failed."); }
    } catch { setPwError("Server connection failed."); }
    finally { setCreating(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Resume Registration</h2>
            <p className="text-slate-400 text-xs">Continue your approved LGU account setup</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* Step: Enter email to verify approval */}
        {step === "check" && (
          <motion.div key="check" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-xs text-cyan-300 leading-relaxed">
                Enter the email address you used during LGU registration. We'll confirm your approval status before letting you create your account.
              </p>
            </div>

            <AppInput
              label="Registered LGU Email"
              placeholder="yourname@lgu.gov.ph"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            />

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={handleCheck} disabled={checking || !email.trim()}
              className="group w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {checking
                ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span>Checking...</span></div>
                : <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Verify Approval</span>
              }
            </button>
          </motion.div>
        )}

        {/* Step: Create account (approved confirmed) */}
        {step === "create" && approved && (
          <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

            {/* Approval confirmation card */}
            <div className="p-3.5 bg-teal-500/10 border border-teal-500/25 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-300 font-semibold">LGU Approved — ready to create your account</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-300">{approved.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-300">Brgy. {approved.barangay}, {approved.city}</p>
              </div>
            </div>

            <AppInput label="Email" value={approved.email} readOnly badge="Verified" placeholder="" onChange={() => {}} />
            <AppInput label="Username" placeholder="Choose a username" value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />

            <div>
              <AppInput label="Password" placeholder="Create a password" type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); setShowStrength(true); setPwError(""); }}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
              {showStrength && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1 mt-1">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => {
                      const passed = PW_RULES.filter(r => r.test(password)).length;
                      const colors = ["bg-red-500","bg-orange-500","bg-yellow-500","bg-teal-500"];
                      return <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < passed ? colors[passed-1] : "bg-slate-700"}`} />;
                    })}
                  </div>
                  <div className="space-y-1">
                    {PW_RULES.map(r => {
                      const ok = r.test(password);
                      return (
                        <div key={r.id} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-teal-400" : "text-slate-500"}`}>
                          {ok ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" /></span>}
                          {r.label}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            <div>
              <AppInput label="Confirm Password" placeholder="Re-enter your password" type="password" value={confirmPw}
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
              className="group w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {creating
                ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account...</span></div>
                : <span>Create Account</span>
              }
            </button>
          </motion.div>
        )}

        {/* Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }} className="flex justify-center">
              <div className="w-20 h-20 bg-teal-500/20 border border-teal-500/40 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
                <CheckCircle className="w-10 h-10 text-teal-400" />
              </div>
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Account Created!</h2>
              <p className="text-slate-300 text-sm">Welcome to RoadSense, <span className="text-teal-300 font-semibold">{username}</span></p>
            </div>
            <button onClick={() => window.location.href = "/login"}
              className="group w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
              <span className="flex items-center justify-center gap-2">Sign In <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}
// ── Re-apply LGU (for revoked accounts) ──────────────────────────────────────
function ReapplyLGU({ onBack }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReapply = async () => {
    if (!email.trim()) return;
    setSubmitting(true); setError("");
    try {
      // Check current status first
      const checkRes = await fetch(`${API_BASE_URL}/api/lgu/check/${encodeURIComponent(email.trim())}`);
      if (!checkRes.ok) {
        const err = await checkRes.json();
        setError(err.detail || "Email not found. Please sign up first.");
        return;
      }
      const checkData = await checkRes.json();

      if (checkData.status === "approved") {
        setError("Your account is already approved. Try signing in or use Resume Registration.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/lgu/request/reapply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) { setDone(true); }
      else { const err = await res.json(); setError(err.detail || "Failed to re-apply."); }

    } catch { setError("Server connection failed."); }
    finally { setSubmitting(false); }
  };

  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center">
          <Clock className="w-10 h-10 text-amber-400" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Re-application Submitted</h2>
        <p className="text-slate-300 text-sm">Your request has been sent back for admin review. You'll receive an email once a decision is made.</p>
      </div>
      <button onClick={onBack} className="w-full px-6 py-3 bg-slate-700 border border-slate-600 text-white font-semibold rounded-lg hover:bg-slate-600 transition-all">
        Back to Login
      </button>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Re-apply for LGU Access</h2>
            <p className="text-slate-400 text-xs">Enter your registered LGU email to re-submit your request</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <p className="text-xs text-amber-300 leading-relaxed">
          Your LGU access may have been revoked. Enter your registered email below to re-submit your request for administrator review.
        </p>
      </div>

      <AppInput
        label="Registered LGU Email"
        placeholder="yourname@lgu.gov.ph"
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        onKeyPress={(e) => e.key === 'Enter' && handleReapply()}
      />

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={handleReapply} disabled={submitting || !email.trim()}
        className="group w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
        {submitting
          ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span>Submitting...</span></div>
          : <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Re-submit Request</span>
        }
      </button>
    </motion.div>
  );
}
// ── Main Login Page ───────────────────────────────────────────────────────────
export default function Login() {
  const [view, setView] = useState("select");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const [showNova, setShowNova] = useState(false);

    useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") === "1") setView("resume");
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <svg className="hidden"><defs><filter id="blur-login">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter></defs></svg>
        <div className="h-full w-full blur-lg [filter:url(#blur-login)_blur(40px)]">
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.3)_0%,_transparent_50%)] animate-moveVertical mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.25)_0%,_transparent_50%)] animate-moveInCircle origin-[calc(50%-400px)] mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25)_0%,_transparent_50%)] animate-moveInCircleSlow origin-[calc(50%+400px)] mix-blend-hard-light" />
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(20,184,166,0.25)_0%,_transparent_50%)] animate-moveHorizontal origin-[calc(50%-200px)] opacity-70 mix-blend-hard-light" />
        </div>
      </div>
      <style>{`
        @keyframes moveVertical{0%,100%{transform:translateY(-50%)}50%{transform:translateY(50%)}}
        @keyframes moveHorizontal{0%,100%{transform:translateX(-50%) translateY(-10%)}50%{transform:translateX(50%) translateY(10%)}}
        @keyframes moveInCircle{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes moveInCircleSlow{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .animate-moveVertical{animation:moveVertical 30s ease infinite}
        .animate-moveHorizontal{animation:moveHorizontal 40s ease infinite}
        .animate-moveInCircle{animation:moveInCircle 20s reverse infinite}
        .animate-moveInCircleSlow{animation:moveInCircleSlow 40s linear infinite}
      `}</style>

      <main className="relative w-full max-w-6xl grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        <BorderTrail size={100} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }} style={{ boxShadow: '0px 0px 60px 30px rgba(20,184,166,0.4)' }} />
        <BrandPanel />

        <div className="relative flex flex-col justify-center p-8 sm:p-12 bg-slate-700/70 backdrop-blur-xl overflow-hidden min-h-[520px]"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>

          <AnimatePresence>{showNova && <NovaAboutCard onClose={() => setShowNova(false)} />}</AnimatePresence>

          <a href="/home" title="Home" className="absolute bottom-5 right-5 z-20 p-2.5 text-slate-400 hover:text-white transition-all rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-600/50 group">
            <House className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </a>

          <button onClick={() => setShowNova(true)}
            className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 group transition-all">
            <img src="/images/nova_logo.png" alt="Nova" className="w-4 h-4 rounded object-contain opacity-30 group-hover:opacity-70 transition-opacity" />
            <span className="text-[11px] text-slate-600 group-hover:text-slate-400 font-medium transition-colors">Built by Nova</span>
          </button>

          {hovering && (<div className="absolute pointer-events-none w-[500px] h-[500px] bg-gradient-to-r from-teal-300/20 via-cyan-300/20 to-purple-300/20 rounded-full blur-3xl" style={{ transform: `translate(${mousePos.x - 250}px, ${mousePos.y - 250}px)`, transition: 'transform 0.1s ease-out' }} />)}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)]" />

          <div className="flex items-center gap-3 mb-8 lg:hidden relative z-10">
            <img src="/roadsense.png" alt="RoadSense" className="w-10 h-10 rounded-lg object-cover" />
            <div><h1 className="text-xl font-bold text-white">RoadSense</h1><p className="text-xs text-slate-300">Road safety monitoring</p></div>
          </div>

          <div className="relative z-10 max-w-sm mx-auto w-full">
            <AnimatePresence mode="wait">
              {view === "select" && <RoleSelection key="select" onSignIn={() => setView("signin")} onGuest={() => setView("guest")} onResume={() => setView("resume")} />}
              {view === "signin" && <CombinedLogin key="signin" onBack={() => setView("select")} onRequestAccount={() => setView("lgu-signup")} onReapply={() => setView("reapply")} />}
              {view === "guest" && <GuestView key="guest" onBack={() => setView("select")} onRequestAccount={() => setView("lgu-signup")} />}
              {view === "lgu-signup" && <LGUSignupInline key="lgu-signup" onBack={() => setView("select")} />}
                {view === "reapply" && <ReapplyLGU key="reapply" onBack={() => setView("signin")} />}
              {view === "resume" && <ResumeRegistration key="resume" onBack={() => setView("select")} />}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}


