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
    // Match by cashier_shift_id OR sales created during shift window with fallback/null shift ID
    const { data: salesData } = await (supabase.from('sales') as any)
      .select('id, total_amount, paid_amount, created_at, cashier_shift_id, payments(payment_method, amount)')
      .or(`cashier_shift_id.eq.${shiftId},and(cashier_shift_id.eq.00000000-0000-0000-0000-000000000001,created_at.gte.${shiftOpenedAt})`);

    let totalSalesCash = 0;
    let totalSalesCard = 0;

    (salesData || []).forEach((sale: any) => {
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
      const { data: returnsData } = await (supabase.from('sale_returns') as any)
        .select('id, refund_amount, total_amount, cashier_shift_id, created_at')
        .or(`cashier_shift_id.eq.${shiftId},and(cashier_shift_id.eq.00000000-0000-0000-0000-000000000001,created_at.gte.${shiftOpenedAt})`);

      (returnsData || []).forEach((r: any) => {
        totalReturnsCash += Number(r.refund_amount || r.total_amount || 0);
      });
    } catch (e) {
      try {
        const { data: returnsData } = await (supabase.from('returns') as any)
          .select('id, refund_amount, total_amount, cashier_shift_id, created_at')
          .or(`cashier_shift_id.eq.${shiftId},and(cashier_shift_id.eq.00000000-0000-0000-0000-000000000001,created_at.gte.${shiftOpenedAt})`);

        (returnsData || []).forEach((r: any) => {
          totalReturnsCash += Number(r.refund_amount || r.total_amount || 0);
        });
      } catch (err) {}
    }

    // 4. Query expenses for this shift
    let totalExpenses = 0;
    try {
      const { data: expensesData } = await (supabase.from('expenses') as any)
        .select('id, amount, cashier_shift_id, created_at')
        .or(`cashier_shift_id.eq.${shiftId},and(cashier_shift_id.eq.00000000-0000-0000-0000-000000000001,created_at.gte.${shiftOpenedAt})`);

      (expensesData || []).forEach((ex: any) => {
        totalExpenses += Number(ex.amount || 0);
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
