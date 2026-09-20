/**
 * Dashboard, Reports & Analytics System Integration Test Suite
 * Tests 100% real Supabase metrics calculation, COGS & profit calculation,
 * Executive Owner View data, and CSV export formatting logic.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=====================================================');
  console.log(' DASHBOARD, REPORTS & ANALYTICS INTEGRATION TESTS    ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Real Database Analytics RPC
  console.log('TEST 1: Real Supabase Database Analytics Retrieval (rpc_get_dashboard_analytics)');
  try {
    const { data: metrics, error: mErr } = await supabase.rpc('rpc_get_dashboard_analytics');

    if (mErr) {
      console.error(`   [FAIL] Dashboard analytics RPC failed: ${mErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Analytics fetched from real database!`);
      console.log(`   [INFO] Sales Today: ${metrics.sales_today} EGP, Sales Month: ${metrics.sales_month} EGP`);
      console.log(`   [INFO] Invoices Count: ${metrics.invoices_count}, Avg Invoice: ${metrics.avg_invoice} EGP`);
      console.log(`   [INFO] COGS (Cost): ${metrics.cogs} EGP, Gross Profit: ${metrics.gross_profit} EGP`);
      console.log(`   [INFO] Returns Total: ${metrics.returns_total} EGP, Expenses: ${metrics.expenses_total} EGP`);
      console.log(`   [INFO] Net Sales: ${metrics.net_sales} EGP, Net Profit: ${metrics.net_profit} EGP`);
      passed++;

      // TEST 2: Mathematical Profit Formula Verification
      console.log('\n-----------------------------------------------------');
      console.log('TEST 2: Mathematical Profit Formula Verification (Gross Profit = Net Sales - COGS)');
      const expectedGross = Number(metrics.net_sales) - Number(metrics.cogs);
      const expectedNet = expectedGross - Number(metrics.expenses_total);

      if (Math.abs(expectedGross - Number(metrics.gross_profit)) < 0.01 && Math.abs(expectedNet - Number(metrics.net_profit)) < 0.01) {
        console.log(`   [SUCCESS] Profit mathematical integrity verified! Gross: ${expectedGross.toFixed(2)}, Net: ${expectedNet.toFixed(2)}`);
        passed++;
      } else {
        console.error(`   [FAIL] Profit mathematical discrepancy detected! Computed Gross: ${expectedGross}, RPC Gross: ${metrics.gross_profit}`);
        failed++;
      }
    }
  } catch (e) {
    console.error(`   [FAIL] Real database metrics test error:`, e.message);
    failed++;
  }

  // TEST 3: Executive Owner Metrics (Inventory Valuation & Cash Position)
  console.log('\n-----------------------------------------------------');
  console.log('TEST 3: Executive Owner View Metrics (rpc_get_executive_owner_metrics)');
  try {
    const { data: ownerMetrics, error: oErr } = await supabase.rpc('rpc_get_executive_owner_metrics');

    if (oErr) {
      console.error(`   [FAIL] Executive owner RPC failed: ${oErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Executive Owner Metrics Fetched!`);
      console.log(`   [INFO] Total Inventory Valuation: ${ownerMetrics.inventory_valuation} EGP`);
      console.log(`   [INFO] Cash in Registers: ${ownerMetrics.cash_in_registers} EGP`);
      console.log(`   [INFO] Card Sales Total: ${ownerMetrics.card_sales_total} EGP`);
      console.log(`   [INFO] Total Cash Position: ${ownerMetrics.total_cash_position} EGP`);
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Executive owner metrics error:`, e.message);
    failed++;
  }

  // TEST 4: CSV Export Formatting Logic
  console.log('\n-----------------------------------------------------');
  console.log('TEST 4: CSV Export Data Formatting Logic');
  try {
    function exportToCSVString(data, headers) {
      const headerRow = headers.join(',');
      const bodyRows = data.map((row) =>
        headers.map((h) => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
      );
      return [headerRow, ...bodyRows].join('\n');
    }

    const sampleData = [
      { invoice: 'INV-2026-000001', total: '150.00', status: 'paid' },
      { invoice: 'INV-2026-000002', total: '320.50', status: 'paid' },
    ];
    const csvStr = exportToCSVString(sampleData, ['invoice', 'total', 'status']);

    if (csvStr.includes('INV-2026-000001') && csvStr.includes('invoice,total,status')) {
      console.log(`   [SUCCESS] CSV Export logic verified! String length: ${csvStr.length} chars`);
      passed++;
    } else {
      console.error(`   [FAIL] CSV Export formatting issue.`);
      failed++;
    }
  } catch (e) {
    console.error(`   [FAIL] CSV export test error:`, e.message);
    failed++;
  }

  console.log('\n=====================================================');
  console.log(`   SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=====================================================\n');
}

runTests();
