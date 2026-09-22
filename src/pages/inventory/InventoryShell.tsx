import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { StocktakeModal } from '../../components/inventory/StocktakeModal';
import { StockMovementsTable } from '../../components/inventory/StockMovementsTable';
import {
  BarChart3,
  Search,
  ClipboardList,
  AlertTriangle,
  Package,
  Layers,
  Barcode,
  ArrowUpDown,
  History
} from 'lucide-react';

export const InventoryShell: React.FC = () => {
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');
  const [inventoryStock, setInventoryStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'low' | 'out'>('all');

  // Stocktake Modal State
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const [{ data: stockData }, { data: moveData }] = await Promise.all([
        supabase.from('branch_variant_stock').select(`
          *,
          product_variants(
            id, sku, barcode, selling_price, cost_price, deleted_at,
            sizes(code, name_ar),
            colors(name_ar, hex_code),
            products(id, name_ar, min_stock_alert, deleted_at, categories(name_ar))
          )
        `).order('updated_at', { ascending: false }),
        supabase.from('inventory_movements').select(`
          *,
          product_variants(
            sku, barcode,
            sizes(code),
            colors(name_ar),
            products(name_ar)
          ),
          profiles(full_name)
        `).order('created_at', { ascending: false }).limit(50),
      ]);

      setInventoryStock(stockData || []);
      setMovements(moveData || []);
    } catch (e: any) {
      showToast('error', 'فشل تحميل بيانات المخزون', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  // Filter out deleted products and variants
  const activeStock = inventoryStock.filter((item) => {
    const pv = item.product_variants;
    return pv && !pv.deleted_at && pv.products && !pv.products.deleted_at;
  });

  // Filter Inventory Datatable
  const filteredStock = activeStock.filter((item) => {
    const searchLower = search.toLowerCase();
    const prodName = item.product_variants?.products?.name_ar?.toLowerCase() || '';
    const sku = item.product_variants?.sku?.toLowerCase() || '';
    const barcode = item.product_variants?.barcode?.toLowerCase() || '';

    const nameMatch = prodName.includes(searchLower) || sku.includes(searchLower) || barcode.includes(searchLower);

    const minStock = item.product_variants?.products?.min_stock_alert || 5;
    const isLow = item.quantity > 0 && item.quantity <= minStock;
    const isOut = item.quantity === 0;

    const statusMatch =
      selectedStatus === 'all' ||
      (selectedStatus === 'low' && isLow) ||
      (selectedStatus === 'out' && isOut);

    return nameMatch && statusMatch;
  });

  // Calculate Metrics
  const totalInStockUnits = activeStock.reduce((acc, i) => acc + (i.quantity || 0), 0);
  const lowStockCount = activeStock.filter(
    (i) => i.quantity > 0 && i.quantity <= (i.product_variants?.products?.min_stock_alert || 5)
  ).length;
  const outOfStockCount = activeStock.filter((i) => i.quantity === 0).length;

  return (
    <div className="p-6 space-y-6 font-sans select-none" dir="rtl">
      {/* Top Header & Stocktake Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة وحركات المخزون والحيوي</h2>
          <p className="text-xs text-slate-400 mt-0.5">متابعة الأرصدة الحية، التنبيهات، وتسوية الجرد الدورية</p>
        </div>

        <PermissionGuard permission="adjust_stock">
          <Button
            onClick={() => setIsStocktakeOpen(true)}
            variant="success"
            icon={<ClipboardList className="w-4 h-4" />}
          >
            بدء عملية الجرد والتسوية (Stocktake)
          </Button>
        </PermissionGuard>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between bg-slate-900 border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-400 block">إجمالي قطع المخزون الحالي</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">{totalInStockUnits} قطعة</span>
          </div>
          <div className="p-3 bg-indigo-950/80 border border-indigo-800 text-indigo-400 rounded-2xl">
            <Package className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between bg-slate-900 border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-400 block">منخفض المخزون (تنبيه)</span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{lowStockCount} أصناف</span>
          </div>
          <div className="p-3 bg-amber-950/80 border border-amber-800 text-amber-400 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between bg-slate-900 border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-400 block">نفد المخزون (صفر قطعة)</span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">{outOfStockCount} أصناف</span>
          </div>
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="p-4 space-y-4">
        <Tabs
          tabs={[
            { id: 'stock', label: 'رصيد المخزون الحالي والأصناف', icon: <Layers className="w-4 h-4" />, badge: filteredStock.length },
            { id: 'movements', label: 'سجل حركات وتداول المخزون (Audit Log)', icon: <History className="w-4 h-4" />, badge: movements.length },
          ]}
          activeTab={activeTab}
          onChange={(t) => setActiveTab(t as any)}
        />

        {activeTab === 'stock' ? (
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="ابحث بالاسم، SKU أو الباركود..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
              />

              <Select
                options={[
                  { value: 'all', label: 'جميع حالات المخزون' },
                  { value: 'low', label: 'منخفض المخزون فقط' },
                  { value: 'out', label: 'نفد المخزون (0 قطعة)' },
                ]}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
              />
            </div>

            {/* Current Stock Datatable */}
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                    <tr>
                      <th className="p-3.5">المنتج والنوع</th>
                      <th className="p-3.5">المقاس / اللون</th>
                      <th className="p-3.5">رمز SKU</th>
                      <th className="p-3.5">الباركود</th>
                      <th className="p-3.5">المخزون الحالي</th>
                      <th className="p-3.5">حد التنبيه</th>
                      <PermissionGuard permission="view_cost_prices">
                        <th className="p-3.5">سعر التكلفة</th>
                      </PermissionGuard>
                      <th className="p-3.5">سعر البيع</th>
                      <th className="p-3.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStock.map((item) => {
                      const pv = item.product_variants;
                      const minAlert = pv?.products?.min_stock_alert || 5;
                      const qty = item.quantity || 0;
                      const isLow = qty > 0 && qty <= minAlert;
                      const isOut = qty === 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-900/50 transition-all">
                          <td className="p-3.5 font-bold text-slate-100">
                            <div>{pv?.products?.name_ar || 'منتج'}</div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {pv?.products?.categories?.name_ar || 'عام'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {pv?.colors?.hex_code ? (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                  style={{ backgroundColor: pv.colors.hex_code }}
                                  title={pv.colors.name_ar}
                                />
                              ) : null}
                              <span className="text-slate-200 font-semibold">
                                {pv?.colors?.name_ar || pv?.sizes?.code
                                  ? `${pv?.colors?.name_ar || 'بدون لون'} / ${pv?.sizes?.code || 'بدون مقاس'}`
                                  : 'قياسي (بدون ألوان/مقاسات)'}
                              </span>
                            </div>
                          </td>

                          <td className="p-3.5 font-mono text-indigo-300 font-semibold">{pv?.sku}</td>

                          <td className="p-3.5 font-mono text-emerald-300 flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-500" />
                            <span>{pv?.barcode}</span>
                          </td>

                          <td className="p-3.5 font-mono font-black text-sm text-white">{qty} قطعة</td>

                          <td className="p-3.5 font-mono text-slate-400">{minAlert}</td>

                          <PermissionGuard permission="view_cost_prices">
                            <td className="p-3.5 font-mono text-amber-400">
                              {Number(pv?.cost_price || 0).toFixed(2)} ج.م
                            </td>
                          </PermissionGuard>

                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            {Number(pv?.selling_price || 0).toFixed(2)} ج.م
                          </td>

                          <td className="p-3.5">
                            {isOut ? (
                              <Badge variant="danger">نفد المخزون</Badge>
                            ) : isLow ? (
                              <Badge variant="warning">منخفض (تنبيه)</Badge>
                            ) : (
                              <Badge variant="success">متوفر</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <StockMovementsTable movements={movements} loading={loading} />
        )}
      </Card>

      {/* Stocktake Drawer / Modal */}
      <StocktakeModal
        isOpen={isStocktakeOpen}
        onClose={() => setIsStocktakeOpen(false)}
        onCompleted={fetchInventoryData}
        inventoryStock={inventoryStock}
      />
    </div>
  );
};
