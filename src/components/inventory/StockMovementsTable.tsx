import React from 'react';
import { Badge } from '../ui/Badge';
import { PermissionGuard } from '../auth/PermissionGuard';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface StockMovementsTableProps {
  movements: any[];
  loading: boolean;
}

export const StockMovementsTable: React.FC<StockMovementsTableProps> = ({
  movements,
  loading,
}) => {
  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'purchase':
        return <Badge variant="success">شراء (+)</Badge>;
      case 'sale':
        return <Badge variant="primary">بيع (-)</Badge>;
      case 'return':
        return <Badge variant="info">إرجاع (+)</Badge>;
      case 'exchange_in':
        return <Badge variant="info">استبدال وارد (+)</Badge>;
      case 'exchange_out':
        return <Badge variant="warning">استبدال صادر (-)</Badge>;
      case 'adjustment':
        return <Badge variant="secondary">تسوية جرد</Badge>;
      case 'damaged':
        return <Badge variant="danger">تلف (-)</Badge>;
      case 'lost':
        return <Badge variant="danger">فقدان (-)</Badge>;
      case 'opening_stock':
        return <Badge variant="neutral">مخزون افتتاحي</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans" dir="rtl">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span>جاري تحميل سجل حركات المخزون...</span>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="p-10 text-center text-slate-400 font-sans" dir="rtl">
        <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-300">لا توجد حركات مخزون حتى الآن</h4>
        <p className="text-xs text-slate-500 mt-1">يتم تسجل كل عملية بيع، إرجاع، شراء، أو تسوية تلقائياً بحساب المستخدم</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950 font-sans" dir="rtl">
      <table className="w-full text-right text-xs">
        <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
          <tr>
            <th className="p-3.5">تاريخ الحركة</th>
            <th className="p-3.5">نوع الحركة</th>
            <th className="p-3.5">اسم المنتج والنوع</th>
            <th className="p-3.5">الكمية قبل</th>
            <th className="p-3.5">التغير (Delta)</th>
            <th className="p-3.5">الكمية بعد</th>
            <PermissionGuard permission="view_cost_prices">
              <th className="p-3.5">سعر التكلفة</th>
            </PermissionGuard>
            <th className="p-3.5">المسؤول / المشغل</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {movements.map((m) => {
            const isPositive = m.quantity_delta > 0;

            return (
              <tr key={m.id} className="hover:bg-slate-900/50 transition-all">
                <td className="p-3.5 font-mono text-slate-400">
                  {new Date(m.created_at).toLocaleString('ar-SA')}
                </td>

                <td className="p-3.5">{getMovementBadge(m.movement_type)}</td>

                <td className="p-3.5 font-bold text-slate-100">
                  <div>{m.product_variants?.products?.name_ar || 'منتج'}</div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    SKU: {m.product_variants?.sku} ({m.product_variants?.colors?.name_ar} / {m.product_variants?.sizes?.code})
                  </span>
                </td>

                <td className="p-3.5 font-mono font-semibold text-slate-400">{m.quantity_before}</td>

                <td className="p-3.5 font-mono font-bold">
                  <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                    {isPositive ? `+${m.quantity_delta}` : m.quantity_delta}
                  </span>
                </td>

                <td className="p-3.5 font-mono font-bold text-white">{m.quantity_after}</td>

                <PermissionGuard permission="view_cost_prices">
                  <td className="p-3.5 font-mono text-amber-400">
                    {Number(m.cost_price).toFixed(2)} ج.م
                  </td>
                </PermissionGuard>

                <td className="p-3.5 text-slate-300">
                  {m.profiles?.full_name || 'النظام (System)'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
