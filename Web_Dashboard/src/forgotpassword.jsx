import { useState, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Mail, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from './config';

// BorderTrail Component
function BorderTrail({ size = 60, transition, style }) {
  const BASE_TRANSITION = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div className='pointer-events-none absolute inset-0 rounded-2xl border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]'>
      <motion.div
        className="absolute aspect-square"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: 'linear-gradient(90deg, rgba(20, 184, 166, 0) 0%, rgba(20, 184, 166, 1) 30%, rgba(45, 212, 191, 1) 50%, rgba(20, 184, 166, 1) 70%, rgba(20, 184, 166, 0) 100%)',
          filter: 'brightness(1.5)',
          ...style,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={transition ?? BASE_TRANSITION}
      />
    </div>
  );
}

// Floating Paths Background
function FloatingPaths({ position }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-teal-400" viewBox="0 0 696 316" fill="none">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={0.5 + path.id * 0.03}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  );
}

// Email Input with hover glow effect
function EmailInput({ label, placeholder, value, onChange, onKeyPress }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative w-full">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="email"
          value={value}
          onChange={onChange}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          className="peer relative z-10 w-full pl-10 pr-4 py-3 bg-slate-700/50 border-2 border-slate-600/50 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:bg-slate-700/70 focus:border-teal-500/50 transition-all duration-200"
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        />
        {isHovering && (
          <>
            <div
              className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 0px, rgba(45, 212, 191, 1) 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 2px, rgba(45, 212, 191, 1) 0%, transparent 70%)`,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState("");
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleSubmit = async () => {
  if (!email.trim()) return;
  setLoading(true);
  setError("");
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setSent(true);
    } else {
      setError(data.detail || "Something went wrong. Please try again.");
    }
  } catch {
    setError("Server connection failed. Is the API running?");
  } finally {
    setLoading(false);
  }
};
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !sent) handleSubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <svg className="hidden">
          <defs>
            <filter id="blurMe2">
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
              <feBlend in="SourceGraphic" in2="goo" />
            </filter>
          </defs>
        </svg>

        <div className="gradients-container h-full w-full blur-lg [filter:url(#blurMe2)_blur(40px)]">
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.3)_0%,_transparent_50%)] animate-moveVertical opacity-100 mix-blend-hard-light"></div>
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.25)_0%,_transparent_50%)] animate-moveInCircle origin-[calc(50%-400px)] opacity-100 mix-blend-hard-light"></div>
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25)_0%,_transparent_50%)] animate-moveInCircleSlow origin-[calc(50%+400px)] opacity-100 mix-blend-hard-light"></div>
          <div className="absolute w-[80%] h-[80%] top-[10%] left-[10%] bg-[radial-gradient(circle_at_center,_rgba(20,184,166,0.25)_0%,_transparent_50%)] animate-moveHorizontal origin-[calc(50%-200px)] opacity-70 mix-blend-hard-light"></div>
        </div>
      </div>

      <style>{`
        @keyframes moveVertical {
          0%, 100% { transform: translateY(-50%); }
          50% { transform: translateY(50%); }
        }
        @keyframes moveHorizontal {
          0%, 100% { transform: translateX(-50%) translateY(-10%); }
          50% { transform: translateX(50%) translateY(10%); }
        }
        @keyframes moveInCircle {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes moveInCircleSlow {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-moveVertical { animation: moveVertical 30s ease infinite; }
        .animate-moveHorizontal { animation: moveHorizontal 40s ease infinite; }
        .animate-moveInCircle { animation: moveInCircle 20s reverse infinite; }
        .animate-moveInCircleSlow { animation: moveInCircleSlow 40s linear infinite; }

        @keyframes float-envelope {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        .animate-float-envelope {
          animation: float-envelope 3s ease-in-out infinite;
        }
      `}</style>

      <main className="relative w-full max-w-6xl grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        <BorderTrail
          size={100}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          style={{ boxShadow: '0px 0px 60px 30px rgba(20, 184, 166, 0.4)' }}
        />

        {/* Left Panel - Brand Showcase */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-800/90 backdrop-blur-xl border-r border-slate-600/50">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent z-10" />

          <div className="absolute inset-0">
            <FloatingPaths position={1} />
            <FloatingPaths position={-1} />
          </div>

          <div className="relative z-20 space-y-6">
            <div className="flex items-center gap-3">
              <img
                src="/roadsense.png"
                alt="RoadSense Logo"
                className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-teal-500/30"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">RoadSense</h1>
                <p className="text-sm text-slate-300">Smart monitoring for safer roads</p>
              </div>
            </div>
          </div>

          {/* Centered decorative envelope illustration */}
          <div className="relative z-20 flex flex-col items-center justify-center flex-1 py-12">
            <div className="animate-float-envelope">
              <div className="w-40 h-28 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/30 to-cyan-600/20 border border-teal-500/40 rounded-xl backdrop-blur-sm" />
                <div className="absolute top-0 left-0 right-0 h-14 overflow-hidden rounded-t-xl">
                  <div
                    className="w-full h-full border-b border-teal-500/30"
                    style={{
                      background: 'linear-gradient(135deg, transparent 50%, rgba(45,212,191,0.15) 50%)',
                    }}
                  />
                </div>
                <div className="absolute bottom-4 left-6 right-6 space-y-1.5">
                  <div className="h-[2px] bg-teal-400/30 rounded" />
                  <div className="h-[2px] bg-teal-400/20 rounded w-3/4" />
                </div>
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-teal-400/50">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-slate-400 max-w-[200px]">
              We'll send a reset link straight to your inbox
            </p>
          </div>

          {/* Decorative grid */}
          <div className="absolute bottom-0 right-0 w-64 h-64 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <pattern id="grid-fp" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-fp)" />
            </svg>
          </div>
        </div>

        {/* Right Panel - Forgot Password Form */}
        <div
          className="relative flex flex-col justify-center p-8 sm:p-12 bg-slate-700/70 backdrop-blur-xl overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Mouse glow effect */}
          {isHovering && (
            <div
              className="absolute pointer-events-none w-[500px] h-[500px] bg-gradient-to-r from-teal-300/20 via-cyan-300/20 to-purple-300/20 rounded-full blur-3xl"
              style={{
                transform: `translate(${mousePosition.x - 250}px, ${mousePosition.y - 250}px)`,
                transition: 'transform 0.1s ease-out',
              }}
            />
          )}

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)]" />

          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden relative z-10">
            <img
              src="/roadsense.png"
              alt="RoadSense Logo"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-xl font-bold text-white">RoadSense</h1>
              <p className="text-xs text-slate-300">Road safety monitoring</p>
            </div>
          </div>

          <div className="relative z-10 max-w-sm mx-auto w-full space-y-6">
            <AnimatePresence mode="wait">
              {sent ? (
                /* ── Success State ── */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                    className="flex justify-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <CheckCircle className="w-10 h-10 text-teal-400" />
                    </div>
                  </motion.div>

                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-bold text-white">Check your email</h2>
                    <p className="text-slate-300 text-sm">
                      We sent a password reset link to
                    </p>
                    <p className="text-teal-300 font-semibold text-sm break-all">
                      {email}
                    </p>
                    <p className="text-slate-400 text-xs pt-1">
                      Didn't receive it? Check your spam folder or try again.
                    </p>
                  </div>
                  {error && (
  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
    {error}
  </p>
  )}
                  <button
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="group relative w-full px-6 py-3 bg-slate-600/50 border border-slate-500/50 text-slate-300 font-semibold rounded-lg overflow-hidden transition-all hover:bg-slate-600 hover:text-white hover:border-slate-400"
                  >
                    Try a different email
                  </button>

                  <div className="text-center">
                    <a
                      href="/login"
                      className="text-sm text-teal-300 hover:text-teal-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Back to sign in
                    </a>
                  </div>
                </motion.div>
              ) : (
                /* ── Form State ── */
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Forgot password?</h2>
                    <p className="text-slate-300 text-sm">
                      No worries — enter your email and we'll send you a reset link.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <EmailInput
                      label="Email address"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading || !email.trim()}
                      className="group relative w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending...</span>
                        </div>
                      ) : (
                        <>
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            Send Reset Link
                            <Mail className="w-4 h-4" />
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <a
                      href="/login"
                      className="text-sm text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Back to sign in
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}


