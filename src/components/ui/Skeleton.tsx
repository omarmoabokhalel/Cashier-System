import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={twMerge("animate-pulse bg-slate-800/80 rounded-xl", className)} />
  );
};
