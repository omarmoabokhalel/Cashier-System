import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { PermissionGuard } from '../auth/PermissionGuard';
import { Package, Barcode, Layers, DollarSign } from 'lucide-react';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  if (!product) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="تفاصيل المنتج والأنواع" maxWidth="2xl">
      <div className="space-y-6 font-sans text-slate-100" dir="rtl">
        {/* Product Overview Header */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-4 border border-slate-800 rounded-2xl">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name_ar} className="w-20 h-20 object-cover rounded-xl border border-slate-800 shrink-0" />
          ) : (
            <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
              <Package className="w-8 h-8" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-base font-bold text-white leading-snug">{product.name_ar}</h3>
            {product.name_en && <p className="text-xs text-slate-400">{product.name_en}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="primary">{product.categories?.name_ar || 'بدون تصنيف'}</Badge>
              <Badge variant="secondary">{product.brands?.name_ar || 'علامة عامة'}</Badge>
              <Badge variant={product.is_active ? 'success' : 'danger'}>
                {product.is_active ? 'نشط' : 'غير نشط'}
              </Badge>
            </div>
          </div>

          <div className="text-left bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">السعر الأساسي</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {Number(product.base_price).toFixed(2)} ج.م
            </span>
          </div>
        </div>

        {/* Variants List Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>قائمة أنواع المنتج المقترنة ({product.product_variants?.length || 0})</span>
            </h4>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-3">النوع (اللون / المقاس)</th>
                  <th className="p-3">رمز SKU</th>
                  <th className="p-3">الباركود (Barcode)</th>
                  <th className="p-3">سعر البيع</th>
                  <PermissionGuard permission="view_cost_prices">
                    <th className="p-3">سعر التكلفة</th>
                  </PermissionGuard>
                  <th className="p-3">المخزون الحالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {product.product_variants?.map((pv: any) => (
                  <tr key={pv.id} className="hover:bg-slate-900/50">
                    <td className="p-3 font-bold text-slate-200 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: pv.colors?.hex_code || '#000' }}
                      />
                      <span>{pv.colors?.name_ar} / {pv.sizes?.code}</span>
                    </td>
                    <td className="p-3 font-mono text-indigo-300 font-semibold">{pv.sku}</td>
                    <td className="p-3 font-mono text-emerald-300 flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-slate-500" />
                      <span>{pv.barcode}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      {Number(pv.selling_price).toFixed(2)} ج.م
                    </td>
                    <PermissionGuard permission="view_cost_prices">
                      <td className="p-3 font-mono text-amber-400">
                        {Number(pv.cost_price).toFixed(2)} ج.م
                      </td>
                    </PermissionGuard>
                    <td className="p-3">
                      <Badge variant={(pv.branch_variant_stock?.[0]?.quantity || 0) < 5 ? 'danger' : 'success'}>
                        {pv.branch_variant_stock?.[0]?.quantity || 0} قطعة
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
