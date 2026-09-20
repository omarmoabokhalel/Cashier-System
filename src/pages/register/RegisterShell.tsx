import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
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
} from 'lucide-react';

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
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // Shift Close Modal State
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  useEffect(() => {
    fetchShiftData();
  }, []);

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
        setActiveShift({
          id: s.id,
          status: s.status,
          opened_at: s.opened_at,
          opening_balance: Number(s.opening_balance),
          total_sales_cash: Number(s.total_sales_cash),
          total_sales_card: Number(s.total_sales_card),
          total_returns_cash: Number(s.total_returns_cash),
          total_expenses: Number(s.total_expenses),
          total_cash_in: Number(s.total_cash_in),
          total_cash_out: Number(s.total_cash_out),
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
    if (!activeShift || !amt || amt <= 0 || !movementReason.trim()) {
      showToast('warning', 'بيانات ناقصة', 'يرجى إدخال مبلغ صحيح والسبب');
      return;
    }

    setIsSubmittingMovement(true);
    try {
      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_record_cash_movement', {
        p_cashier_shift_id: activeShift.id,
        p_movement_type: movementType,
        p_amount: amt,
        p_reason: movementReason.trim(),
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
            onClick={() => setIsOpenShiftModalOpen(true)}
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs"
          >
            <Unlock className="w-4 h-4" />
            <span>فتح وردية جديدة</span>
          </Button>
        )}
      </div>

      {/* ACTIVE SHIFT METRICS DASHBOARD */}
      {activeShift ? (
        <div className="space-y-4">
          <Card className="p-5 bg-slate-900 border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">الوردية الحالية مفتوحة</h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> منذ {new Date(activeShift.opened_at).toLocaleTimeString('ar-SA')}
                </span>
              </div>
              <Badge variant="primary" size="sm">مفتوحة</Badge>
            </div>

            {/* BREAKDOWN METRICS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block">رصيد الافتتاح</span>
                <span className="font-mono font-bold text-slate-200">{activeShift.opening_balance.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-emerald-400 block flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> مبيعات كاش (+)
                </span>
                <span className="font-mono font-bold text-emerald-400">+{activeShift.total_sales_cash.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-indigo-400 block flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> إيداعات (+)
                </span>
                <span className="font-mono font-bold text-indigo-400">+{activeShift.total_cash_in.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-amber-400 block flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> مرتجعات كاش (-)
                </span>
                <span className="font-mono font-bold text-amber-400">-{activeShift.total_returns_cash.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-rose-400 block flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3" /> سحوبات (-)
                </span>
                <span className="font-mono font-bold text-rose-400">-{activeShift.total_cash_out.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-rose-400 block flex items-center gap-1">
                  <CircleDollarSign className="w-3 h-3" /> مصروفات (-)
                </span>
                <span className="font-mono font-bold text-rose-400">-{activeShift.total_expenses.toFixed(2)} ج.م</span>
              </div>

              <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-800 space-y-1 col-span-2 sm:col-span-1 shadow-lg shadow-emerald-600/10">
                <span className="text-[10px] text-emerald-300 font-bold block">المتوقع بالخزنة</span>
                <span className="font-mono font-black text-emerald-300 text-sm">{expectedCash.toFixed(2)} ج.م</span>
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
            onClick={() => setIsOpenShiftModalOpen(true)}
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
                    تاريخ الإغلاق: {new Date(s.closed_at).toLocaleDateString('ar-SA')} - {new Date(s.closed_at).toLocaleTimeString('ar-SA')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    المتوقع: {Number(s.expected_closing_balance).toFixed(2)} | الفعلي: {Number(s.closing_balance_counted).toFixed(2)}
                  </span>
                </div>

                <div className="text-left">
                  <span className={`font-mono font-bold text-xs ${
                    Number(s.variance) === 0 ? 'text-emerald-400' : Number(s.variance) < 0 ? 'text-rose-400' : 'text-sky-400'
                  }`}>
                    {Number(s.variance) === 0 ? 'طبيعي (0.00)' : `الفارق: ${Number(s.variance).toFixed(2)} ج.م`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

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
    </div>
  );
};
