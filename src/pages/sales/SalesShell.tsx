import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { ReceiptPrintModal } from '../../components/pos/ReceiptPrintModal';
import { EditInvoiceModal } from '../../components/sales/EditInvoiceModal';
import { useToast } from '../../components/ui/Toast';
import {
  Receipt,
  Search,
  Eye,
  Printer,
  Calendar,
  CreditCard,
  User,
  Clock,
  ArrowDownLeft,
  DollarSign,
  FileText,
  Pencil,
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';

interface SaleRecord {
  id: string;
  invoice_number: string;
  created_at: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_status: string;
  notes: string | null;
  cashier_id?: string | null;
  cashier?: { id: string; full_name: string };
  customers?: { id: string; full_name: string; phone: string | null };
  sale_items?: any[];
  payments?: any[];
}

export const SalesShell: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Shift & Date Isolation State
  const [activeShift, setActiveShift] = useState<{ id: string; opened_at: string } | null>(null);
  const [shiftFilter, setShiftFilter] = useState<'current' | 'all' | 'custom'>('current');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Edit Invoice Modal State
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<SaleRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const getSellerName = (s: SaleRecord) => {
    const adminName = localStorage.getItem('admin_display_name') || user?.fullName || 'المالك / المدير';
    if (s.cashier?.full_name) return s.cashier.full_name;
    if (!s.cashier_id || s.cashier_id === '00000000-0000-0000-0000-000000000001') return adminName;
    if (s.cashier_id === '00000000-0000-0000-0000-000000000002') return 'أحمد الكاشير';
    return adminName;
  };

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current open shift
      const { data: openShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('id, opened_at')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (openShiftData && openShiftData.length > 0) {
        setActiveShift(openShiftData[0]);
      } else {
        setActiveShift(null);
      }

      // 2. Fetch sales records
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          cashier:profiles!sales_cashier_id_fkey(id, full_name),
          customers(id, full_name, phone),
          sale_items(
            id, quantity, unit_price, cost_price, discount_amount, total_price, variant_id,
            product_variants(
              id, sku, barcode, selling_price, cost_price,
              products(id, name_ar, name_en, cost_price, min_selling_price, base_price),
              sizes(code),
              colors(name_ar)
            )
          ),
          payments(payment_method, amount)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback fetch without explicit relation
        const { data: fallbackData } = await supabase
          .from('sales')
          .select(`
            *,
            customers(id, full_name, phone),
            sale_items(
              id, quantity, unit_price, cost_price, discount_amount, total_price, variant_id,
              product_variants(
                id, sku, barcode, selling_price, cost_price,
                products(id, name_ar, name_en, cost_price, min_selling_price, base_price),
                sizes(code),
                colors(name_ar)
              )
            ),
            payments(payment_method, amount)
          `)
          .order('created_at', { ascending: false });

        setSales(fallbackData || []);
      } else {
        setSales(data || []);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', 'خطأ في جلب بيانات المبيعات', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

  const handleOpenReceipt = (s: SaleRecord) => {
    const formattedReceipt = {
      invoiceNumber: s.invoice_number,
      createdAt: s.created_at,
      cashierName: getSellerName(s),
      customerName: s.customers?.full_name || 'عميل نقدي عام',
      items: (s.sale_items || []).map((item: any) => ({
        productNameAr: item.product_variants?.products?.name_ar || 'منتج',
        sizeCode: item.product_variants?.sizes?.code || 'Std',
        colorNameAr: item.product_variants?.colors?.name_ar || 'عام',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        discountAmount: Number(item.discount_amount || 0),
        totalPrice: Number(item.total_price),
      })),
      subtotal: Number(s.subtotal),
      discountAmount: Number(s.discount_amount || 0),
      taxRate: Number(s.tax_rate ?? 15),
      taxAmount: Number(s.tax_amount || 0),
      totalAmount: Number(s.total_amount),
      paidAmount: Number(s.paid_amount || s.total_amount),
      changeAmount: Number(s.change_amount || 0),
      paymentMethod: s.payments?.[0]?.payment_method || 'cash',
    };

    setSelectedSale(formattedReceipt);
    setIsReceiptModalOpen(true);
  };

  const handleOpenEditModal = (s: SaleRecord) => {
    setSelectedSaleForEdit(s);
    setIsEditModalOpen(true);
  };

  // Filter Sales Logic
  const filteredSales = sales.filter((s) => {
    // 1. Shift / Date Filter
    if (shiftFilter === 'current') {
      if (activeShift?.id) {
        if (s.cashier_shift_id !== activeShift.id) return false;
      } else {
        // Fallback to today's date if no active open shift
        const todayStr = new Date().toISOString().split('T')[0];
        if (!s.created_at?.startsWith(todayStr)) return false;
      }
    } else if (shiftFilter === 'custom') {
      if (!s.created_at?.startsWith(customDate)) return false;
    }

    // 2. Seller / Cashier Filter
    const sellerName = getSellerName(s);
    if (sellerFilter !== 'all') {
      if (sellerFilter === 'admin') {
        const adminName = localStorage.getItem('admin_display_name') || user?.fullName || 'المالك / المدير';
        if (sellerName !== adminName && !sellerName.includes('المالك') && !sellerName.includes('مدير')) return false;
      } else if (sellerFilter === 'cashier') {
        if (!sellerName.includes('أحمد') && !sellerName.includes('كاشير')) return false;
      }
    }

    // 3. Search Text Query
    const q = search.toLowerCase().trim();
    if (!q) return true;

    const invMatch = s.invoice_number?.toLowerCase().includes(q);
    const custMatch = s.customers?.full_name?.toLowerCase().includes(q) || s.customers?.phone?.includes(q);
    const sellerMatch = sellerName.toLowerCase().includes(q);
    return invMatch || custMatch || sellerMatch;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  return (
    <div className="p-6 space-y-6 font-sans select-none text-slate-100" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>سجل الفواتير والمبيعات الصادرة</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            استعراض وتعديل فواتير الوردية الحالية، أراشيف الورديات السابقة وإعادة طباعة الإيصالات
          </p>
        </div>

        <div className="bg-emerald-950/80 border border-emerald-800 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-950/20">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          <div>
            <span className="text-[10px] text-emerald-300 block font-bold">
              إيرادات الفواتير المعروضة ({filteredSales.length} فاتورة)
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">{totalRevenue.toFixed(2)} ج.م</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Shift & Date Isolation Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>عرض الفواتير حسب:</span>
            </label>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setShiftFilter('current')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  shiftFilter === 'current'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>الوردية الحالية المفتوحة</span>
              </button>

              <button
                onClick={() => setShiftFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  shiftFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>جميع الورديات والأيام</span>
              </button>

              <button
                onClick={() => setShiftFilter('custom')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  shiftFilter === 'custom'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>تاريخ محدد</span>
              </button>
            </div>

            {shiftFilter === 'custom' && (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-40 h-8 text-xs bg-slate-950 font-mono"
              />
            )}
          </div>

          {/* Seller Filter & Search Box */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="all">جميع البائعين</option>
                <option value="admin">{localStorage.getItem('admin_display_name') || user?.fullName || 'المالك / المدير'}</option>
                <option value="cashier">أحمد الكاشير</option>
              </select>
            </div>

            <div className="w-full md:w-64">
              <Input
                placeholder="ابحث بالرقم، العميل، أو البائع..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Sales Invoices Table */}
      <Card className="p-4 bg-slate-900 border-slate-800">
        {loading ? (
          <div className="p-8 text-center text-slate-500">جاري تحميل سجل الفواتير والمبيعات...</div>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-12 h-12 text-emerald-400" />}
            title="لا توجد فواتير مبيعات مسجلة"
            description="عند إتمام عمليات بيع من شاشة POS الكاشير، ستظهر الفواتير هنا فوراً."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">تاريخ ووقت الإصدار</th>
                  <th className="p-3">اسم البائع</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">الخصم</th>
                  <th className="p-3">إجمالي الفاتورة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-400">
                      {s.invoice_number}
                    </td>

                    <td className="p-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(s.created_at).toLocaleDateString('ar-EG')}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(s.created_at).toLocaleTimeString('ar-EG')}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 font-bold text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{getSellerName(s)}</span>
                      </div>
                    </td>

                    <td className="p-3 font-semibold text-slate-200">
                      {s.customers?.full_name || 'عميل نقدي عام'}
                    </td>

                    <td className="p-3">
                      <Badge variant="secondary" size="sm">
                        {s.payments?.[0]?.payment_method === 'card'
                          ? 'بطاقة (Card)'
                          : s.payments?.[0]?.payment_method === 'split'
                          ? 'دفع مجزأ'
                          : 'نقداً (Cash)'}
                      </Badge>
                    </td>

                    <td className="p-3 font-mono text-amber-400">
                      {Number(s.discount_amount || 0) > 0 ? (
                        `-${Number(s.discount_amount).toFixed(2)} ج.م`
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    <td className="p-3 font-mono font-black text-emerald-400 text-sm">
                      {Number(s.total_amount).toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                    </td>

                    <td className="p-3 text-center">
                      <Badge variant="success" size="sm">
                        مدفوعة (Paid)
                      </Badge>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          onClick={() => handleOpenEditModal(s)}
                          size="sm"
                          variant="secondary"
                          className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 gap-1 text-[11px] px-2.5 py-1"
                        >
                          <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                          <span>تعديل</span>
                        </Button>

                        <Button
                          onClick={() => handleOpenReceipt(s)}
                          size="sm"
                          variant="secondary"
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 gap-1 text-[11px] px-2.5 py-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>طباعة</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* EDIT INVOICE MODAL */}
      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sale={selectedSaleForEdit}
        onInvoiceUpdated={fetchSalesData}
      />

      {/* RECEIPT MODAL */}
      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedSale}
      />
    </div>
  );
};

