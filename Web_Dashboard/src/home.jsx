import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MeshGradient } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";

export default function Home() {
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-900 overflow-hidden">
      {/* MeshGradient Background */}
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={["#0f172a", "#1e293b", "#14b8a6", "#0d9488", "#134e4a", "#083344"]}
              distortion={0.8}
              swirl={0.6}
              grainMixer={0}
              grainOverlay={0}
              speed={0.5}
              offsetX={0.08}
            />
            <div className="absolute inset-0 pointer-events-none bg-slate-900/40" />
          </>
        )}
      </div>

      <style>{`
        @keyframes shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .shiny-text {
    background: linear-gradient(
      90deg,
      #14b8a6 0%,
      #2dd4bf 25%,
      #5eead4 50%,
      #2dd4bf 75%,
      #14b8a6 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shine 3s linear infinite;
    font-weight: 800;
    filter: drop-shadow(0 0 15px rgba(45, 212, 191, 0.5));
  }
      `}</style>

      {/* Overlay gradients for depth */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-900/60 via-transparent to-slate-900/60" />
      <div className="absolute top-0 z-0 h-screen w-screen bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(45,212,191,0.2),rgba(255,255,255,0))]" />

      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img 
            src="/roadsense.png" 
            alt="RoadSense Logo" 
            className="w-10 h-10 object-contain"
          />
          <span className="text-xl font-bold text-white">RoadSense</span>
        </div>
        
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 rounded-full text-white font-medium border border-teal-500/30 bg-slate-800/50 backdrop-blur-sm hover:bg-slate-700/50 hover:border-teal-500/50 transition-all"
        >
          Login
        </button>
      </nav>

      <section className="relative max-w-full mx-auto z-10">
        <div className="max-w-screen-xl z-10 mx-auto px-4 py-28 gap-12 md:px-8">
          <div className="space-y-5 max-w-3xl leading-0 lg:leading-5 mx-auto text-center">
            {/* Badge */}
            <h1 className="text-sm text-gray-400 group font-geist mx-auto px-5 py-2 bg-gradient-to-tr from-teal-500/10 via-teal-400/10 to-transparent border-[2px] border-teal-500/20 rounded-3xl w-fit">
              Smart Road Safety Platform
              <ChevronRight className="inline w-4 h-4 ml-2 group-hover:translate-x-1 duration-300" />
            </h1>

            {/* Main Heading */}
            <h2 className="text-4xl tracking-tighter font-bold md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
              Drive Safe, Stay Smart with{" "}
              <span className="shiny-text">
                RoadSense
              </span>
            </h2>

            {/* Description */}
            <p className="max-w-2xl mx-auto text-gray-300 text-lg">
              Your intelligent companion for safer journeys. RoadSense monitors road conditions, 
              tracks safety metrics, and provides real-time alerts to keep you protected on every drive.
            </p>

            {/* CTA Button with Glass + Gradient */}
            <div className="items-center justify-center gap-x-3 space-y-3 sm:flex sm:space-y-0 pt-6">
              <span className="relative inline-block overflow-hidden rounded-full p-[2px]">
                {/* Animated gradient border */}
                <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#14b8a6_0%,#06b6d4_25%,#2dd4bf_50%,#06b6d4_75%,#14b8a6_100%)]" />
                
                {/* Glass button container */}
                <div className="relative inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-900/80 backdrop-blur-xl">
                  <button
                    onClick={() => navigate('/signup')}
                    className="relative inline-flex rounded-full text-center group items-center w-full justify-center text-white sm:w-auto py-4 px-10 text-lg font-medium overflow-hidden"
                  >
                    {/* Gradient background */}
                    <span className="absolute inset-0 bg-gradient-to-br from-teal-500/30 via-cyan-400/20 to-teal-600/30 opacity-80 group-hover:opacity-100 transition-opacity duration-300"></span>
                    
                    {/* Glass overlay */}
                    <span className="absolute inset-0 bg-white/5 backdrop-blur-sm"></span>
                    
                    {/* Shine effect on hover */}
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                    
                    {/* Button text */}
                    <span className="relative flex items-center gap-2">
                      Get Started
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                  </button>
                </div>
              </span>
            </div>

            {/* Secondary Info */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-gray-400 pt-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <span>Real-time Monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <span>Instant Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <span>Safety Reports</span>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-24 grid md:grid-cols-3 gap-6 px-4">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-teal-500/20 rounded-xl p-6 hover:border-teal-500/40 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Safety Monitoring</h3>
              <p className="text-gray-400">Track road conditions and receive alerts about potential hazards in real-time.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-teal-500/20 rounded-xl p-6 hover:border-teal-500/40 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Analytics & Reports</h3>
              <p className="text-gray-400">Get detailed insights and analytics about your driving patterns and safety score.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-teal-500/20 rounded-xl p-6 hover:border-teal-500/40 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Route Tracking</h3>
              <p className="text-gray-400">Monitor your routes and discover safer alternatives for your daily commute.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}