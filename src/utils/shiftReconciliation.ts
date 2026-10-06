import { supabase } from '../lib/supabase';

export interface ReconciledShiftTotals {
  totalSalesCash: number;
  totalSalesCard: number;
  totalReturnsCash: number;
  totalExpenses: number;
  totalCashIn: number;
  totalCashOut: number;
}

/**
 * Reconciles and recalculates live totals for a given cashier shift
 * directly from sales, payments, returns, expenses, and cash movements.
 * Also updates the `cashier_shifts` database table so cached columns stay synchronized.
 */
export async function reconcileShiftTotals(shiftId: string): Promise<ReconciledShiftTotals | null> {
  if (!shiftId) return null;

  try {
    // 1. Fetch target shift record
    const { data: shift, error: shiftErr } = await (supabase.from('cashier_shifts') as any)
      .select('*')
      .eq('id', shiftId)
      .single();

    if (shiftErr || !shift) {
      console.warn('reconcileShiftTotals: Shift not found', shiftId);
      return null;
    }

    const shiftOpenedAt = shift.opened_at;

    // 2. Query sales for this shift
    const { data: salesByShift } = await (supabase.from('sales') as any)
      .select('id, total_amount, paid_amount, created_at, cashier_shift_id, payments(payment_method, amount)')
      .eq('cashier_shift_id', shiftId);

    const { data: salesByTime } = await (supabase.from('sales') as any)
      .select('id, total_amount, paid_amount, created_at, cashier_shift_id, payments(payment_method, amount)')
      .gte('created_at', shiftOpenedAt);

    const salesMap = new Map<string, any>();
    (salesByShift || []).forEach((s: any) => salesMap.set(s.id, s));
    (salesByTime || []).forEach((s: any) => salesMap.set(s.id, s));
    const salesData = Array.from(salesMap.values());

    let totalSalesCash = 0;
    let totalSalesCard = 0;

    salesData.forEach((sale: any) => {
      // Re-assign shift id if it was orphaned or defaulted
      if (sale.cashier_shift_id !== shiftId && sale.id) {
        (supabase.from('sales') as any)
          .update({ cashier_shift_id: shiftId })
          .eq('id', sale.id)
          .then();
      }

      if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
        sale.payments.forEach((p: any) => {
          const pm = (p.payment_method || '').toLowerCase();
          const amt = Number(p.amount || 0);
          if (pm === 'card' || pm === 'visa' || pm === 'mastercard' || pm === 'bank_transfer' || pm === 'wallet') {
            totalSalesCard += amt;
          } else {
            totalSalesCash += amt;
          }
        });
      } else {
        const amt = Number(sale.paid_amount || sale.total_amount || 0);
        totalSalesCash += amt;
      }
    });

    // 3. Query returns for this shift
    let totalReturnsCash = 0;
    try {
      const { data: retByShift } = await (supabase.from('returns') as any)
        .select('id, refund_amount, cashier_shift_id, created_at')
        .eq('cashier_shift_id', shiftId);

      const { data: retByTime } = await (supabase.from('returns') as any)
        .select('id, refund_amount, cashier_shift_id, created_at')
        .gte('created_at', shiftOpenedAt);

      const combinedRetMap = new Map<string, number>();
      (retByShift || []).forEach((r: any) => combinedRetMap.set(r.id, Number(r.refund_amount || 0)));
      (retByTime || []).forEach((r: any) => combinedRetMap.set(r.id, Number(r.refund_amount || 0)));

      if (combinedRetMap.size === 0) {
        const { data: altByShift } = await (supabase.from('sale_returns') as any)
          .select('id, refund_amount, cashier_shift_id, created_at')
          .eq('cashier_shift_id', shiftId);
        const { data: altByTime } = await (supabase.from('sale_returns') as any)
          .select('id, refund_amount, cashier_shift_id, created_at')
          .gte('created_at', shiftOpenedAt);

        (altByShift || []).forEach((r: any) => combinedRetMap.set(r.id, Number(r.refund_amount || 0)));
        (altByTime || []).forEach((r: any) => combinedRetMap.set(r.id, Number(r.refund_amount || 0)));
      }

      combinedRetMap.forEach((amt) => {
        totalReturnsCash += amt;
      });
    } catch (e) {}

    // 4. Query expenses for this shift
    let totalExpenses = 0;
    try {
      const { data: expByShift } = await (supabase.from('expenses') as any)
        .select('id, amount, cashier_shift_id, created_at')
        .eq('cashier_shift_id', shiftId);

      const { data: expByTime } = await (supabase.from('expenses') as any)
        .select('id, amount, cashier_shift_id, created_at')
        .gte('created_at', shiftOpenedAt);

      const combinedExpMap = new Map<string, number>();
      (expByShift || []).forEach((ex: any) => combinedExpMap.set(ex.id, Number(ex.amount || 0)));
      (expByTime || []).forEach((ex: any) => combinedExpMap.set(ex.id, Number(ex.amount || 0)));

      combinedExpMap.forEach((amt) => {
        totalExpenses += amt;
      });
    } catch (e) {}

    // 5. Query cash movements for this shift
    let totalCashIn = 0;
    let totalCashOut = 0;
    try {
      const { data: movementsData } = await (supabase.from('cash_movements') as any)
        .select('id, movement_type, amount')
        .eq('cashier_shift_id', shiftId);

      (movementsData || []).forEach((m: any) => {
        const amt = Number(m.amount || 0);
        if (m.movement_type === 'cash_in') {
          totalCashIn += amt;
        } else if (m.movement_type === 'cash_out') {
          totalCashOut += amt;
        }
      });
    } catch (e) {}

    // 6. Update `cashier_shifts` record in DB
    const reconciledPayload = {
      total_sales_cash: totalSalesCash,
      total_sales_card: totalSalesCard,
      total_returns_cash: totalReturnsCash,
      total_expenses: totalExpenses,
      total_cash_in: totalCashIn,
      total_cash_out: totalCashOut,
      updated_at: new Date().toISOString(),
    };

    await (supabase.from('cashier_shifts') as any)
      .update(reconciledPayload)
      .eq('id', shiftId);

    return {
      totalSalesCash,
      totalSalesCard,
      totalReturnsCash,
      totalExpenses,
      totalCashIn,
      totalCashOut,
    };
  } catch (err) {
    console.error('Error in reconcileShiftTotals:', err);
    return null;
  }
}

/**
 * Fetches the exact closing cash balance from the last cashier shift
 * so that register cash accumulates continuously without resetting to 0.
 */
export async function fetchLastShiftBalance(): Promise<number> {
  try {
    const { data: shifts } = await (supabase.from('cashier_shifts') as any)
      .select('id, opening_balance, total_sales_cash, total_cash_in, total_returns_cash, total_cash_out, total_expenses, closing_balance_counted, expected_closing_balance, status')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (shifts && shifts.length > 0) {
      const s = shifts[0];
      const calcBalance = Math.max(0,
        Number(s.opening_balance || 0) +
        Number(s.total_sales_cash || 0) +
        Number(s.total_cash_in || 0) -
        Number(s.total_returns_cash || 0) -
        Number(s.total_cash_out || 0) -
        Number(s.total_expenses || 0)
      );

      if (s.status === 'closed') {
        if (s.closing_balance_counted !== null && s.closing_balance_counted !== undefined && Number(s.closing_balance_counted) > 0) {
          return Number(s.closing_balance_counted);
        }
        if (s.expected_closing_balance !== null && s.expected_closing_balance !== undefined && Number(s.expected_closing_balance) > 0) {
          return Number(s.expected_closing_balance);
        }
      }
      return calcBalance;
    }
  } catch (err) {
    console.error('Error fetching last shift balance:', err);
  }
  return 0;
}
