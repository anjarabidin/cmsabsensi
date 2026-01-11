import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 1000);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none scale-105"
      )}
    >
      <style>{`
        @keyframes meshGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes blobMotion {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        @keyframes drawOuterC {
          0% { stroke-dashoffset: 600; opacity: 0; }
          20% { opacity: 1; }
          100% { stroke-dashoffset: 0; }
        }

        @keyframes revealInnerGreen {
          0% { transform: scale(0); opacity: 0; filter: blur(10px); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }

        @keyframes slideInText {
          0% { transform: translateX(-20px); opacity: 0; letter-spacing: 0.5em; }
          100% { transform: translateX(0); opacity: 1; letter-spacing: 0em; }
        }

        @keyframes fadeInSubText {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .bg-mesh {
          background: linear-gradient(-45deg, #f8fafc, #eff6ff, #f0fdf4, #ffffff);
          background-size: 400% 400%;
          animation: meshGradient 15s ease infinite;
        }

        .blob {
          position: absolute;
          filter: blur(80px);
          z-index: -1;
          opacity: 0.6;
          animation: blobMotion 10s ease-in-out infinite;
        }

        .animate-draw-c {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: drawOuterC 1.8s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .animate-reveal-green {
          animation: revealInnerGreen 1s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards;
          opacity: 0;
        }

        .animate-reveal-text {
          animation: slideInText 1s cubic-bezier(0.22, 1, 0.36, 1) 1.8s forwards;
          opacity: 0;
        }

        .animate-reveal-subtext {
          animation: fadeInSubText 0.8s ease-out 2.4s forwards;
          opacity: 0;
        }

        .logo-shadow {
          filter: drop-shadow(0 20px 30px rgba(43, 78, 145, 0.15));
        }
      `}</style>

      {/* Premium Background Layers */}
      <div className="bg-mesh absolute inset-0 -z-20" />
      <div className="blob w-[500px] h-[500px] bg-blue-100 rounded-full top-[-100px] left-[-100px]" />
      <div className="blob w-[400px] h-[400px] bg-green-50 rounded-full bottom-[-100px] right-[-100px]" style={{ animationDelay: '-5s' }} />

      {/* Main Content Container with Glassmorphism */}
      <div className="relative flex flex-col items-center justify-center p-12 bg-white/30 backdrop-blur-xl rounded-[60px] border border-white/50 shadow-2xl scale-[1.1]">

        {/* Accurate SVG Logo Construction */}
        <div className="relative w-48 h-48 mb-8 logo-shadow">
          <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* The Blue 'C' Shape - Accurate to Logo Geometry */}
            <path
              d="M165,65 C155,50 135,40 110,40 C70,40 40,70 40,110 C40,150 70,180 110,180 C135,180 155,170 165,155 L165,130 C155,145 140,150 115,150 C90,150 70,130 70,105 C70,80 90,60 115,60 C140,60 155,65 165,80 L165,65Z"
              fill="#2B4E91"
              className="animate-draw-c"
              style={{ stroke: '#2B4E91', strokeWidth: '0.5' }}
            />

            {/* The Green Inner Node - Accurate to Bulbous Connection */}
            <g className="animate-reveal-green">
              {/* Left Circle */}
              <circle cx="85" cy="110" r="22" fill="#4FA944" />
              {/* Connection Neck */}
              <path
                d="M100,100 C115,95 130,100 145,110 C130,120 115,125 100,120 Z"
                fill="#4FA944"
              />
              {/* Right Bulb */}
              <circle cx="140" cy="110" r="16" fill="#4FA944" />
            </g>
          </svg>
        </div>

        {/* Dynamic Text Assembly */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline space-x-1 animate-reveal-text">
            <span className="text-6xl font-black tracking-tight" style={{ color: '#2B4E91' }}>CMS</span>
          </div>
          <div className="mt-2 animate-reveal-subtext">
            <span className="text-lg font-bold tracking-[0.4em] uppercase" style={{ color: '#4FA944' }}>
              DUTA SOLUSI
            </span>
          </div>
        </div>

        {/* Elegant Progress Indicator */}
        <div className="mt-12 w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#2B4E91] to-[#4FA944] animate-[meshGradient_2s_linear_infinite]" style={{ width: '40%', backgroundSize: '200% 100%' }} />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-12 flex flex-col items-center animate-pulse">
        <span className="text-[10px] font-black tracking-[0.5em] text-slate-400 uppercase">
          Corporate Management System
        </span>
      </div>
    </div>
  );
};
