import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { reconcileShiftTotals, fetchLastShiftBalance } from '../../utils/shiftReconciliation';
import {
  FileText,
  DollarSign,
  TrendingUp,
  CircleDollarSign,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Lock,
  UserCheck,
  Building,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface CloseDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReport: (reportData: any) => void;
}

export const CloseDayModal: React.FC<CloseDayModalProps> = ({
  isOpen,
  onClose,
  onOpenReport,
}) => {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Today's summary state
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [cashSales, setCashSales] = useState<number>(0);
  const [cardSales, setCardSales] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [invoicesCount, setInvoicesCount] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [returns, setReturns] = useState<number>(0);
  const [cashIn, setCashIn] = useState<number>(0);
  const [cashOut, setCashOut] = useState<number>(0);
  const [netRegisterCash, setNetRegisterCash] = useState<number>(0);

  // Cash withdrawal at close form
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawPerson, setWithdrawPerson] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<string>('توريد نقدية وتقفيل اليوم');

  useEffect(() => {
    if (isOpen) {
      const defaultName = user?.fullName || localStorage.getItem('admin_display_name') || 'المالك / المدير';
      setWithdrawPerson(defaultName);
      loadTodayMetrics();
    }
  }, [isOpen, user]);

  const loadTodayMetrics = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch current active shift
      const { data: openShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      const currentShift = openShiftData && openShiftData.length > 0 ? openShiftData[0] : null;
      setActiveShift(currentShift);

      if (currentShift) {
        try {
          await reconcileShiftTotals(currentShift.id);
        } catch (e) {}
      }

      // 2. Fetch sales today
      const { data: salesData } = await (supabase.from('sales') as any)
        .select('id, total_amount, paid_amount, created_at, payments(payment_method, amount)')
        .gte('created_at', `${todayStr}T00:00:00`);

      let totalSalesSum = 0;
      let cashSum = 0;
      let cardSum = 0;
      const salesList = salesData || [];
      const invCount = salesList.length;

      salesList.forEach((s: any) => {
        const amt = Number(s.total_amount || 0);
        totalSalesSum += amt;

        if (s.payments && Array.isArray(s.payments) && s.payments.length > 0) {
          s.payments.forEach((p: any) => {
            const pm = (p.payment_method || '').toLowerCase();
            const pAmt = Number(p.amount || 0);
            if (pm === 'card' || pm === 'visa' || pm === 'mastercard' || pm === 'bank_transfer' || pm === 'wallet') {
              cardSum += pAmt;
            } else {
              cashSum += pAmt;
            }
          });
        } else {
          cashSum += amt;
        }
      });

      // 3. Fetch returns today
      let returnsSum = 0;
      try {
        const { data: retData } = await (supabase.from('sale_returns') as any)
          .select('refund_amount, created_at')
          .gte('created_at', `${todayStr}T00:00:00`);
        returnsSum = (retData || []).reduce((sum: number, r: any) => sum + Number(r.refund_amount || 0), 0);
      } catch (e) {}

      // 4. Fetch expenses today
      let expensesSum = 0;
      try {
        const { data: expData } = await (supabase.from('expenses') as any)
          .select('amount, created_at')
          .gte('created_at', `${todayStr}T00:00:00`);
        expensesSum = (expData || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      } catch (e) {}

      // 5. Fetch cash movements today
      let cashInSum = 0;
      let cashOutSum = 0;
      try {
        const { data: movData } = await (supabase.from('cash_movements') as any)
          .select('movement_type, amount, created_at')
          .gte('created_at', `${todayStr}T00:00:00`);

        (movData || []).forEach((m: any) => {
          const mAmt = Number(m.amount || 0);
          if (m.movement_type === 'cash_in') cashInSum += mAmt;
          else if (m.movement_type === 'cash_out') cashOutSum += mAmt;
        });
      } catch (e) {}

      // 6. Register opening balance & net cash position
      const openBal = currentShift
        ? Number(currentShift.opening_balance || 0)
        : await fetchLastShiftBalance();

      const netCashInRegister = Math.max(
        0,
        openBal + cashSum + cashInSum - returnsSum - cashOutSum - expensesSum
      );

      setOpeningBalance(openBal);
      setCashSales(cashSum);
      setCardSales(cardSum);
      setTotalSales(totalSalesSum);
      setInvoicesCount(invCount);
      setExpenses(expensesSum);
      setReturns(returnsSum);
      setCashIn(cashInSum);
      setCashOut(cashOutSum);
      setNetRegisterCash(netCashInRegister);
    } catch (err: any) {
      console.error('Error loading today metrics for close day:', err);
      showToast('error', 'خطأ في جلب بيانات اليوم', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCloseDay = async () => {
    setSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const withdrawVal = parseFloat(withdrawAmount) || 0;

      if (withdrawVal > netRegisterCash) {
        showToast('warning', 'المبلغ الفعلي غير كافٍ', `مبلغ السحب (${withdrawVal.toFixed(2)} ج.م) أكبر من النقدية المتوفرة بالخزنة (${netRegisterCash.toFixed(2)} ج.م)`);
        setSubmitting(false);
        return;
      }

      // 1. Record Cash Out if withdrawal specified
      if (withdrawVal > 0) {
        const reasonStr = `سحب تقفيل اليوم | بواسطة: ${withdrawPerson.trim()} | السبب: ${withdrawReason.trim()}`;
        if (activeShift?.id) {
          await (supabase.rpc as any)('rpc_record_cash_movement', {
            p_cashier_shift_id: activeShift.id,
            p_movement_type: 'cash_out',
            p_amount: withdrawVal,
            p_reason: reasonStr,
          });
        } else {
          await (supabase.from('cash_movements') as any).insert({
            branch_id: '00000000-0000-0000-0000-000000000001',
            cashier_shift_id: '00000000-0000-0000-0000-000000000001',
            movement_type: 'cash_out',
            amount: withdrawVal,
            reason: reasonStr,
            performed_by: user?.id || null,
          });
        }
      }

      // 2. Final register balance after withdrawal
      const finalRegisterBalance = Math.max(0, netRegisterCash - withdrawVal);

      // 3. Close open shift cleanly if active
      if (activeShift?.id) {
        await (supabase.rpc as any)('rpc_close_cashier_shift', {
          p_shift_id: activeShift.id,
          p_closing_balance_counted: finalRegisterBalance,
          p_notes: `تقفيل اليوم الشامل (${todayStr}) | تم سحب: ${withdrawVal.toFixed(2)} ج.م | الرصيد المتبقي للغد: ${finalRegisterBalance.toFixed(2)} ج.م`,
        });
      }

      showToast('success', 'تم تقفيل اليوم بنجاح!', `رصيد الخزنة المتبقي للغد: ${finalRegisterBalance.toFixed(2)} ج.م`);

      // 4. Construct Daily Report Data Payload
      const reportPayload = {
        date: todayStr,
        closedAt: new Date().toISOString(),
        performerName: withdrawPerson.trim(),
        openingBalance,
        cashSales,
        cardSales,
        totalSales,
        invoicesCount,
        expenses,
        returns,
        cashIn,
        cashOut: cashOut + withdrawVal,
        withdrawAtClose: withdrawVal,
        withdrawReason,
        finalRegisterBalance,
      };

      onClose();
      onOpenReport(reportPayload);
    } catch (err: any) {
      console.error('Error confirming close day:', err);
      showToast('error', 'حدث خطأ أثناء تقفيل اليوم', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="تقفيل اليوم وإصدار التقرير الشامل" maxWidth="2xl">
      <div className="space-y-4 font-sans select-none" dir="rtl">
        {/* HEADER NOTICE */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-800/80 p-4 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-indigo-200">
            <Building className="w-6 h-6 text-indigo-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-sm">مراجعة وتأكيد تقفيل اليوم</h4>
              <span className="text-slate-400 text-[11px] block mt-0.5">
                تاريخ اليوم: <strong className="font-mono text-indigo-300">{new Date().toLocaleDateString('ar-EG')}</strong> | يمكنك سحب أرباح اليوم أو تدوير الخزنة للغد.
              </span>
            </div>
          </div>
          <Badge variant="primary" size="sm" className="bg-indigo-950 border border-indigo-700 text-indigo-300">
            Close Day Workflow
          </Badge>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">جاري تجميع حركات الخزنة والمبيعات لليوم...</span>
          </div>
        ) : (
          <>
            {/* TODAY FINANCIAL METRICS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">رصيد بداية اليوم</span>
                <span className="font-mono font-bold text-slate-100 text-base">
                  {openingBalance.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">المبيعات النقدي (Cash)</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  +{cashSales.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">مبيعات الكارت (Visa)</span>
                <span className="font-mono font-bold text-sky-400 text-base">
                  {cardSales.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">المصروفات التشغيلية</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  -{expenses.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">إجمالي المرتجعات</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  -{returns.toFixed(2)} <span className="text-[10px] text-slate-400 font-sans">ج.م</span>
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">عدد الفواتير الصادرة</span>
                <span className="font-mono font-bold text-purple-400 text-base">
                  {invoicesCount} <span className="text-[10px] text-slate-400 font-sans">فاتورة</span>
                </span>
              </div>
            </div>

            {/* REGISTER CASH BALANCE HIGHLIGHT */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-bold block">السيولة النقدية الحالية بالخزنة (قبل السحب):</span>
                <span className="text-xs text-slate-400">تحتسب تلقائياً (بداية اليوم + مبيعات كاش + إيداعات - مصروفات - مرتجعات)</span>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {netRegisterCash.toFixed(2)} <span className="text-xs font-sans text-slate-300">ج.م</span>
              </span>
            </div>

            {/* WITHDRAWAL FORM AT CLOSE */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-rose-400" />
                <span>سحب نقدية عند التقفيل (اختياري)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                إذا كنت ترغب في سحب أرباح اليوم أو توريد مبلغ للمالك، أدخل المبلغ هنا وسيطرح من الخزنة، والمبلغ المتبقي سيرتدا تلقائياً للغد.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">مبلغ السحب (ج.م):</label>
                  <Input
                    type="number"
                    placeholder="مثال: 500 (أو اتركه 0 للترحيل بالكامل)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    icon={<DollarSign className="w-4 h-4 text-rose-400" />}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">اسم الشخص المسلّم/المستلم:</label>
                  <Input
                    type="text"
                    placeholder="أدخل اسم الشخص"
                    value={withdrawPerson}
                    onChange={(e) => setWithdrawPerson(e.target.value)}
                    icon={<UserCheck className="w-4 h-4 text-indigo-400" />}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">بيان / سبب السحب:</label>
                <Input
                  type="text"
                  placeholder="سبب السحب (مثال: توريد نقدية للمالك)"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>

              {/* REMAINING CASH PREVIEW */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">الرصيد المتبقي بالخزنة للغد بعد السحب:</span>
                <span className="font-mono font-bold text-sky-400 text-sm">
                  {Math.max(0, netRegisterCash - (parseFloat(withdrawAmount) || 0)).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                إلغاء
              </Button>
              <Button
                onClick={handleConfirmCloseDay}
                isLoading={submitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>تأكيد تقفيل اليوم وإصدار التقرير</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
