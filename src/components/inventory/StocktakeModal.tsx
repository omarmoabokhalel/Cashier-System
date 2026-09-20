import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { ClipboardList, CheckCircle2 } from 'lucide-react';

interface StocktakeItem {
  variantId: string;
  productNameAr: string;
  sizeCode: string;
  colorNameAr: string;
  sku: string;
  expectedQty: number;
  countedQty: number;
  notes?: string;
}

interface StocktakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
  inventoryStock: any[];
}

export const StocktakeModal: React.FC<StocktakeModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
  inventoryStock,
}) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState('جرد دوري للمحل');
  const [submitting, setSubmitting] = useState(false);

  const [stocktakeItems, setStocktakeItems] = useState<StocktakeItem[]>(() =>
    inventoryStock.map((item) => ({
      variantId: item.variant_id,
      productNameAr: item.product_variants?.products?.name_ar || 'منتج',
      sizeCode: item.product_variants?.sizes?.code || '',
      colorNameAr: item.product_variants?.colors?.name_ar || '',
      sku: item.product_variants?.sku || '',
      expectedQty: item.quantity || 0,
      countedQty: item.quantity || 0,
      notes: '',
    }))
  );

  const updateCountedQty = (index: number, val: number) => {
    const updated = [...stocktakeItems];
    updated[index].countedQty = Math.max(0, val);
    setStocktakeItems(updated);
  };

  const updateNotes = (index: number, text: string) => {
    const updated = [...stocktakeItems];
    updated[index].notes = text;
    setStocktakeItems(updated);
  };

  const handleConfirmStocktake = async () => {
    if (!reason) {
      showToast('error', 'يرجى إدخال سبب التعديل / الجرد');
      return;
    }

    setSubmitting(true);
    try {
      const branchId = '11111111-1111-1111-1111-111111111111';

      const payloadItems = stocktakeItems.map((item) => ({
        variant_id: item.variantId,
        counted_qty: item.countedQty,
        notes: item.notes || reason,
      }));

      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_adjust_inventory', {
        p_branch_id: branchId,
        p_reason: reason,
        p_items: payloadItems,
      });

      if (error) {
        showToast('error', 'فشلت عملية اعتماد الجرد', error.message);
      } else {
        showToast(
          'success',
          'تم اعتماد الجرد وتحديث المخزون بنجاح!',
          `رقم التسوية: ${data?.adjustment_number || 'ADJ-001'}`
        );
        onCompleted();
        onClose();
      }
    } catch (err: any) {
      showToast('error', 'خطأ أثناء تنفيذ تسوية المخزون', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalVariances = stocktakeItems.reduce(
    (acc, item) => acc + (item.countedQty - item.expectedQty),
    0
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="بدء عملية الجرد وتعديل الفروقات (Stocktake)"
      maxWidth="2xl"
    >
      <div className="space-y-4 font-sans select-none" dir="rtl">
        <div className="p-3.5 bg-indigo-950/60 border border-indigo-800 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>
              لن يتم تعديل المخزون في قاعدة البيانات إلا بعد الضغط على <strong>تأكيد واعتماد الجرد</strong>.
            </span>
          </div>
          <Badge variant={totalVariances === 0 ? 'success' : totalVariances > 0 ? 'info' : 'danger'}>
            الفارق الكلي: {totalVariances > 0 ? `+${totalVariances}` : totalVariances} قطعة
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="سبب الجرد / التسوية *"
            placeholder="مثال: جرد نهاية الشهر، تسوية عجز، تلف"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <Select
            label="نوع الجرد"
            options={[
              { value: 'full', label: 'جرد شامل للمحل' },
              { value: 'partial', label: 'جرد جزئي لأصناف محددة' },
            ]}
          />
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300">قائمة الأصناف المدرجة للجرد ({stocktakeItems.length})</h4>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950 max-h-72">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold sticky top-0">
                <tr>
                  <th className="p-3">المنتج والنوع</th>
                  <th className="p-3">رمز SKU</th>
                  <th className="p-3">الكمية المتوقعة</th>
                  <th className="p-3">الكمية الفعلية (العدد)</th>
                  <th className="p-3">الفارق</th>
                  <th className="p-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stocktakeItems.map((item, idx) => {
                  const diff = item.countedQty - item.expectedQty;

                  return (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-3 font-bold text-slate-200">
                        <div>{item.productNameAr}</div>
                        <span className="text-[10px] text-slate-400">
                          {item.colorNameAr} / {item.sizeCode}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-indigo-300 font-semibold">{item.sku}</td>
                      <td className="p-3 font-mono font-bold text-slate-300">{item.expectedQty}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          value={item.countedQty}
                          onChange={(e) => updateCountedQty(idx, parseInt(e.target.value) || 0)}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold">
                        <span className={diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="ملاحظات..."
                          value={item.notes}
                          onChange={(e) => updateNotes(idx, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleConfirmStocktake}
            isLoading={submitting}
            variant="success"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            تأكيد واعتماد الجرد في المخزون
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
