import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CartItem } from '../../types/pos';
import { Percent, DollarSign, Edit3 } from 'lucide-react';

interface ItemDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CartItem | null;
  onSaveItem: (updatedItem: CartItem) => void;
}

export const ItemDiscountModal: React.FC<ItemDiscountModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaveItem,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      setUnitPrice(item.unitPrice);
      setDiscountValue(item.discountAmount);
      setDiscountType('flat');
    }
  }, [item]);

  if (!item) return null;

  const calculateDiscountAmount = (): number => {
    if (discountType === 'percentage') {
      return (unitPrice * Math.min(100, Math.max(0, discountValue))) / 100;
    }
    return Math.min(unitPrice, Math.max(0, discountValue));
  };

  const currentDiscountAmount = calculateDiscountAmount();
  const netUnitPrice = Math.max(0, unitPrice - currentDiscountAmount);
  const itemTotal = netUnitPrice * quantity;

  const handleSave = () => {
    onSaveItem({
      ...item,
      quantity,
      unitPrice,
      discountAmount: currentDiscountAmount,
    });
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="تعديل الصنف والخصم" maxWidth="sm">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Item Header Header */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white">{item.productNameAr}</h4>
            <div className="text-[11px] text-slate-400 mt-0.5 flex gap-2">
              <span>المقاس: {item.sizeCode}</span>
              <span>•</span>
              <span>اللون: {item.colorNameAr}</span>
              <span>•</span>
              <span className="font-mono">SKU: {item.sku}</span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40">
            المخزون: {item.stockQty}
          </span>
        </div>

        {/* Quantity Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">الكمية</label>
          <Input
            type="number"
            min={1}
            max={item.stockQty}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        {/* Unit Price Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">سعر الوحدة (ج.م)</label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={unitPrice}
            onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>

        {/* Discount Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">الخصم على هذا الصنف</label>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setDiscountType('flat')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  discountType === 'flat'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                مبلغ ثابت (ج.م)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  discountType === 'percentage'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                نسبة مئوية (%)
              </button>
            </div>
          </div>

          <Input
            type="number"
            min={0}
            max={discountType === 'percentage' ? 100 : unitPrice}
            step="0.5"
            value={discountValue}
            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
            icon={discountType === 'percentage' ? <Percent className="w-4 h-4 text-slate-400" /> : <DollarSign className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {/* Summary Card */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>الخصم المحسوب:</span>
            <span className="font-mono text-amber-400">-{currentDiscountAmount.toFixed(2)} ج.م</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>السعر الصافي للقطعة:</span>
            <span className="font-mono text-slate-200">{netUnitPrice.toFixed(2)} ج.م</span>
          </div>
          <div className="flex justify-between font-black text-white pt-1.5 border-t border-slate-800">
            <span>المجموع النهائي للصنف:</span>
            <span className="font-mono text-emerald-400 text-sm">{itemTotal.toFixed(2)} ج.م</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={handleSave}>
            حفظ التغييرات
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
