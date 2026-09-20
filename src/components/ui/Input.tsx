import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  icon,
  iconPosition = 'right',
  helperText,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5" dir="rtl">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-300">
          {label}
        </label>
      )}
      
      <div className="relative flex items-center">
        {icon && (
          <div className={twMerge(
            "absolute text-slate-400 pointer-events-none flex items-center justify-center",
            iconPosition === 'right' ? "right-3.5" : "left-3.5"
          )}>
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            "w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans",
            icon && iconPosition === 'right' && "pr-10 pl-3.5",
            icon && iconPosition === 'left' && "pl-10 pr-3.5",
            !icon && "px-3.5",
            error && "border-rose-600 focus:border-rose-500 focus:ring-rose-500",
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-xs text-rose-400 font-medium mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
