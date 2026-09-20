import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { ReceiptPrintModal } from '../../components/pos/ReceiptPrintModal';
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
} from 'lucide-react';

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
  customers?: { id: string; full_name: string; phone: string | null };
  sale_items?: any[];
  payments?: any[];
}

export const SalesShell: React.FC = () => {
  const { showToast } = useToast();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers(id, full_name, phone),
          sale_items(
            id, quantity, unit_price, discount_amount, total_price,
            product_variants(
              sku, barcode,
              products(name_ar, name_en),
              sizes(code),
              colors(name_ar)
            )
          ),
          payments(payment_method, amount)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales:', error);
        showToast('error', 'فشل تحميل سجل الفواتير', error.message);
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
      cashierName: 'كاشير المبيعات',
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

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase().trim();
    const invMatch = s.invoice_number?.toLowerCase().includes(q);
    const custMatch = s.customers?.full_name?.toLowerCase().includes(q) || s.customers?.phone?.includes(q);
    return invMatch || custMatch;
  });

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

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
            استعراض جميع الفواتير الصادرة، إعادة طباعة الإيصالات ومتابعة إيرادات المبيعات
          </p>
        </div>

        <div className="bg-emerald-950/80 border border-emerald-800 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-950/20">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          <div>
            <span className="text-[10px] text-emerald-300 block font-bold">إجمالي إيرادات الفواتير</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{totalRevenue.toFixed(2)} ج.م</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-slate-900 border-slate-800">
        <div className="relative max-w-md">
          <Input
            placeholder="ابحث برقم الفاتورة (INV-...)، اسم العميل، أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
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
                      <Button
                        onClick={() => handleOpenReceipt(s)}
                        size="sm"
                        variant="secondary"
                        className="bg-slate-800 hover:bg-slate-700 text-indigo-300 gap-1 text-[11px] px-2.5 py-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>معاينة وطباعة</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* RECEIPT MODAL */}
      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedSale}
      />
    </div>
  );
};
