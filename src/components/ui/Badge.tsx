import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-full border tracking-wide select-none';

  const variants = {
    primary: 'bg-indigo-950/80 text-indigo-300 border-indigo-800',
    secondary: 'bg-purple-950/80 text-purple-300 border-purple-800',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    warning: 'bg-amber-950/80 text-amber-300 border-amber-800',
    danger: 'bg-rose-950/80 text-rose-300 border-rose-800',
    info: 'bg-sky-950/80 text-sky-300 border-sky-800',
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={twMerge(baseStyles, variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
};
