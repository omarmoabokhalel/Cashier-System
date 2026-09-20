import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  placeholder = 'اختر من القائمة...',
  className,
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5" dir="rtl">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-slate-300">
          {label}
        </label>
      )}

      <select
        ref={ref}
        id={selectId}
        className={twMerge(
          "w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans cursor-pointer",
          error && "border-rose-600 focus:border-rose-500 focus:ring-rose-500",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="bg-slate-900 text-slate-500">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
            {opt.label}
          </option>
        ))}
      </select>

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
