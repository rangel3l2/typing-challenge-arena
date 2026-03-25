import { memo } from "react";

const SkyBackground = memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, hsl(205 85% 55%) 0%, hsl(200 75% 65%) 30%, hsl(195 70% 75%) 60%, hsl(190 60% 85%) 85%, hsl(40 50% 85%) 100%)',
        }}
      />

      {/* Sun */}
      <div
        className="absolute w-20 h-20 sm:w-28 sm:h-28 rounded-full"
        style={{
          top: '8%',
          right: '12%',
          background: 'radial-gradient(circle, hsl(45 100% 90%) 0%, hsl(40 95% 70%) 50%, transparent 70%)',
          boxShadow: '0 0 60px 20px hsl(45 100% 80% / 0.4)',
        }}
      />

      {/* Cloud layer 1 - large slow clouds */}
      <div className="absolute w-full h-full">
        <Cloud x="5%" y="10%" size="lg" delay={0} duration={90} />
        <Cloud x="60%" y="5%" size="xl" delay={10} duration={110} />
        <Cloud x="30%" y="25%" size="md" delay={25} duration={80} />
        <Cloud x="80%" y="18%" size="lg" delay={40} duration={100} />
      </div>

      {/* Cloud layer 2 - mid clouds */}
      <div className="absolute w-full h-full">
        <Cloud x="15%" y="35%" size="sm" delay={5} duration={70} opacity={0.7} />
        <Cloud x="50%" y="40%" size="md" delay={15} duration={75} opacity={0.6} />
        <Cloud x="75%" y="30%" size="sm" delay={30} duration={65} opacity={0.7} />
        <Cloud x="-10%" y="45%" size="lg" delay={50} duration={85} opacity={0.5} />
      </div>

      {/* Cloud layer 3 - wispy high clouds */}
      <div className="absolute w-full h-full">
        <Cloud x="20%" y="55%" size="xs" delay={8} duration={60} opacity={0.4} />
        <Cloud x="65%" y="60%" size="xs" delay={20} duration={55} opacity={0.35} />
      </div>

      {/* Distant mountains/hills silhouette at bottom */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ height: '8%' }}>
        <path d="M0,120 L0,80 Q120,30 240,70 Q360,20 480,60 Q600,10 720,50 Q840,25 960,65 Q1080,15 1200,55 Q1320,35 1440,70 L1440,120 Z" fill="hsl(140 30% 35% / 0.3)" />
        <path d="M0,120 L0,90 Q180,50 360,85 Q540,40 720,75 Q900,45 1080,80 Q1260,55 1440,85 L1440,120 Z" fill="hsl(140 25% 30% / 0.25)" />
      </svg>
    </div>
  );
});

interface CloudProps {
  x: string;
  y: string;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  delay: number;
  duration: number;
  opacity?: number;
}

const sizeMap = {
  xs: { w: 'w-16 sm:w-24', h: 'h-6 sm:h-8' },
  sm: { w: 'w-24 sm:w-36 md:w-44', h: 'h-8 sm:h-10 md:h-12' },
  md: { w: 'w-32 sm:w-48 md:w-56', h: 'h-10 sm:h-14 md:h-16' },
  lg: { w: 'w-44 sm:w-64 md:w-72', h: 'h-14 sm:h-18 md:h-20' },
  xl: { w: 'w-56 sm:w-80 md:w-96', h: 'h-16 sm:h-20 md:h-24' },
};

const Cloud = memo(({ x, y, size, delay, duration, opacity = 0.85 }: CloudProps) => {
  const s = sizeMap[size];
  const animName = `cloud-drift-${x.replace('%', '')}-${y.replace('%', '')}`;

  return (
    <>
      <style>{`
        @keyframes ${animName} {
          0% { transform: translateX(0); }
          50% { transform: translateX(30px); }
          100% { transform: translateX(0); }
        }
      `}</style>
      <div
        className={`absolute ${s.w} ${s.h}`}
        style={{
          left: x,
          top: y,
          opacity,
          animation: `${animName} ${duration}s ease-in-out infinite`,
          animationDelay: `${delay}s`,
        }}
      >
        {/* Cloud shape using multiple overlapping circles */}
        <div className="relative w-full h-full">
          <div className="absolute inset-x-[10%] bottom-0 h-[60%] rounded-full bg-white/90" />
          <div className="absolute left-[5%] bottom-[20%] w-[40%] h-[80%] rounded-full bg-white/85" />
          <div className="absolute right-[8%] bottom-[15%] w-[45%] h-[85%] rounded-full bg-white/80" />
          <div className="absolute left-[25%] bottom-[30%] w-[35%] h-[90%] rounded-full bg-white/90" />
        </div>
      </div>
    </>
  );
});

Cloud.displayName = 'Cloud';
SkyBackground.displayName = 'SkyBackground';

export default SkyBackground;
