import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import {
  ShoppingCart,
  Package,
  Users,
  Landmark,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  Crown,
  PieChart,
  BarChart3,
  Calendar,
  Sparkles,
  RotateCcw,
  DollarSign,
  Layers,
} from 'lucide-react';

interface DashboardMetrics {
  sales_today: number;
  sales_month: number;
  invoices_count: number;
  avg_invoice: number;
  cogs: number;
  gross_profit: number;
  returns_total: number;
  expenses_total: number;
  net_sales: number;
  net_profit: number;
  top_products: Array<{ product_name: string; total_sold: number; total_revenue: number }>;
  sales_by_category: Array<{ category_name: string; total_revenue: number }>;
  sales_by_payment: Array<{ payment_method: string; total_amount: number }>;
  daily_trend: Array<{ day_date: string; daily_sales: number }>;
}

interface OwnerMetrics {
  inventory_valuation: number;
  cash_in_registers: number;
  card_sales_total: number;
  total_cash_position: number;
  cashier_performance: Array<{ cashier_name: string; sales_count: number; total_sales: number }>;
  branch_performance: Array<{ branch_name: string; sales_count: number; total_sales: number }>;
}

export const DashboardShell: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [ownerMetrics, setOwnerMetrics] = useState<OwnerMetrics | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current active open shift
      const { data: openShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      const currentShift = openShiftData && openShiftData.length > 0 ? openShiftData[0] : null;
      setActiveShift(currentShift);

      // 2. Query shift analytics RPC
      const [{ data: dbMetrics }, { data: dbOwner }] = await Promise.all([
        (supabase.rpc as any)('rpc_get_dashboard_analytics', {
          p_shift_id: currentShift?.id || null,
        }),
        (supabase.rpc as any)('rpc_get_executive_owner_metrics'),
      ]);

      if (dbMetrics) {
        setMetrics(dbMetrics);
      } else if (currentShift) {
        // Fallback: Query sales for active shift directly
        const { data: shiftSales } = await supabase
          .from('sales')
          .select(`
            id, total_amount, subtotal, discount_amount, created_at,
            sale_items(
              quantity, returned_quantity, unit_price, cost_price, total_price,
              product_variants(products(name_ar, categories(name_ar)))
            ),
            payments(payment_method, amount)
          `)
          .eq('cashier_shift_id', currentShift.id);

        const salesList = shiftSales || [];
        const totalSalesAmt = salesList.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        const invoicesCount = salesList.length;
        const avgInv = invoicesCount > 0 ? totalSalesAmt / invoicesCount : 0;

        let totalCogs = 0;
        const topProdMap: Record<string, { total_sold: number; total_revenue: number }> = {};
        const paymentMap: Record<string, number> = {};
        const catMap: Record<string, number> = {};

        salesList.forEach((s) => {
          (s.sale_items || []).forEach((item: any) => {
            const netQty = (item.quantity || 0) - (item.returned_quantity || 0);
            totalCogs += Number(item.cost_price || 0) * netQty;
            const pName = item.product_variants?.products?.name_ar || 'منتج';
            if (!topProdMap[pName]) topProdMap[pName] = { total_sold: 0, total_revenue: 0 };
            topProdMap[pName].total_sold += netQty;
            topProdMap[pName].total_revenue += Number(item.total_price || 0);

            const cName = item.product_variants?.products?.categories?.name_ar || 'عام';
            catMap[cName] = (catMap[cName] || 0) + Number(item.total_price || 0);
          });

          (s.payments || []).forEach((p: any) => {
            const pm = p.payment_method || 'cash';
            paymentMap[pm] = (paymentMap[pm] || 0) + Number(p.amount || 0);
          });
        });

        const grossProf = totalSalesAmt - totalCogs;
        const retTot = Number(currentShift.total_returns_cash || 0);
        const expTot = Number(currentShift.total_expenses || 0);
        const netSal = totalSalesAmt - retTot;
        const netProf = grossProf - expTot;

        const topProducts = Object.entries(topProdMap)
          .map(([product_name, val]) => ({ product_name, ...val }))
          .sort((a, b) => b.total_sold - a.total_sold)
          .slice(0, 5);

        const salesByPayment = Object.entries(paymentMap).map(([payment_method, total_amount]) => ({
          payment_method,
          total_amount,
        }));

        const salesByCategory = Object.entries(catMap).map(([category_name, total_revenue]) => ({
          category_name,
          total_revenue,
        }));

        setMetrics({
          sales_today: totalSalesAmt,
          sales_month: totalSalesAmt,
          invoices_count: invoicesCount,
          avg_invoice: avgInv,
          cogs: totalCogs,
          gross_profit: grossProf,
          returns_total: retTot,
          expenses_total: expTot,
          net_sales: netSal,
          net_profit: netProf,
          top_products: topProducts,
          sales_by_category: salesByCategory,
          sales_by_payment: salesByPayment,
          daily_trend: [],
        });
      }

      if (dbOwner) setOwnerMetrics(dbOwner);
    } catch (e) {
      console.error('Error loading dashboard metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans select-none" dir="rtl">
      {/* TOP HERO BANNER & OWNER VIEW TOGGLE */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 border border-indigo-800/60 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white">لوحة مؤشرات الوردية الحالية</h2>
            {activeShift ? (
              <Badge variant="success" size="sm" className="bg-emerald-950 border border-emerald-700 text-emerald-300">
                الوردية مفتوحة (منذ {new Date(activeShift.opened_at).toLocaleTimeString('ar-EG')})
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="bg-amber-950 border border-amber-700 text-amber-300">
                لا توجد وردية مفتوحة
              </Badge>
            )}
          </div>
          <p className="text-xs text-indigo-200/80 max-w-lg">
            عرض مؤشرات المبيعات، الفواتير والأرباح المحسوبة حصرياً للوردية الحالية النشطة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOwnerView(!isOwnerView)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              isOwnerView
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-amber-400 border-amber-500/40 hover:bg-slate-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>{isOwnerView ? 'منظور المالك (نشط)' : 'منظور المالك (Executive Owner)'}</span>
          </button>

          <Button
            onClick={() => onNavigate('pos')}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-xl shadow-emerald-600/20"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>فتح شاشة POS</span>
          </Button>
        </div>
      </div>

      {/* 9 MAIN SHIFT METRIC CARDS */}
      {metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>مبيعات الوردية الحالية</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {Number(metrics.sales_today).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>مبيعات الشهر الكلية</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </span>
            <span className="text-lg font-black text-indigo-400 font-mono">
              {Number(metrics.sales_month).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>فواتير الوردية</span>
              <ShoppingCart className="w-4 h-4 text-sky-400" />
            </span>
            <span className="text-lg font-black text-white font-mono">
              {metrics.invoices_count} <span className="text-[10px] text-slate-400 font-sans">فاتورة</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>متوسط فاتورة الوردية</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </span>
            <span className="text-lg font-black text-purple-400 font-mono">
              {Number(metrics.avg_invoice).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>تكلفة البضاعة (COGS)</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {Number(metrics.cogs).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>أرباح الوردية</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {Number(metrics.gross_profit).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>مرتجعات الوردية</span>
              <RotateCcw className="w-4 h-4 text-rose-400" />
            </span>
            <span className="text-lg font-black text-rose-400 font-mono">
              -{Number(metrics.returns_total).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>مصروفات الوردية</span>
              <CircleDollarSign className="w-4 h-4 text-rose-400" />
            </span>
            <span className="text-lg font-black text-rose-400 font-mono">
              -{Number(metrics.expenses_total).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>صافي مبيعات الوردية</span>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </span>
            <span className="text-lg font-black text-indigo-400 font-mono">
              {Number(metrics.net_sales).toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
            </span>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-emerald-950 to-slate-900 border-emerald-800/80 space-y-1 shadow-lg shadow-emerald-600/10">
            <span className="text-[11px] text-emerald-300 font-bold block flex items-center justify-between">
              <span>صافي ربح الوردية النهائي</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </span>
            <span className="text-lg font-black text-emerald-300 font-mono">
              {Number(metrics.net_profit).toFixed(2)} <span className="text-[10px] text-slate-300 font-sans">ج.م</span>
            </span>
          </Card>
        </div>
      ) : null}

      {/* EXECUTIVE OWNER DASHBOARD VIEW (If Toggled) */}
      {isOwnerView && ownerMetrics && (
        <Card className="p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/40 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <span>منظور المالك - مؤشرات السيولة وتقييم الشركة</span>
            </h3>
            <Badge variant="primary" size="sm" className="bg-amber-950 border-amber-700 text-amber-300">Executive View</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block">تقييم كامل البضائع والمخزون</span>
              <span className="text-xl font-black text-amber-400 font-mono">
                {Number(ownerMetrics.inventory_valuation).toFixed(2)} ج.م
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block">السيولة النقدية بالخزائن</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {Number(ownerMetrics.cash_in_registers).toFixed(2)} ج.م
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block">إجمالي السيولة (Cash Position)</span>
              <span className="text-xl font-black text-sky-400 font-mono">
                {Number(ownerMetrics.total_cash_position).toFixed(2)} ج.م
              </span>
            </div>
          </div>

          {/* Cashier Performance Table */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-300 mb-2">أداء أطقم الكاشير والفرع</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {ownerMetrics.cashier_performance.map((cp, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">{cp.cashier_name}</span>
                  <div className="flex gap-4">
                    <span className="text-slate-400">{cp.sales_count} عملية</span>
                    <span className="font-mono font-bold text-emerald-400">{Number(cp.total_sales).toFixed(2)} ج.م</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ANALYTICS CHARTS & TOP BREAKDOWNS */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TOP 5 PRODUCTS */}
          <Card className="p-5 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <span>أعلى 5 منتجات مبيعاً (الأكثر طلباً)</span>
            </h3>

            <div className="space-y-3">
              {metrics.top_products.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">لا توجد بيانات مبيعات كافية</p>
              ) : (
                metrics.top_products.map((tp, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-200">{tp.product_name}</span>
                      <span className="font-mono text-emerald-400">{Number(tp.total_revenue).toFixed(2)} ج.م</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (tp.total_sold / 20) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">عدد القطع المباعة: {tp.total_sold} قطعة</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* SALES BY PAYMENT METHOD & CATEGORIES */}
          <Card className="p-5 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <PieChart className="w-5 h-5 text-purple-400" />
              <span>توزيع المبيعات حسب طريقة الدفع والتصنيفات</span>
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">طرق الدفع:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {metrics.sales_by_payment.map((pm, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between font-bold">
                      <span className="text-slate-300">
                        {pm.payment_method === 'cash' ? 'نقداً (Cash)' : pm.payment_method === 'card' ? 'بطاقة (Card)' : pm.payment_method}
                      </span>
                      <span className="font-mono text-purple-400">{Number(pm.total_amount).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">حسب التصنيفات:</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {metrics.sales_by_category.map((cat, idx) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-between text-xs">
                      <span className="text-slate-300">{cat.category_name}</span>
                      <span className="font-mono font-bold text-sky-400">{Number(cat.total_revenue).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
