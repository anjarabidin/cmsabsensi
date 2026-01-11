import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 600);
    }, 2000); // Optimized: 3.2s → 2s for faster loading

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 cubic-bezier(0.23, 1, 0.32, 1)",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none scale-105"
      )}
    >
      <style>{`
        @keyframes liquidBg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes entranceLogo {
          0% { transform: scale(0.8) translateY(20px); opacity: 0; filter: blur(10px); }
          100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
        }

        @keyframes ringPulse {
          0% { transform: scale(0.8); opacity: 0; }
          50% { opacity: 0.3; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        @keyframes shimmerLine {
          0% { left: -100%; top: -100%; }
          100% { left: 100%; top: 100%; }
        }

        .bg-vibrant {
          background: linear-gradient(-45deg, #ffffff, #f0f9ff, #f0fdf4, #ffffff);
          background-size: 400% 400%;
          animation: liquidBg 12s ease infinite;
          position: absolute;
          inset: 0;
          z-index: -2;
        }

        .pulse-ring {
          position: absolute;
          border: 1.5px solid rgba(31, 76, 154, 0.15);
          border-radius: 50%;
          animation: ringPulse 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        }

        .premium-glass {
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 40px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
          animation: entranceLogo 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @media (min-width: 768px) {
          .premium-glass {
            border-radius: 70px;
            padding: 60px 80px;
          }
        }

        .glass-shimmer {
          position: absolute;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg, 
            transparent 45%, 
            rgba(255,255,255,0.4) 50%, 
            transparent 55%
          );
          animation: shimmerLine 3.5s infinite;
          pointer-events: none;
        }

        .brand-text {
          animation: entranceLogo 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s backwards;
        }
      `}</style>

      {/* Background Layers */}
      <div className="bg-vibrant" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center px-6 w-full max-w-lg">
        {/* Animated Rings - Responsive Size */}
        <div className="pulse-ring w-[240px] h-[240px] md:w-[320px] md:h-[320px]" />
        <div className="pulse-ring w-[320px] h-[320px] md:w-[450px] md:h-[450px]" style={{ animationDelay: '1.5s' }} />

        {/* The Glass Box */}
        <div className="premium-glass flex flex-col items-center w-full">
          <div className="glass-shimmer" />

          <div className="relative w-40 md:w-52 mb-8 drop-shadow-xl">
            <img
              src="/logo.png"
              alt="CMS Duta Solusi"
              className="w-full h-auto object-contain mix-blend-multiply"
            />
          </div>

          <div className="flex flex-col items-center gap-1 brand-text">
            <h1 className="text-5xl md:text-6xl font-black text-[#1f4c9a] tracking-[0.3em] ml-3">
              CMS
            </h1>
            <div className="h-[2px] w-10 bg-gradient-to-r from-[#1f4c9a] to-[#3AAA35] rounded-full my-2" />
            <span className="text-[10px] md:text-xs font-black text-slate-400 tracking-[0.6em] uppercase text-center">
              Duta Solusi
            </span>
          </div>
        </div>

        {/* Quick Progress Loader */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-600/30 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>

          <span className="text-[9px] font-bold text-[#1f4c9a]/60 tracking-[0.5em] uppercase">
            Loading System...
          </span>
        </div>
      </div>

      {/* Footer Details - Subtle for Mobile */}
      <div className="absolute bottom-8 flex flex-col items-center">
        <div className="text-[9px] font-bold text-slate-300 tracking-[0.4em] uppercase">
          CMS Duta Solusi
        </div>
      </div>
    </div>
  );
};
