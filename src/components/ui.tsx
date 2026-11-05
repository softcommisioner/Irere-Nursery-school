import React from 'react';
import { Eye } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export type Tone = 'orange' | 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';

const badgeTones: Record<Tone, string> = {
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200'
};

const iconTones: Record<Tone, string> = {
  orange: 'bg-orange-50 text-orange-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-600'
};

export const Badge: React.FC<{
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'slate', children, className }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold',
      badgeTones[tone],
      className
    )}
  >
    {children}
  </span>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
}> = ({ label, value, sub, icon, tone = 'orange' }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
    {icon && (
      <div className={cx('w-9 h-9 rounded-lg flex items-center justify-center', iconTones[tone])}>
        {icon}
      </div>
    )}
    <p className="mt-3 text-2xl font-extrabold text-slate-800">{value}</p>
    <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
    {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
  </div>
);

export const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}> = ({ title, subtitle, icon, action, children, className, bodyClassName }) => (
  <div className={cx('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
    <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-orange-500 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800 truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className={bodyClassName}>{children}</div>
  </div>
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  message?: string;
}> = ({ icon, title, message }) => (
  <div className="p-10 text-center">
    {icon && <div className="w-9 h-9 mx-auto text-slate-300 mb-2">{icon}</div>}
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    {message && <p className="text-xs text-slate-500 mt-1">{message}</p>}
  </div>
);

export const ReadOnlyBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold">
    <Eye className="w-3.5 h-3.5" />
    Read-Only View
  </span>
);

export const ProgressBar: React.FC<{ percent: number; tone?: 'orange' | 'emerald' | 'rose' }> = ({
  percent,
  tone = 'orange'
}) => {
  const clamp = Math.max(0, Math.min(100, percent));
  const fill =
    tone === 'emerald' ? 'bg-emerald-500' : tone === 'rose' ? 'bg-rose-500' : 'bg-orange-500';
  return (
    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={cx('h-full rounded-full transition-all', fill)}
        style={{ width: `${clamp}%` }}
      />
    </div>
  );
};

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export const Tabs: React.FC<{
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
}> = ({ items, active, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
    {items.map((item) => {
      const isActive = active === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cx(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
            isActive
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          {item.icon}
          {item.label}
        </button>
      );
    })}
  </div>
);
