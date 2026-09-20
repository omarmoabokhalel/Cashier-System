import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  ShoppingBag,
  RotateCcw,
  History,
  TrendingUp,
  DollarSign,
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface CustomerData {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  tier: string;
  total_points: number;
  store_credit_balance: number;
  created_at: string;
}

export const CustomersShell: React.FC = () => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'purchases' | 'returns' | 'loyalty'>('purchases');

  // Customer Metrics & History Data
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [customerReturns, setCustomerReturns] = useState<any[]>([]);
  const [loyaltyLogs, setLoyaltyLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Load Customers
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('error', 'فشل تحميل العملاء', error.message);
      } else {
        setCustomers(data || []);
        if (data && data.length > 0) {
          selectCustomer(data[0]);
        }
      }
    } catch (e: any) {
      console.error('Fetch customers error:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);

    try {
      const [{ data: salesData }, { data: returnsData }, { data: loyaltyData }] = await Promise.all([
        supabase
          .from('sales')
          .select(`
            id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, payment_status, created_at,
            sale_items(id, quantity, unit_price, total_price, product_variants(products(name_ar), sizes(code), colors(name_ar)))
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('returns')
          .select(`
            id, return_number, refund_amount, refund_method, reason, created_at,
            return_items(quantity, unit_price, total_refund, product_variants(products(name_ar)))
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
      ]);

      setCustomerSales(salesData || []);
      setCustomerReturns(returnsData || []);
      setLoyaltyLogs(loyaltyData || []);
    } catch (e: any) {
      console.error('Error fetching customer history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.full_name.trim() || !newCustomer.phone.trim()) {
      showToast('warning', 'حقول مطلوبة', 'يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error }: { data: any; error: any } = await (supabase.from('customers') as any)
        .insert({
          full_name: newCustomer.full_name.trim(),
          phone: newCustomer.phone.trim(),
          email: newCustomer.email.trim() || null,
          tier: 'bronze',
        })
        .select()
        .single();

      if (error) {
        showToast('error', 'فشل إضافة العميل', error.message);
      } else {
        showToast('success', 'تم إضافة العميل بنجاح!', data.full_name);
        setIsAddModalOpen(false);
        setNewCustomer({ full_name: '', phone: '', email: '', address: '', notes: '' });
        fetchCustomers();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء الإضافة', e.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Metrics Calculations
  const totalSpent = customerSales.reduce((acc, s) => acc + Number(s.total_amount), 0);
  const totalOrders = customerSales.length;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const lastPurchaseDate = customerSales.length > 0 ? customerSales[0].created_at : null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>إدارة العملاء وبرنامج الولاء</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة سجلات الشراء للمحافظة على العملاء واستبدال نقاط الولاء وقسائم الخصم
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          variant="primary"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 self-start md:self-auto shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </Button>
      </div>

      {/* SPLIT LAYOUT: CUSTOMER LIST vs CUSTOMER DETAIL METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 1 COLUMN: SEARCH & CUSTOMERS LIST */}
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
          <Input
            placeholder="ابحث باسم العميل أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-slate-800/60 rounded-xl animate-pulse" />)
            ) : filteredCustomers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">لم يتم العثور على عملاء</p>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                const isWalkin = c.phone === '0000000000';

                return (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex justify-between items-center text-xs ${
                      isSelected
                        ? 'bg-indigo-950/80 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-100">{c.full_name}</span>
                        {isWalkin && <Badge variant="secondary" size="sm">نقدي</Badge>}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {c.phone}
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40 block">
                        {c.total_points || 0} نقطة
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* RIGHT 2 COLUMNS: CUSTOMER PROFILE & METRICS DASHBOARD */}
        {selectedCustomer ? (
          <div className="lg:col-span-2 space-y-4">
            {/* PROFILE HEADER & METRICS CARDS */}
            <Card className="p-5 bg-slate-900 border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                    {selectedCustomer.full_name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedCustomer.full_name}</span>
                      <Badge variant="primary" size="sm">{selectedCustomer.tier?.toUpperCase()}</Badge>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selectedCustomer.phone}</span>
                      {selectedCustomer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selectedCustomer.email}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> إجمالي المشتريات
                  </span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {totalSpent.toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" /> عدد الفواتير
                  </span>
                  <span className="text-sm font-black text-white font-mono">{totalOrders} فواتير</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-sky-400" /> متوسط الفاتورة
                  </span>
                  <span className="text-sm font-black text-sky-400 font-mono">
                    {avgOrderValue.toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" /> رصيد نقاط الولاء
                  </span>
                  <span className="text-sm font-black text-amber-400 font-mono">
                    {selectedCustomer.total_points || 0} <span className="text-[10px] font-sans text-slate-400">نقطة</span>
                  </span>
                </div>
              </div>
            </Card>

            {/* TAB NAVIGATION FOR HISTORY */}
            <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
              <div className="flex border-b border-slate-800 pb-2 gap-2 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('purchases')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === 'purchases' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>سجل المشتريات ({customerSales.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('returns')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === 'returns' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>سجل المرتجعات ({customerReturns.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('loyalty')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === 'loyalty' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>سجل النقاط المعزز ({loyaltyLogs.length})</span>
                </button>
              </div>

              {/* TAB CONTENT: PURCHASES */}
              {activeTab === 'purchases' && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {customerSales.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد عمليات شراء سابقة لهذا العميل</p>
                  ) : (
                    customerSales.map((s) => (
                      <div key={s.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-slate-100">
                          <span className="font-mono text-indigo-300">#{s.invoice_number}</span>
                          <span className="font-mono text-emerald-400">{Number(s.total_amount).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>
                            {new Date(s.created_at).toLocaleDateString('ar-SA')} - {s.sale_items?.length} أصناف
                          </span>
                          <Badge variant="primary" size="sm">{s.payment_status}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB CONTENT: RETURNS */}
              {activeTab === 'returns' && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {customerReturns.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد مرتجعات سابقة لهذا العميل</p>
                  ) : (
                    customerReturns.map((r) => (
                      <div key={r.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-slate-100">
                          <span className="font-mono text-rose-400">#{r.return_number}</span>
                          <span className="font-mono text-rose-400">-{Number(r.refund_amount).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>السبب: {r.reason || 'بدون سبب'}</span>
                          <span>{new Date(r.created_at).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB CONTENT: LOYALTY LOGS */}
              {activeTab === 'loyalty' && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {loyaltyLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد حركات نقاط مسجلة لهذا العميل</p>
                  ) : (
                    loyaltyLogs.map((l) => (
                      <div key={l.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-200 block">{l.description}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(l.created_at).toLocaleDateString('ar-SA')} - {new Date(l.created_at).toLocaleTimeString('ar-SA')}
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-sm ${l.points_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {l.points_delta > 0 ? `+${l.points_delta}` : l.points_delta} نقطة
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>

      {/* CREATE NEW CUSTOMER MODAL */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة عميل جديد"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اسم العميل الكامل *</label>
            <Input
              placeholder="مثال: محمد علي العتيبي..."
              value={newCustomer.full_name}
              onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف *</label>
            <Input
              placeholder="05XXXXXXXX"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">البريد الإلكتروني (اختياري)</label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isCreating} variant="primary" className="bg-indigo-600 hover:bg-indigo-500">
              حفظ العميل
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
