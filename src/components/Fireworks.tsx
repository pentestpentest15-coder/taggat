import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

const COLORS = ['#00ff9d', '#00d4ff', '#ff2e88', '#ffaa00', '#ff3355', '#ffffff'];

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    let animationId = 0;

    function launchFirework() {
      const x = Math.random() * canvas.width;
      const y = canvas.height;
      const targetY = Math.random() * canvas.height * 0.4 + canvas.height * 0.1;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const rocket: Particle = {
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -(canvas.height - targetY) / 40,
        color,
        life: 60,
        maxLife: 60,
        size: 3,
      };
      rocketParticles.push(rocket);
    }

    const rocketParticles: Particle[] = [];

    function explode(x: number, y: number, color: string) {
      const count = 40 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          life: 60 + Math.random() * 30,
          maxLife: 90,
          size: 2 + Math.random() * 2,
        });
      }
    }

    let lastLaunch = 0;
    let frameCount = 0;

    function animate() {
      frameCount++;
      ctx.fillStyle = 'rgba(8, 11, 18, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (frameCount - lastLaunch > 25 && frameCount < 300) {
        launchFirework();
        lastLaunch = frameCount;
      }

      for (let i = rocketParticles.length - 1; i >= 0; i--) {
        const r = rocketParticles[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.05;
        r.life--;
        if (r.life <= 0 || r.vy >= 0) {
          explode(r.x, r.y, r.color);
          rocketParticles.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
          ctx.fillStyle = r.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = r.color;
          ctx.fill();
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.vx *= 0.99;
        p.life--;
        const alpha = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) {
          particles.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (frameCount < 400 || particles.length > 0 || rocketParticles.length > 0) {
        animationId = requestAnimationFrame(animate);
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
