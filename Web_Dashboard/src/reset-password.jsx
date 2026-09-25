import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle, X, ChevronRight, Lock } from 'lucide-react';
import { API_BASE_URL } from './config';

const PW_RULES = [
  { id: "len",     label: "At least 8 characters",        test: (v) => v.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",   test: (v) => /[A-Z]/.test(v) },
  { id: "number",  label: "One number (0–9)",             test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "One special character (!@#…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function PasswordInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full">
      {label && <label className="block mb-1.5 text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-slate-700/50 border-2 border-slate-600/50 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:bg-slate-700/70 focus:border-teal-500/50 transition-all duration-200"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 text-slate-400 hover:text-teal-400 transition-colors">
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [tokenValid, setTokenValid] = useState(true);

  const passed = PW_RULES.filter(r => r.test(password)).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-teal-500"];
  const pwValid = passed === 4;
  const canSubmit = pwValid && password === confirmPw && !loading;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenValid(false);
      setError("Invalid or missing reset link. Please request a new one.");
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.detail || "Something went wrong. Please try again.");
        if (res.status === 400) setTokenValid(false);
      }
    } catch {
      setError("Server connection failed. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Same animated background as forgot-password.jsx */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[60%] h-[60%] top-[10%] left-[20%] bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.15)_0%,_transparent_60%)]" />
        <div className="absolute w-[40%] h-[40%] bottom-[10%] right-[10%] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.1)_0%,_transparent_60%)]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="relative bg-slate-700/70 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-600/30">
          {/* Teal glow border */}
          <div className="absolute inset-0 rounded-2xl border border-teal-500/20 pointer-events-none" />

          <AnimatePresence mode="wait">
            {done ? (
              /* ── Success ── */
              <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                  className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg shadow-teal-500/20">
                    <CheckCircle className="w-10 h-10 text-teal-400" />
                  </div>
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">Password Reset!</h2>
                  <p className="text-slate-300 text-sm">Your password has been updated successfully. You can now sign in with your new password.</p>
                </div>
                <a href="/login"
                  className="block w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg text-center transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
                  Back to Sign In
                </a>
              </motion.div>
            ) : !tokenValid ? (
              /* ── Invalid token ── */
              <motion.div key="invalid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <X className="w-10 h-10 text-red-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">Link Expired</h2>
                  <p className="text-slate-400 text-sm">{error || "This reset link is invalid or has expired."}</p>
                </div>
                <a href="/forgot-password"
                  className="block w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg text-center transition-all hover:shadow-lg hover:scale-[1.02]">
                  Request New Link
                </a>
                <a href="/login" className="block text-sm text-slate-400 hover:text-white text-center transition-colors">
                  Back to sign in
                </a>
              </motion.div>
            ) : (
              /* ── Form ── */
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <img src="/roadsense.png" alt="RoadSense" className="w-9 h-9 rounded-lg object-cover" />
                  <div>
                    <h1 className="text-lg font-bold text-white">RoadSense</h1>
                    <p className="text-xs text-slate-400">Smart monitoring for safer roads</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white">Set New Password</h2>
                  <p className="text-slate-400 text-sm">Choose a strong password for your account.</p>
                </div>

                <div className="space-y-4">
                  {/* Password */}
                  <div>
                    <PasswordInput label="New Password" value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Enter new password" />
                    {/* Strength bar */}
                    {password && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-2">
                        <div className="flex gap-1">
                          {[0,1,2,3].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < passed ? colors[passed-1] : "bg-slate-700"}`} />
                          ))}
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

                  {/* Confirm */}
                  <div>
                    <PasswordInput label="Confirm Password" value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
                    {confirmPw && (
                      <p className={`text-[11px] mt-1 flex items-center gap-1 ${confirmPw === password ? "text-teal-400" : "text-red-400"}`}>
                        {confirmPw === password
                          ? <><CheckCircle className="w-3 h-3" /> Passwords match</>
                          : <><X className="w-3 h-3" /> Passwords do not match</>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button onClick={handleSubmit} disabled={!canSubmit}
                  className="group w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Resetting...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Reset Password <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>

                <a href="/login" className="block text-center text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1">
                  <ChevronRight className="w-3 h-3 rotate-180" /> Back to sign in
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


