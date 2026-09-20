import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { generateBarcode, generateSKU } from '../../utils/barcode';
import { Sparkles, Trash2, RefreshCw, Barcode } from 'lucide-react';

export interface GeneratedVariant {
  id?: string;
  sizeId: string;
  sizeCode: string;
  colorId: string;
  colorNameAr: string;
  colorHex: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  discountPrice?: number;
  stockQty: number;
}

interface VariantMatrixGeneratorProps {
  sizes: any[];
  colors: any[];
  baseSellingPrice: number;
  baseCostPrice: number;
  productCodePrefix: string;
  variants: GeneratedVariant[];
  onChangeVariants: (variants: GeneratedVariant[]) => void;
}

export const VariantMatrixGenerator: React.FC<VariantMatrixGeneratorProps> = ({
  sizes,
  colors,
  baseSellingPrice,
  baseCostPrice,
  productCodePrefix,
  variants,
  onChangeVariants,
}) => {
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);

  const toggleSize = (id: string) => {
    setSelectedSizeIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleColor = (id: string) => {
    setSelectedColorIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // Generate Matrix Combinations Automatically
  const generateMatrix = () => {
    if (selectedSizeIds.length === 0 || selectedColorIds.length === 0) return;

    const newVariants: GeneratedVariant[] = [];

    selectedColorIds.forEach((colorId) => {
      const colorObj = colors.find((c) => c.id === colorId);
      selectedSizeIds.forEach((sizeId) => {
        const sizeObj = sizes.find((s) => s.id === sizeId);

        if (colorObj && sizeObj) {
          // Check if variant already exists
          const existing = variants.find(
            (v) => v.colorId === colorId && v.sizeId === sizeId
          );

          if (existing) {
            newVariants.push(existing);
          } else {
            newVariants.push({
              sizeId,
              sizeCode: sizeObj.code,
              colorId,
              colorNameAr: colorObj.name_ar,
              colorHex: colorObj.hex_code,
              sku: generateSKU(productCodePrefix, colorObj.code, sizeObj.code),
              barcode: generateBarcode(),
              costPrice: baseCostPrice || 0,
              sellingPrice: baseSellingPrice || 0,
              stockQty: 10,
            });
          }
        }
      });
    });

    onChangeVariants(newVariants);
  };

  const updateVariantField = (index: number, field: keyof GeneratedVariant, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onChangeVariants(updated);
  };

  const removeVariant = (index: number) => {
    onChangeVariants(variants.filter((_, i) => i !== index));
  };

  const regenerateBarcode = (index: number) => {
    updateVariantField(index, 'barcode', generateBarcode());
  };

  return (
    <div className="space-y-5 font-sans" dir="rtl">
      {/* Matrix Selection Section */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>مُولّد مصفوفة الأنواع التلقائي (الألوان والأنواع)</span>
        </h4>

        {/* Colors Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">اختر الألوان المتاحة:</label>
          <div className="flex flex-wrap gap-2">
            {colors.map((clr) => {
              const isSelected = selectedColorIds.includes(clr.id);
              return (
                <button
                  type="button"
                  key={clr.id}
                  onClick={() => toggleColor(clr.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-950 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: clr.hex_code }}
                  />
                  <span>{clr.name_ar}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sizes Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">اختر المقاسات المتاحة:</label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((sz) => {
              const isSelected = selectedSizeIds.includes(sz.id);
              return (
                <button
                  type="button"
                  key={sz.id}
                  onClick={() => toggleSize(sz.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-purple-950 border-purple-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz.code} ({sz.name_ar})
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          onClick={generateMatrix}
          disabled={selectedSizeIds.length === 0 || selectedColorIds.length === 0}
          size="sm"
          variant="primary"
          icon={<Sparkles className="w-4 h-4" />}
        >
          توليد التجميعات التلقائية ({selectedColorIds.length * selectedSizeIds.length} صنف)
        </Button>
      </div>

      {/* Generated Variants Editable Table */}
      {variants.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200">الأنواع المعتمدة للمنتج ({variants.length})</h4>
            <span className="text-[11px] text-slate-400">يمكنك تعديل الرمز SKU والباركود والأسعار بشكل فردي</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-3">النوع (اللون / المقاس)</th>
                  <th className="p-3">رمز SKU</th>
                  <th className="p-3">الباركود (Barcode)</th>
                  <th className="p-3">سعر التكلفة</th>
                  <th className="p-3">سعر البيع</th>
                  <th className="p-3">المخزون الأول</th>
                  <th className="p-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {variants.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="p-2.5 font-bold text-slate-200 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: v.colorHex }}
                      />
                      <span>{v.colorNameAr} / {v.sizeCode}</span>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => updateVariantField(idx, 'sku', e.target.value)}
                        className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={v.barcode}
                          onChange={(e) => updateVariantField(idx, 'barcode', e.target.value)}
                          className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => regenerateBarcode(idx)}
                          className="p-1 text-slate-400 hover:text-white"
                          title="توليد باركود جديد"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={v.costPrice}
                        onChange={(e) => updateVariantField(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs text-amber-300 focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={v.sellingPrice}
                        onChange={(e) => updateVariantField(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs text-emerald-300 focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={v.stockQty}
                        onChange={(e) => updateVariantField(idx, 'stockQty', parseInt(e.target.value) || 0)}
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono text-xs text-white focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
