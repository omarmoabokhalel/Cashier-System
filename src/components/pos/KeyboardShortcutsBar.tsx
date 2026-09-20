import React from 'react';
import { Search, Plus, PauseCircle, PlayCircle, CreditCard, XCircle, Trash2 } from 'lucide-react';

interface KeyboardShortcutsBarProps {
  onSearchFocus: () => void;
  onNewSale: () => void;
  onHoldSale: () => void;
  onRetrieveSale: () => void;
  onPayment: () => void;
  onClearSearch: () => void;
  onRemoveSelectedItem: () => void;
  hasItems: boolean;
  heldCount: number;
}

export const KeyboardShortcutsBar: React.FC<KeyboardShortcutsBarProps> = ({
  onSearchFocus,
  onNewSale,
  onHoldSale,
  onRetrieveSale,
  onPayment,
  onClearSearch,
  onRemoveSelectedItem,
  hasItems,
  heldCount,
}) => {
  return (
    <div
      className="bg-slate-950 border-t border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs overflow-x-auto custom-scrollbar select-none gap-2 font-sans"
      dir="rtl"
    >
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onSearchFocus}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-[11px]"
        >
          <kbd className="px-1.5 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-800/50 rounded text-[10px] font-mono font-bold">
            F2
          </kbd>
          <Search className="w-3.5 h-3.5 text-indigo-400" />
          <span>بحث</span>
        </button>

        <button
          onClick={onNewSale}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-[11px]"
        >
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] font-mono font-bold">
            F4
          </kbd>
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>فاتورة جديدة</span>
        </button>

        <button
          onClick={onHoldSale}
          disabled={!hasItems}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white disabled:opacity-40 transition-all text-[11px]"
        >
          <kbd className="px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded text-[10px] font-mono font-bold">
            F6
          </kbd>
          <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>تعليق الفاتورة</span>
        </button>

        <button
          onClick={onRetrieveSale}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-[11px] relative"
        >
          <kbd className="px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded text-[10px] font-mono font-bold">
            F7
          </kbd>
          <PlayCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>استرجاع المعلقة</span>
          {heldCount > 0 && (
            <span className="w-4 h-4 bg-indigo-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold font-mono">
              {heldCount}
            </span>
          )}
        </button>

        <button
          onClick={onPayment}
          disabled={!hasItems}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 rounded-lg text-emerald-300 font-bold transition-all text-[11px] disabled:opacity-40"
        >
          <kbd className="px-1.5 py-0.5 bg-emerald-900 text-emerald-200 border border-emerald-700 rounded text-[10px] font-mono font-bold">
            F8
          </kbd>
          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
          <span>الدفع والإنهاء</span>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onClearSearch}
          className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-[11px]"
        >
          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono font-bold">
            ESC
          </kbd>
          <span>إلغاء البحث</span>
        </button>

        <button
          onClick={onRemoveSelectedItem}
          disabled={!hasItems}
          className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 text-[11px] disabled:opacity-40"
        >
          <kbd className="px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800/40 rounded text-[10px] font-mono font-bold">
            DEL
          </kbd>
          <span>حذف صنف</span>
        </button>
      </div>
    </div>
  );
};
