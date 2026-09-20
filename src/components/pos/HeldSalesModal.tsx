import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { HeldSale } from '../../types/pos';
import { PauseCircle, PlayCircle, Trash2, Clock, ShoppingCart, User } from 'lucide-react';

interface HeldSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldSales: HeldSale[];
  onRetrieveSale: (sale: HeldSale) => void;
  onDeleteHeldSale: (id: string) => void;
  onClearAll: () => void;
}

export const HeldSalesModal: React.FC<HeldSalesModalProps> = ({
  isOpen,
  onClose,
  heldSales,
  onRetrieveSale,
  onDeleteHeldSale,
  onClearAll,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`الفواتير المعلقة (${heldSales.length})`}
      maxWidth="lg"
    >
      <div className="space-y-4 font-sans" dir="rtl">
        {heldSales.length === 0 ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center">
            <PauseCircle className="w-14 h-14 text-slate-700 mb-3 stroke-1" />
            <h4 className="text-sm font-bold text-slate-300">لا توجد فواتير معلقة حالياً</h4>
            <p className="text-xs text-slate-500 mt-1">
              يمكنك تعليق أي فاتورة حالية بالضغط على (F6) أو زر "تعليق الفاتورة"
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold">
                اضغط على "استرجاع" لاستعادة الأصناف إلى سلة الكاشير
              </span>
              <button
                onClick={onClearAll}
                className="text-rose-400 hover:text-rose-300 hover:underline font-bold"
              >
                مسح جميع الفواتير المعلقة
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {heldSales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="primary" size="sm" className="font-mono">
                        #{sale.id.slice(-6).toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(sale.heldAt).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      {sale.customer && (
                        <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/40">
                          <User className="w-3.5 h-3.5" />
                          {sale.customer.name}
                        </span>
                      )}
                    </div>

                    {/* Items preview */}
                    <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-400 flex items-center gap-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                        {sale.items.reduce((acc, i) => acc + i.quantity, 0)} أصناف:
                      </span>
                      {sale.items.map((item, idx) => (
                        <span key={idx} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                          {item.productNameAr} ({item.sizeCode}) x{item.quantity}
                        </span>
                      ))}
                    </div>

                    {sale.note && (
                      <p className="text-[11px] text-amber-300 bg-amber-950/30 p-1.5 rounded-lg border border-amber-900/40">
                        ملاحظة: {sale.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">إجمالي الفاتورة المعلقة</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        {sale.totalAmount.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDeleteHeldSale(sale.id)}
                        title="حذف هذه الفاتورة المعلقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onRetrieveSale(sale);
                          onClose();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>استرجاع (F7)</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
