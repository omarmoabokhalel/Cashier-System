import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  className,
}) => {
  return (
    <div className={twMerge("bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden", className)} dir="rtl">
      {(title || headerAction) && (
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-bold text-white leading-snug">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
