import type { ReactNode } from 'react';
import { CircleHelp as HelpCircle, Check, Circle, Loader as Loader2, TriangleAlert as AlertTriangle, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text tracking-tight">{title}</h1>
        {subtitle && <p className="text-cyber-text-muted text-sm mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-cyber-border rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-[#00ff9d] rounded-full animate-spin" style={{ boxShadow: '0 0 12px rgba(0, 255, 157, 0.3)' }} />
      </div>
      {label && <p className="text-sm text-cyber-text-muted font-mono">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-cyber-surface rounded-2xl flex items-center justify-center mb-4 border border-cyber-border relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00ff9d]/5 to-transparent" />
        <div className="relative">{icon}</div>
      </div>
      <h3 className="text-cyber-text-dim font-medium">{title}</h3>
      {description && <p className="text-cyber-text-muted text-sm mt-1.5 max-w-sm">{description}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const sizeClass = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className={`relative card w-full ${sizeClass} max-h-[90vh] overflow-hidden flex flex-col animate-fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-border">
          <h2 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
            <span className="w-1 h-5 bg-[#00ff9d] rounded-full" style={{ boxShadow: '0 0 8px rgba(0, 255, 157, 0.5)' }} />
            {title}
          </h2>
          <button onClick={onClose} className="text-cyber-text-muted hover:text-cyber-text-dim text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cyber-surface-hover transition-all">×</button>
        </div>
        <div className="overflow-y-auto scrollbar-thin p-6">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'success' | 'error'; onClose: () => void }) {
  const colors = {
    info: { bg: 'rgba(0, 212, 255, 0.1)', border: 'rgba(0, 212, 255, 0.25)', text: '#00d4ff', glow: 'rgba(0, 212, 255, 0.15)' },
    success: { bg: 'rgba(0, 255, 157, 0.1)', border: 'rgba(0, 255, 157, 0.25)', text: '#00ff9d', glow: 'rgba(0, 255, 157, 0.15)' },
    error: { bg: 'rgba(255, 51, 85, 0.1)', border: 'rgba(255, 51, 85, 0.25)', text: '#ff3355', glow: 'rgba(255, 51, 85, 0.15)' },
  };
  const c = colors[type];
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg border backdrop-blur-xl" style={{ background: c.bg, borderColor: c.border, boxShadow: `0 4px 24px ${c.glow}` }}>
        <span className="text-sm font-medium" style={{ color: c.text }}>{message}</span>
        <button onClick={onClose} className="text-cyber-text-muted hover:text-cyber-text-dim w-6 h-6 flex items-center justify-center rounded">×</button>
      </div>
    </div>
  );
}

/* ===== Tooltip ===== */
export function Tooltip({ content, children, position = 'top' }: { content: string; children: ReactNode; position?: 'top' | 'bottom' | 'right' | 'left' }) {
  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className={`tooltip-bubble ${posClasses[position]}`} style={{ width: 'max-content', maxWidth: '280px' }}>
        {content}
      </span>
    </span>
  );
}

export function InfoTip({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' | 'right' | 'left' }) {
  return (
    <Tooltip content={text} position={position}>
      <HelpCircle className="w-3.5 h-3.5 text-cyber-text-muted hover:text-cyber-text-dim cursor-help transition-colors flex-shrink-0" />
    </Tooltip>
  );
}

/* ===== Severity Badge ===== */
export function SeverityBadge({ level, showIcon = true }: { level: 'low' | 'medium' | 'high' | 'critical'; showIcon?: boolean }) {
  const config = {
    low: { class: 'badge-severity-low', label: 'FAIBLE', icon: ShieldCheck },
    medium: { class: 'badge-severity-medium', label: 'MOYEN', icon: ShieldCheck },
    high: { class: 'badge-severity-high', label: 'ÉLEVÉ', icon: AlertTriangle },
    critical: { class: 'badge-severity-critical', label: 'CRITIQUE', icon: ShieldAlert },
  };
  const c = config[level];
  const Icon = c.icon;
  return (
    <span className={c.class}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {c.label}
    </span>
  );
}

export function difficultyToSeverity(difficulty: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (difficulty) {
    case 'beginner': return 'low';
    case 'intermediate': return 'medium';
    case 'advanced': return 'high';
    default: return 'low';
  }
}

/* ===== Risk Gauge ===== */
export function RiskGauge({ value, max = 100, label, size = 'md' }: { value: number; max?: number; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const sizes = { sm: 'w-20 h-20', md: 'w-28 h-28', lg: 'w-36 h-36' };
  const fontSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  const strokeWidth = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  const radius = size === 'sm' ? 36 : size === 'md' ? 48 : 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  let color = '#00ff9d';
  let glowColor = 'rgba(0, 255, 157, 0.4)';
  if (pct >= 75) { color = '#ff3355'; glowColor = 'rgba(255, 51, 85, 0.4)'; }
  else if (pct >= 50) { color = '#ffaa00'; glowColor = 'rgba(255, 170, 0, 0.4)'; }
  else if (pct >= 25) { color = '#00d4ff'; glowColor = 'rgba(0, 212, 255, 0.4)'; }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${sizes[size]} flex items-center justify-center`}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${radius * 2 + strokeWidth} ${radius * 2 + strokeWidth}`}>
          <circle cx={radius + strokeWidth / 2} cy={radius + strokeWidth / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          <circle
            cx={radius + strokeWidth / 2} cy={radius + strokeWidth / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${glowColor})` }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className={`${fontSizes[size]} font-bold font-mono`} style={{ color }}>{pct}%</span>
          {size !== 'sm' && <Zap className="w-3 h-3 text-cyber-text-muted mt-0.5" />}
        </div>
      </div>
      {label && <span className="text-xs text-cyber-text-muted font-medium">{label}</span>}
    </div>
  );
}

/* ===== Stepper ===== */
export function Stepper({ steps, currentStep }: { steps: { label: string; description?: string }[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isLast = idx === steps.length - 1;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isComplete
                    ? 'bg-[#00ff9d]/10 border-[#00ff9d] text-[#00ff9d]'
                    : isCurrent
                    ? 'bg-[#00d4ff]/10 border-[#00d4ff] text-[#00d4ff] animate-pulse-glow'
                    : 'bg-cyber-surface border-cyber-border text-cyber-text-muted'
                }`}
                style={isComplete ? { boxShadow: '0 0 8px rgba(0, 255, 157, 0.3)' } : isCurrent ? { boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)' } : {}}
              >
                {isComplete ? <Check className="w-4 h-4" /> : isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Circle className="w-3 h-3" />}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isCurrent ? 'text-[#00d4ff]' : isComplete ? 'text-[#00ff9d]' : 'text-cyber-text-muted'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mx-2 rounded-full transition-all duration-300" style={{ background: isComplete ? 'var(--neon)' : 'var(--border)', boxShadow: isComplete ? '0 0 6px rgba(0, 255, 157, 0.3)' : 'none' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== Stat Pill ===== */
export function StatPill({ icon, value, label, color = 'neon' }: { icon: ReactNode; value: string | number; label: string; color?: 'neon' | 'electric' | 'amber' | 'magenta' | 'danger' }) {
  const colorMap = {
    neon: { text: '#00ff9d', bg: 'rgba(0, 255, 157, 0.08)', border: 'rgba(0, 255, 157, 0.15)' },
    electric: { text: '#00d4ff', bg: 'rgba(0, 212, 255, 0.08)', border: 'rgba(0, 212, 255, 0.15)' },
    amber: { text: '#ffaa00', bg: 'rgba(255, 170, 0, 0.08)', border: 'rgba(255, 170, 0, 0.15)' },
    magenta: { text: '#ff2e88', bg: 'rgba(255, 46, 136, 0.08)', border: 'rgba(255, 46, 136, 0.15)' },
    danger: { text: '#ff3355', bg: 'rgba(255, 51, 85, 0.08)', border: 'rgba(255, 51, 85, 0.15)' },
  };
  const c = colorMap[color];
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ background: c.bg, borderColor: c.border }}>
      <span style={{ color: c.text }}>{icon}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: c.text }}>{value}</span>
      <span className="text-xs text-cyber-text-muted">{label}</span>
    </div>
  );
}
