import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Barcode, Printer, CheckCircle2, Tag } from 'lucide-react';

interface BarcodeLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
}

export const BarcodeLabelPrinterModal: React.FC<BarcodeLabelPrinterModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState<number>(10);

  const selectedVariant = products.find((pv) => pv.id === selectedVariantId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="طباعة ملصقات الباركود والأسعار (Stickers)" maxWidth="lg">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Print Stylesheet for Labels */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-barcode-labels, #printable-barcode-labels * {
              visibility: visible;
            }
            #printable-barcode-labels {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 10px;
              background: #fff !important;
              color: #000 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اختر المنتج والصنف *</label>
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- اختر صنف لطباعة ملصقاته --</option>
              {products.map((pv) => (
                <option key={pv.id} value={pv.id}>
                  {pv.products?.name_ar} ({pv.sizes?.code} • {pv.colors?.name_ar}) - SKU: {pv.sku}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">عدد الملصقات المطلوبة *</label>
            <Input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        {/* Printable Labels Sheet Preview */}
        {selectedVariant ? (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300">معاينة شبكة الملصقات ({quantity} ملصق):</h4>
            <div
              id="printable-barcode-labels"
              className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto custom-scrollbar"
            >
              {Array.from({ length: quantity }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white text-slate-950 p-2.5 rounded-xl border border-slate-300 text-center font-mono space-y-1 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold block truncate">{selectedVariant.products?.name_ar}</span>
                    <div className="flex justify-center gap-2 text-[9px] text-slate-600 font-sans">
                      <span>مقاس: {selectedVariant.sizes?.code}</span>
                      <span>لون: {selectedVariant.colors?.name_ar}</span>
                    </div>
                  </div>

                  {/* Simulated Barcode Lines */}
                  <div className="flex justify-center gap-0.5 py-1">
                    {[2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3].map((w, i) => (
                      <div key={i} style={{ width: `${w}px` }} className="h-6 bg-slate-900 inline-block" />
                    ))}
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 tracking-wider block">{selectedVariant.barcode || selectedVariant.sku}</span>
                    <span className="text-xs font-black text-slate-900 block font-sans">
                      {Number(selectedVariant.selling_price).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
            <Barcode className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-bold">اختر منتجاً من القائمة للأعلى لعرض معاينة الملصقات</p>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-slate-800 no-print">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            disabled={!selectedVariant}
            className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملصقات ({quantity})</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
