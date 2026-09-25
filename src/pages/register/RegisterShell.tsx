import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { reconcileShiftTotals } from '../../utils/shiftReconciliation';
import {
  Landmark,
  PlusCircle,
  MinusCircle,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  TrendingUp,
  RotateCcw,
  FileText,
  Eye,
  Printer,
  Receipt,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ReceiptPrintModal } from '../../components/pos/ReceiptPrintModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

import { useAuthStore } from '../../store/useAuthStore';

interface ActiveShift {
  id: string;
  status: string;
  opened_at: string;
  opening_balance: number;
  total_sales_cash: number;
  total_sales_card: number;
  total_returns_cash: number;
  total_expenses: number;
  total_cash_in: number;
  total_cash_out: number;
}

export const RegisterShell: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [closedShifts, setClosedShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Open Shift Modal State
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // Cash In / Out Modal State
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [personName, setPersonName] = useState('');
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  useEffect(() => {
    const defaultName = user?.fullName || localStorage.getItem('admin_display_name') || '';
    setPersonName(defaultName);
  }, [user]);

  // Shift Close Modal State
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  // Detailed Shift Modal State
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any | null>(null);
  const [shiftInvoices, setShiftInvoices] = useState<any[]>([]);
  const [loadingShiftInvoices, setLoadingShiftInvoices] = useState(false);
  const [isShiftDetailsModalOpen, setIsShiftDetailsModalOpen] = useState(false);

  // Receipt Modal State
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Edit Shift Modal State
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
  const [editShiftFormData, setEditShiftFormData] = useState({
    opening_balance: '',
    opened_at: '',
    notes: '',
  });
  const [isSubmittingEditShift, setIsSubmittingEditShift] = useState(false);

  // Delete Shift State
  const [shiftToDelete, setShiftToDelete] = useState<any | null>(null);
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  useEffect(() => {
    fetchShiftData();
  }, []);

  const handleViewShiftDetails = async (shift: any) => {
    setSelectedShiftDetails(shift);
    setIsShiftDetailsModalOpen(true);
    setLoadingShiftInvoices(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers(id, full_name, phone),
          sale_items(
            id, quantity, unit_price, cost_price, discount_amount, total_price, variant_id,
            product_variants(
              id, sku, barcode, selling_price, cost_price,
              products(id, name_ar, name_en),
              sizes(code),
              colors(name_ar)
            )
          ),
          payments(payment_method, amount)
        `)
        .eq('cashier_shift_id', shift.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shift invoices:', error);
        showToast('error', 'فشل تحميل فواتير الوردية', error.message);
      } else {
        setShiftInvoices(data || []);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingShiftInvoices(false);
    }
  };

  const handlePrintShiftInvoice = (s: any) => {
    const formattedReceipt = {
      invoiceNumber: s.invoice_number,
      createdAt: s.created_at,
      cashierName: 'كاشير الوردية',
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

    setSelectedReceiptSale(formattedReceipt);
    setIsReceiptModalOpen(true);
  };

  const fetchShiftData = async () => {
    setLoading(true);
    try {
      const [{ data: activeData }, { data: closedData }]: [{ data: any }, { data: any }] = await Promise.all([
        (supabase.from('cashier_shifts') as any)
          .select('*')
          .eq('status', 'open')
          .limit(1),
        (supabase.from('cashier_shifts') as any)
          .select('*')
          .eq('status', 'closed')
          .order('closed_at', { ascending: false })
          .limit(10),
      ]);

      if (activeData && activeData.length > 0) {
        const s = activeData[0];
        const reconciled = await reconcileShiftTotals(s.id);
        setActiveShift({
          id: s.id,
          status: s.status,
          opened_at: s.opened_at,
          opening_balance: Number(s.opening_balance),
          total_sales_cash: reconciled ? reconciled.totalSalesCash : Number(s.total_sales_cash),
          total_sales_card: reconciled ? reconciled.totalSalesCard : Number(s.total_sales_card),
          total_returns_cash: reconciled ? reconciled.totalReturnsCash : Number(s.total_returns_cash),
          total_expenses: reconciled ? reconciled.totalExpenses : Number(s.total_expenses),
          total_cash_in: reconciled ? reconciled.totalCashIn : Number(s.total_cash_in),
          total_cash_out: reconciled ? reconciled.totalCashOut : Number(s.total_cash_out),
        });
      } else {
        setActiveShift(null);
      }

      setClosedShifts(closedData || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Live Expected Cash Formula
  const calculateExpectedCash = () => {
    if (!activeShift) return 0;
    return (
      activeShift.opening_balance +
      activeShift.total_sales_cash +
      activeShift.total_cash_in -
      activeShift.total_returns_cash -
      activeShift.total_cash_out -
      activeShift.total_expenses
    );
  };

  const expectedCash = calculateExpectedCash();
  const countedNum = parseFloat(countedCash) || 0;
  const varianceNum = countedNum - expectedCash;

  // Handle Cash In / Cash Out
  const handleRecordCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(movementAmount);
    if (!personName.trim()) {
      showToast('warning', 'اسم الشخص مطلوب', 'يرجى إدخال اسم الشخص الذي يسحب أو يودع المبلغ (إجباري)');
      return;
    }
    if (!activeShift || !amt || amt <= 0 || !movementReason.trim()) {
      showToast('warning', 'بيانات ناقصة', 'يرجى إدخال مبلغ صحيح والسبب');
      return;
    }

    setIsSubmittingMovement(true);
    try {
      const fullReason = `بواسطة: ${personName.trim()} | السبب: ${movementReason.trim()}`;
      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_record_cash_movement', {
        p_cashier_shift_id: activeShift.id,
        p_movement_type: movementType,
        p_amount: amt,
        p_reason: fullReason,
      });

      if (error) {
        showToast('error', 'فشلت العملية', error.message);
      } else {
        showToast('success', movementType === 'cash_in' ? 'تم تسجيل الإيداع بنجاح' : 'تم تسجيل السحب بنجاح');
        setIsCashMovementModalOpen(false);
        setMovementAmount('');
        setMovementReason('');
        fetchShiftData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء تنفيذ العملية', e.message);
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  // Handle Shift Closing
  const handleConfirmCloseShift = async () => {
    if (!activeShift) return;

    setIsClosingShift(true);
    try {
      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_close_cashier_shift', {
        p_shift_id: activeShift.id,
        p_closing_balance_counted: countedNum,
        p_notes: closeNotes.trim() || null,
      });

      if (error) {
        showToast('error', 'فشل إغلاق الوردية', error.message);
      } else {
        showToast(
          'success',
          'تم إغلاق الوردية وحفظ السجل الفعلي بنجاح!',
          `الفارق الحسابي: ${data?.variance >= 0 ? '+' : ''}${Number(data?.variance).toFixed(2)} ج.م`
        );
        setIsCloseShiftModalOpen(false);
        setCountedCash('');
        setCloseNotes('');
        fetchShiftData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء إغلاق الوردية', e.message);
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleOpenNewShiftModalClick = async () => {
    try {
      const { data: lastShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('closing_balance_counted, expected_closing_balance')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1);

      if (lastShiftData && lastShiftData.length > 0) {
        const last = lastShiftData[0];
        const prevBal = last.closing_balance_counted !== null && last.closing_balance_counted !== undefined
          ? String(last.closing_balance_counted)
          : String(last.expected_closing_balance || 0);
        setOpeningBalance(prevBal);
      } else {
        setOpeningBalance('0');
      }
    } catch (e) {
      console.error(e);
      setOpeningBalance('0');
    }
    setIsOpenShiftModalOpen(true);
  };

  // Handle Shift Opening
  const handleOpenNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpeningShift(true);
    try {
      const isValidUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const defaultBranchId = '00000000-0000-0000-0000-000000000001';
      const defaultRegisterId = '00000000-0000-0000-0000-000000000001';
      const defaultCashierId = isValidUuid(user?.id) ? user!.id : '00000000-0000-0000-0000-000000000001';

      const { error } = await (supabase.from('cashier_shifts') as any).insert({
        branch_id: defaultBranchId,
        cash_register_id: defaultRegisterId,
        cashier_id: defaultCashierId,
        opening_balance: parseFloat(openingBalance) || 0,
        status: 'open',
        opened_at: new Date().toISOString(),
      });

      if (error) {
        showToast('error', 'فشل فتح الوردية', error.message);
      } else {
        showToast('success', 'تم فتح وردية جديدة بنجاح!');
        setIsOpenShiftModalOpen(false);
        setOpeningBalance('0');
        fetchShiftData();
      }
    } catch (err: any) {
      showToast('error', 'خطأ أثناء فتح الوردية', err.message);
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleOpenEditShift = (shift: any) => {
    setEditingShift(shift);
    const d = new Date(shift.opened_at);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setEditShiftFormData({
      opening_balance: String(shift.opening_balance || 0),
      opened_at: localISO,
      notes: shift.notes || '',
    });
    setIsEditShiftModalOpen(true);
  };

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    setIsSubmittingEditShift(true);
    try {
      const updatedOpenedAt = editShiftFormData.opened_at
        ? new Date(editShiftFormData.opened_at).toISOString()
        : editingShift.opened_at;

      const { error } = await (supabase.from('cashier_shifts') as any)
        .update({
          opening_balance: parseFloat(editShiftFormData.opening_balance) || 0,
          opened_at: updatedOpenedAt,
          notes: editShiftFormData.notes.trim() || null,
        })
        .eq('id', editingShift.id);

      if (error) {
        showToast('error', 'فشل تعديل الوردية', error.message);
      } else {
        showToast('success', 'تم تعديل الوردية بنجاح!');
        setIsEditShiftModalOpen(false);
        setEditingShift(null);
        fetchShiftData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء التعديل', e.message);
    } finally {
      setIsSubmittingEditShift(false);
    }
  };

  const handleConfirmDeleteShift = async () => {
    if (!shiftToDelete) return;
    setIsDeletingShift(true);
    try {
      const { error } = await (supabase.from('cashier_shifts') as any)
        .delete()
        .eq('id', shiftToDelete.id);

      if (error) {
        showToast('error', 'فشل مسح الوردية', error.message);
      } else {
        showToast('success', 'تم مسح الوردية بنجاح');
        setShiftToDelete(null);
        fetchShiftData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء المسح', e.message);
    } finally {
      setIsDeletingShift(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-400" />
            <span>إدارة الخزنة والورديات اليومية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة حركة النقدية، السحب والإيداع ومطابقة الفروقات الحسابية عند إغلاق الوردية
          </p>
        </div>

        {activeShift ? (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setMovementType('cash_in');
                setIsCashMovementModalOpen(true);
              }}
              variant="secondary"
              className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800 gap-1.5 text-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إيداع نقدي (Cash In)</span>
            </Button>

            <Button
              onClick={() => {
                setMovementType('cash_out');
                setIsCashMovementModalOpen(true);
              }}
              variant="secondary"
              className="bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-800 gap-1.5 text-xs"
            >
              <MinusCircle className="w-4 h-4" />
              <span>سحب نقدي (Cash Out)</span>
            </Button>

            <Button
              onClick={() => setIsCloseShiftModalOpen(true)}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs"
            >
              <Lock className="w-4 h-4" />
              <span>إغلاق الوردية الحالية</span>
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleOpenNewShiftModalClick}
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs"
          >
            <Unlock className="w-4 h-4" />
            <span>فتح وردية جديدة</span>
          </Button>
        )}
      </div>

      {/* ACTIVE SHIFT METRICS DASHBOARD */}
      {/* ACTIVE SHIFT NET CASH HERO DISPLAY */}
      {activeShift ? (
        <div className="space-y-4 font-sans" dir="rtl">
          {/* PROMINENT NET CASH HERO CARD */}
          <Card className="p-6 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 border-2 border-emerald-500/80 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-emerald-800/60 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    الرصيد الفعلي الصافي المتبقي بالخزنة الآن (Net Expected Cash Box)
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl md:text-5xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-[0_4px_12px_rgba(52,211,153,0.3)]">
                    {expectedCash.toFixed(2)}
                  </span>
                  <span className="text-lg font-bold text-emerald-300">جنيه مصري (ج.م)</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  * الصافي المحسوب آلياً = (رصيد الافتتاح + مبيعات الكاش + الإيداعات) - (المرتجعات + السحوبات + المصروفات)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleViewShiftDetails(activeShift)}
                  size="sm"
                  variant="secondary"
                  className="bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-xs font-bold gap-1.5 px-3 py-2"
                >
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>استعراض فواتير الوردية</span>
                </Button>

                <Button
                  onClick={() => handleOpenEditShift(activeShift)}
                  size="sm"
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold gap-1.5 px-3 py-2"
                >
                  <Pencil className="w-4 h-4 text-indigo-400" />
                  <span>تعديل الوردية</span>
                </Button>

                <Button
                  onClick={() => setShiftToDelete(activeShift)}
                  size="sm"
                  variant="secondary"
                  className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/60 text-xs font-bold gap-1.5 px-3 py-2"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>حذف الوردية</span>
                </Button>

                <Badge variant="primary" size="md" className="bg-emerald-600 text-white font-bold px-3 py-1.5">
                  الوردية مفتوحة
                </Badge>
              </div>
            </div>

            {/* DETAILED BREAKDOWN UNDERNEATH */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">تفاصيل وتفكيك حساب الصافي المتوقع بالخزنة:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">1. رصيد الافتتاح (Opening)</span>
                  <span className="font-mono font-bold text-white text-sm">{activeShift.opening_balance.toFixed(2)} ج.م</span>
                </div>

                <div className="bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-800/60 space-y-1">
                  <span className="text-[10px] text-emerald-400 block font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> 2. + مبيعات الكاش
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">+{activeShift.total_sales_cash.toFixed(2)} ج.م</span>
                </div>

                <div className="bg-indigo-950/60 p-3.5 rounded-2xl border border-indigo-800/60 space-y-1">
                  <span className="text-[10px] text-indigo-400 block font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> 3. + إيداعات الخزنة
                  </span>
                  <span className="font-mono font-bold text-indigo-400 text-sm">+{activeShift.total_cash_in.toFixed(2)} ج.م</span>
                </div>

                <div className="bg-amber-950/60 p-3.5 rounded-2xl border border-amber-800/60 space-y-1">
                  <span className="text-[10px] text-amber-400 block font-bold flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> 4. - مرتجعات الكاش
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">-{activeShift.total_returns_cash.toFixed(2)} ج.م</span>
                </div>

                <div className="bg-rose-950/60 p-3.5 rounded-2xl border border-rose-800/60 space-y-1">
                  <span className="text-[10px] text-rose-400 block font-bold flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" /> 5. - سحوبات النقدية
                  </span>
                  <span className="font-mono font-bold text-rose-400 text-sm">-{activeShift.total_cash_out.toFixed(2)} ج.م</span>
                </div>

                <div className="bg-rose-950/60 p-3.5 rounded-2xl border border-rose-800/60 space-y-1">
                  <span className="text-[10px] text-rose-400 block font-bold flex items-center gap-1">
                    <CircleDollarSign className="w-3.5 h-3.5" /> 6. - المصروفات
                  </span>
                  <span className="font-mono font-bold text-rose-400 text-sm">-{activeShift.total_expenses.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center bg-slate-900 border-slate-800 space-y-4">
          <Unlock className="w-12 h-12 text-amber-500/80 mx-auto animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">لا توجد وردية كاشير مفتوحة حالياً</h3>
            <p className="text-xs text-slate-400">ابدأ وردية جديدة للبدء في إجراء عمليات البيع والإيداع واستلام النقدية</p>
          </div>
          <Button
            onClick={handleOpenNewShiftModalClick}
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-sm px-6 py-2.5 mx-auto"
          >
            <Unlock className="w-4 h-4" />
            <span>فتح وردية جديدة الآن</span>
          </Button>
        </Card>
      )}

      {/* CLOSED SHIFTS HISTORY LOG */}
      <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
          سجل الورديات السابقة المغلقة
        </h3>

        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
          {closedShifts.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">لا توجد ورديات مغلقة سابقة</p>
          ) : (
            closedShifts.map((s) => (
              <div key={s.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-100 block">
                    تاريخ الإغلاق: {new Date(s.closed_at).toLocaleDateString('ar-EG')} - {new Date(s.closed_at).toLocaleTimeString('ar-EG')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    المتوقع: {Number(s.expected_closing_balance).toFixed(2)} | الفعلي: {Number(s.closing_balance_counted).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <span className={`font-mono font-bold text-xs ${
                      Number(s.variance) === 0 ? 'text-emerald-400' : Number(s.variance) < 0 ? 'text-rose-400' : 'text-sky-400'
                    }`}>
                      {Number(s.variance) === 0 ? 'طبيعي (0.00)' : `الفارق: ${Number(s.variance).toFixed(2)} ج.م`}
                    </span>
                  </div>

                  <Button
                    onClick={() => handleViewShiftDetails(s)}
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] gap-1 px-2.5 py-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>التفاصيل</span>
                  </Button>

                  <Button
                    onClick={() => handleOpenEditShift(s)}
                    size="sm"
                    variant="secondary"
                    className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-[11px] gap-1 px-2.5 py-1"
                  >
                    <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                    <span>تعديل</span>
                  </Button>

                  <Button
                    onClick={() => setShiftToDelete(s)}
                    size="sm"
                    variant="secondary"
                    className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-[11px] gap-1 px-2.5 py-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* SHIFT DETAILS & INVOICES MODAL */}
      <Dialog
        isOpen={isShiftDetailsModalOpen}
        onClose={() => setIsShiftDetailsModalOpen(false)}
        title={`تفاصيل وفواتير الوردية (${selectedShiftDetails?.status === 'open' ? 'الوردية الحالية' : 'وردية مغلقة'})`}
        maxWidth="lg"
      >
        <div className="space-y-4 font-sans select-none text-slate-100" dir="rtl">
          {selectedShiftDetails && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">تاريخ ووقت الفتح</span>
                <span className="font-bold text-slate-200">
                  {new Date(selectedShiftDetails.opened_at).toLocaleDateString('ar-EG')} {new Date(selectedShiftDetails.opened_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">تاريخ ووقت الإغلاق</span>
                <span className="font-bold text-slate-200">
                  {selectedShiftDetails.closed_at
                    ? `${new Date(selectedShiftDetails.closed_at).toLocaleDateString('ar-EG')} ${new Date(selectedShiftDetails.closed_at).toLocaleTimeString('ar-EG')}`
                    : 'مفتوحة حالياً'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">مبيعات الكاش والشبكة</span>
                <span className="font-bold text-emerald-400">
                  كاش: {Number(selectedShiftDetails.total_sales_cash || 0).toFixed(2)} | شبكة: {Number(selectedShiftDetails.total_sales_card || 0).toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">الرصيد الفعلي / الفارق</span>
                <span className="font-bold text-amber-400 font-mono">
                  {selectedShiftDetails.closing_balance_counted !== undefined
                    ? `${Number(selectedShiftDetails.closing_balance_counted).toFixed(2)} (فارق: ${Number(selectedShiftDetails.variance || 0).toFixed(2)})`
                    : 'في الانتظار'}
                </span>
              </div>
            </div>
          )}

          {/* Shift Sales Invoices List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>فواتير المبيعات الصادرة في هذه الوردية ({shiftInvoices.length} فاتورة)</span>
            </h4>

            {loadingShiftInvoices ? (
              <div className="p-6 text-center text-xs text-slate-500">جاري تحميل فواتير الوردية...</div>
            ) : shiftInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                لم يتم إصدار أي فواتير في هذه الوردية
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto custom-scrollbar border border-slate-800 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">رقم الفاتورة</th>
                      <th className="p-2.5">الوقت</th>
                      <th className="p-2.5">العميل</th>
                      <th className="p-2.5">طريقة الدفع</th>
                      <th className="p-2.5">المبلغ الإجمالي</th>
                      <th className="p-2.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                    {shiftInvoices
                      .filter((inv) => {
                        if (user?.roleCode === 'cashier') {
                          if (inv.notes && inv.notes.includes('role:owner')) return false;
                          if (inv.cashier_id === '00000000-0000-0000-0000-000000000001' && inv.cashier_id !== user?.id) return false;
                        }
                        return true;
                      })
                      .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-indigo-400">
                          {inv.invoice_number}
                        </td>
                        <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                          {new Date(inv.created_at).toLocaleTimeString('ar-EG')}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-200">
                          {inv.customers?.full_name || 'عميل نقدي عام'}
                        </td>
                        <td className="p-2.5">
                          <Badge variant="secondary" size="sm">
                            {inv.payments?.[0]?.payment_method === 'card'
                              ? 'بطاقة'
                              : 'نقداً'}
                          </Badge>
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-400">
                          {Number(inv.total_amount).toFixed(2)} ج.م
                        </td>
                        <td className="p-2.5 text-center">
                          <Button
                            onClick={() => handlePrintShiftInvoice(inv)}
                            size="sm"
                            variant="secondary"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] gap-1 px-2 py-0.5"
                          >
                            <Printer className="w-3 h-3 text-emerald-400" />
                            <span>طباعة الفاتورة</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsShiftDetailsModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>

      {/* RECEIPT MODAL */}
      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedReceiptSale}
      />

      {/* OPEN NEW SHIFT MODAL */}
      <Dialog
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        title="فتح وردية كاشير جديدة"
        maxWidth="sm"
      >
        <form onSubmit={handleOpenNewShift} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المبلغ الابتدائي / عهدة الافتتاح (ج.م) *</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">أدخل قيمة المبلغ النقدي الموجود بالخزنة في بداية الوردية (مثال: الفكة الصباحية)</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsOpenShiftModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isOpeningShift} variant="primary" className="bg-emerald-600 hover:bg-emerald-500">
              تأكيد فتح الوردية
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CASH MOVEMENT MODAL (CASH IN / CASH OUT) */}
      <Dialog
        isOpen={isCashMovementModalOpen}
        onClose={() => setIsCashMovementModalOpen(false)}
        title={movementType === 'cash_in' ? 'إيداع نقدي بالخزنة (Cash In)' : 'سحب نقدي من الخزنة (Cash Out)'}
        maxWidth="sm"
      >
        <form onSubmit={handleRecordCashMovement} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {movementType === 'cash_in' ? 'اسم الشخص الذي يودع المبلغ * (إجباري)' : 'اسم الشخص الذي يسحب المبلغ * (إجباري)'}
            </label>
            <Input
              type="text"
              placeholder="أدخل اسم الشخص المنفذ..."
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المبلغ (ج.م) *</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">سبب العملية والملاحظات *</label>
            <Input
              placeholder="مثال: تزويد الفكة الصباحية / سحب كاش للبنك..."
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsCashMovementModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSubmittingMovement} variant="primary">
              تأكيد العملية
            </Button>
          </div>
        </form>
      </Dialog>

      {/* SHIFT CLOSE MODAL */}
      <Dialog
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        title="مطابقة النقدية وإغلاق الوردية"
        maxWidth="md"
      >
        <div className="space-y-4 font-sans" dir="rtl">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">المبلغ المحسوب المتوقع في الخزنة:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{expectedCash.toFixed(2)} ج.م</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المبلغ الفعلي في الخزنة بعد الجرد (ج.م) *</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder={expectedCash.toFixed(2)}
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Variance Live Calculation Badge */}
          <div className="p-3 rounded-xl border text-xs flex justify-between items-center bg-slate-950 border-slate-800">
            <span>الفارق الحسابي (العجز / الفائض):</span>
            <span className={`font-mono font-bold text-sm ${
              varianceNum === 0 ? 'text-emerald-400' : varianceNum < 0 ? 'text-rose-400' : 'text-sky-400'
            }`}>
              {varianceNum === 0 ? 'مطابق تماماً (0.00 ج.م)' : `${varianceNum > 0 ? '+' : ''}${varianceNum.toFixed(2)} ج.م`}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات الإغلاق</label>
            <textarea
              rows={2}
              placeholder="أدخل أي ملاحظات حول جرد الوردية..."
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsCloseShiftModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleConfirmCloseShift} isLoading={isClosingShift} variant="primary" className="bg-indigo-600 hover:bg-indigo-500">
              تأكيد جرد وإغلاق الوردية
            </Button>
          </div>
        </div>
      </Dialog>

      {/* EDIT SHIFT DIALOG */}
      <Dialog isOpen={isEditShiftModalOpen} onClose={() => setIsEditShiftModalOpen(false)} title="تعديل الوردية والخزنة" maxWidth="md">
        <form onSubmit={handleUpdateShift} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">تاريخ ووقت فتح الوردية (تعديل التاريخ والوقت)</label>
            <Input
              type="datetime-local"
              value={editShiftFormData.opened_at}
              onChange={(e) => setEditShiftFormData({ ...editShiftFormData, opened_at: e.target.value })}
              className="bg-slate-950 border-slate-800 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">رصيد الافتتاح (ج.م)</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={editShiftFormData.opening_balance}
              onChange={(e) => setEditShiftFormData({ ...editShiftFormData, opening_balance: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات الوردية / اسم المسحب أو المودع</label>
            <textarea
              rows={2}
              placeholder="ملاحظات..."
              value={editShiftFormData.notes}
              onChange={(e) => setEditShiftFormData({ ...editShiftFormData, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsEditShiftModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSubmittingEditShift} variant="primary" className="bg-indigo-600 hover:bg-indigo-500">
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CONFIRM DELETE SHIFT DIALOG */}
      <ConfirmDialog
        isOpen={!!shiftToDelete}
        onClose={() => setShiftToDelete(null)}
        onConfirm={handleConfirmDeleteShift}
        title="تأكيد مسح سجل الوردية"
        message="هل أنت تأكد من مسح سجل الوردية نهائياً من الخزنة؟ سيتم حذف بيانات جرد هذه الوردية من النظام."
        confirmText="حذف الوردية"
        cancelText="إلغاء"
        isLoading={isDeletingShift}
        variant="danger"
      />
    </div>
  );
};
