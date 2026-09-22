import { supabase } from '../lib/supabase';

/**
 * Utility to handle automatic shift auto-close & auto-open at 12:00 AM Cairo Midnight (Africa/Cairo)
 */
export const checkAndAutoCloseCairoMidnightShift = async () => {
  try {
    // 1. Fetch current open shift
    const { data: openShifts } = await (supabase.from('cashier_shifts') as any)
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!openShifts || openShifts.length === 0) return;

    const activeShift = openShifts[0];
    const openedDate = new Date(activeShift.opened_at);
    const now = new Date();

    // Calculate dates in Cairo timezone
    const getCairoDateString = (d: Date) =>
      d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); // YYYY-MM-DD format

    const openedCairoDay = getCairoDateString(openedDate);
    const currentCairoDay = getCairoDateString(now);

    // If midnight has passed (current day in Cairo > opened day in Cairo)
    if (currentCairoDay > openedCairoDay) {
      console.log(`[ShiftAutoScheduler] Midnight passed in Cairo. Closing shift ${activeShift.id} from ${openedCairoDay} and opening new shift for ${currentCairoDay}...`);

      const expectedCash =
        Number(activeShift.opening_balance || 0) +
        Number(activeShift.total_sales_cash || 0) +
        Number(activeShift.total_cash_in || 0) -
        Number(activeShift.total_returns_cash || 0) -
        Number(activeShift.total_cash_out || 0) -
        Number(activeShift.total_expenses || 0);

      // Auto close shift
      await (supabase.rpc as any)('rpc_close_cashier_shift', {
        p_shift_id: activeShift.id,
        p_closing_balance_counted: expectedCash,
        p_notes: `إغلاق وتدوير آلي بمناسبة انتهاء اليوم (12:00 منتصف الليل بتوقيت مصر) - تاريخ ${openedCairoDay}`,
      });

      // Auto open new shift for the new day
      const defaultBranchId = '00000000-0000-0000-0000-000000000001';
      const defaultRegisterId = '00000000-0000-0000-0000-000000000001';

      await (supabase.from('cashier_shifts') as any).insert({
        branch_id: defaultBranchId,
        cash_register_id: defaultRegisterId,
        cashier_id: activeShift.cashier_id || '00000000-0000-0000-0000-000000000001',
        opening_balance: expectedCash,
        status: 'open',
        opened_at: new Date().toISOString(),
        notes: `وردية آلية يوم جديد (${currentCairoDay})`,
      });

      console.log('[ShiftAutoScheduler] Auto-shift rotation completed successfully.');
    }
  } catch (err) {
    console.error('[ShiftAutoScheduler] Error during auto shift check:', err);
  }
};
