import { memo, useMemo } from "react";

const ParticleBackground = memo(() => {
  const particles = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      duration: 15 + Math.random() * 30,
      delay: Math.random() * 20,
      opacity: 0.2 + Math.random() * 0.6,
    }));
  }, []);

  const lines = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x1: Math.random() * 100,
      y1: Math.random() * 100,
      x2: Math.random() * 100,
      y2: Math.random() * 100,
      duration: 40 + Math.random() * 40,
      delay: Math.random() * 20,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-background transition-colors duration-500" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] animate-pulse-glow"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] animate-float"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.3), transparent)" }} />

      {/* Decorative curved lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        {lines.map((l) => (
          <line
            key={l.id}
            x1={`${l.x1}%`} y1={`${l.y1}%`}
            x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke="hsl(var(--primary))"
            strokeWidth="1"
            opacity="0.5"
          >
            <animate attributeName="x1" values={`${l.x1}%;${(l.x1 + 10) % 100}%;${l.x1}%`} dur={`${l.duration}s`} repeatCount="indefinite" />
            <animate attributeName="y1" values={`${l.y1}%;${(l.y1 + 15) % 100}%;${l.y1}%`} dur={`${l.duration * 1.2}s`} repeatCount="indefinite" />
          </line>
        ))}
      </svg>

      {/* Particles / stars */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full particle-dot"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            background: "hsl(var(--primary))",
            boxShadow: `0 0 ${p.size * 3}px hsl(var(--primary) / 0.5)`,
            animation: `particle-float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Floating small icons */}
      <div className="absolute top-[15%] right-[20%] text-primary/20 animate-float text-2xl">⚡</div>
      <div className="absolute top-[60%] left-[8%] text-primary/15 animate-float-reverse text-xl">🌙</div>
      <div className="absolute bottom-[25%] right-[15%] text-accent/20 animate-float text-lg">📦</div>
      <div className="absolute top-[35%] right-[35%] text-primary/10 animate-pulse-glow text-xl">⭐</div>
    </div>
  );
});

ParticleBackground.displayName = "ParticleBackground";
export default ParticleBackground;
