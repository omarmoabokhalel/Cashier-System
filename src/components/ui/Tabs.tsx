import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div className={twMerge("flex items-center gap-1 border-b border-slate-800", className)} dir="rtl">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              "px-4 py-3 text-xs font-bold transition-all relative flex items-center gap-2 select-none border-b-2",
              isActive
                ? "text-indigo-400 border-indigo-500 bg-indigo-950/20"
                : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50"
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={twMerge(
                "px-2 py-0.5 text-[10px] rounded-full font-semibold",
                isActive ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
