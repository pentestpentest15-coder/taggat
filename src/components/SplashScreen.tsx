import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'expand' | 'fade' | 'done'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('expand'), 900);
    const t2 = setTimeout(() => setPhase('fade'), 2600);
    const t3 = setTimeout(() => setPhase('done'), 3200);
    const t4 = setTimeout(() => onComplete(), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  const overlayOpacity = phase === 'fade' ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-cyber-bg"
      style={{
        opacity: overlayOpacity,
        transition: 'opacity 1s ease-out',
      }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-bg" />

      {/* Ambient glow that intensifies */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle, rgba(0,255,157,0.12) 0%, rgba(0,212,255,0.06) 40%, transparent 70%)',
          transform: phase === 'expand' || phase === 'fade' ? 'scale(2.4)' : 'scale(1)',
          opacity: phase === 'fade' ? 0 : phase === 'expand' ? 1 : 0.4,
          transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease-out',
        }}
      />

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,255,157,0.6), transparent)',
          boxShadow: '0 0 12px rgba(0,255,157,0.5)',
          animation: 'scanLine 2.4s linear infinite',
        }}
      />

      {/* Logo container - scales up progressively */}
      <div className="relative flex flex-col items-center justify-center">
        <div
          className="relative flex items-center justify-center rounded-2xl border border-[#00ff9d]/20 overflow-hidden bg-black"
          style={{
            width: phase === 'enter' ? '96px' : phase === 'expand' ? '240px' : '1800px',
            height: phase === 'enter' ? '96px' : phase === 'expand' ? '240px' : '1800px',
            boxShadow:
              phase === 'fade'
                ? '0 0 120px rgba(0,255,157,0.4)'
                : phase === 'expand'
                ? '0 0 64px rgba(0,255,157,0.25)'
                : '0 0 32px rgba(0,255,157,0.12)',
            transition:
              'width 1.5s cubic-bezier(0.22, 1, 0.36, 1), height 1.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.8s ease-out',
          }}
        >
          <img
            src="/2125FDD5-E2B2-40EB-A24A-352C069DF8F7.PNG"
            alt="Logo PentestLab"
            className="w-full h-full object-cover"
            style={{
              opacity: phase === 'fade' ? 0 : 1,
              transition: 'opacity 0.6s ease-out',
            }}
          />
        </div>

        {/* Title that fades out as logo expands */}
        <div
          className="absolute top-full mt-8 text-center pointer-events-none"
          style={{
            opacity: phase === 'enter' ? 0 : phase === 'expand' ? 1 : 0,
            transform: phase === 'expand' ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <h1 className="text-2xl font-bold text-cyber-text tracking-tight">PentestLab</h1>
          <p className="text-cyber-text-muted mt-1 text-xs font-mono">Jàngé Ci Jëf</p>
        </div>
      </div>

      {/* Bottom loading bar */}
      <div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 h-0.5 rounded-full overflow-hidden"
        style={{
          background: 'rgba(30, 42, 58, 0.6)',
          opacity: phase === 'fade' ? 0 : 1,
          transition: 'opacity 0.4s ease-out',
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--neon-dim), var(--neon))',
            boxShadow: '0 0 8px rgba(0,255,157,0.5)',
            width: phase === 'enter' ? '8%' : phase === 'expand' ? '70%' : '100%',
            transition: 'width 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  );
}
