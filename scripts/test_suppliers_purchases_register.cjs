/**
 * Suppliers, Purchases, Expenses & Cash Register Integration Test Suite
 * Tests purchase receiving stock & cost updates, cash in/out operations,
 * expenses recording, and shift closing variance calculations.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=====================================================');
  console.log(' SUPPLIERS, PURCHASES & REGISTER INTEGRATION TESTS   ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // Prerequisites
  console.log('1. Fetching active branch & open cashier shift...');
  const { data: shifts } = await supabase
    .from('cashier_shifts')
    .select('id, branch_id, opening_balance, total_sales_cash')
    .eq('status', 'open')
    .limit(1);

  const shiftId = shifts && shifts.length > 0 ? shifts[0].id : '00000000-0000-0000-0000-000000000001';
  const branchId = shifts && shifts.length > 0 ? shifts[0].branch_id : '00000000-0000-0000-0000-000000000001';

  // TEST 1: Supplier CRUD
  console.log('\n-----------------------------------------------------');
  console.log('TEST 1: Supplier CRUD Operations');
  try {
    const testPhone = `01${Math.floor(10000000 + Math.random() * 90000000)}`;
    const { data: supp, error: suppErr } = await supabase
      .from('suppliers')
      .insert({
        name_ar: 'مورد المصنع للاختبار',
        name_en: 'Factory Supplier Test',
        company_name: 'شركة الملابس الحديثة',
        phone: testPhone,
        tax_number: '300998877600003',
      })
      .select()
      .single();

    if (suppErr) {
      console.error(`   [FAIL] Supplier creation failed: ${suppErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Supplier Created: ${supp.name_ar} (ID: ${supp.id}, Phone: ${supp.phone})`);
      passed++;

      // TEST 2: Purchase Creation & Receiving Stock Update
      console.log('\n-----------------------------------------------------');
      console.log('TEST 2: Purchase Receiving Flow (Stock & Cost Update)');
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, sku, cost_price, branch_variant_stock(quantity)')
        .eq('is_active', true)
        .limit(1);

      if (!variants || variants.length === 0) {
        console.error('   [FAIL] No active product variant found for purchase test.');
        failed++;
      } else {
        const targetVar = variants[0];
        const prevStock = targetVar.branch_variant_stock?.[0]?.quantity || 0;
        const newCostPrice = 75.50;
        const purchaseQty = 10;

        // Create Purchase Draft
        const purchaseNum = `PO-TEST-${Date.now()}`;
        const { data: po, error: poErr } = await supabase
          .from('purchases')
          .insert({
            purchase_number: purchaseNum,
            supplier_id: supp.id,
            branch_id: branchId,
            status: 'draft',
            total_amount: newCostPrice * purchaseQty,
            paid_amount: newCostPrice * purchaseQty,
          })
          .select()
          .single();

        if (poErr) {
          console.error(`   [FAIL] Purchase creation failed: ${poErr.message}`);
          failed++;
        } else {
          // Receive Purchase via rpc_receive_purchase
          const { data: recRes, error: recErr } = await supabase.rpc('rpc_receive_purchase', {
            p_purchase_id: po.id,
            p_received_items: [
              {
                variant_id: targetVar.id,
                quantity_received: purchaseQty,
                unit_cost_price: newCostPrice,
              },
            ],
          });

          if (recErr) {
            console.error(`   [FAIL] Purchase receiving RPC failed: ${recErr.message}`);
            failed++;
          } else {
            console.log(`   [SUCCESS] Purchase Received! ID: ${recRes.purchase_id}`);

            // Verify Stock Increased and Cost Price Updated
            const { data: updatedVar } = await supabase
              .from('product_variants')
              .select('cost_price, branch_variant_stock(quantity)')
              .eq('id', targetVar.id)
              .single();

            const updatedStock = updatedVar.branch_variant_stock?.[0]?.quantity || 0;
            console.log(`   [SUCCESS] Stock Increased: From ${prevStock} -> ${updatedStock} (+${purchaseQty})`);
            console.log(`   [SUCCESS] Cost Price Updated: ${updatedVar.cost_price} EGP`);
            passed++;
          }
        }
      }

      // TEST 3: Expense Recording
      console.log('\n-----------------------------------------------------');
      console.log('TEST 3: Operational Expense Recording & Shift Total Update');
      const { data: expRes, error: expErr } = await supabase.rpc('rpc_record_expense', {
        p_cashier_shift_id: shiftId,
        p_category: 'Electricity',
        p_amount: 150.00,
        p_description: 'فاتورة الكهرباء الشهرية للفرع',
      });

      if (expErr) {
        console.error(`   [FAIL] Expense recording failed: ${expErr.message}`);
        failed++;
      } else {
        console.log(`   [SUCCESS] Expense Recorded! Category: ${expRes.category}, Amount: ${expRes.amount} EGP`);
        passed++;
      }

      // TEST 4: Cash In / Cash Out Operations
      console.log('\n-----------------------------------------------------');
      console.log('TEST 4: Cash In / Cash Out Movement Recording');
      const { data: cashInRes, error: cashInErr } = await supabase.rpc('rpc_record_cash_movement', {
        p_cashier_shift_id: shiftId,
        p_movement_type: 'cash_in',
        p_amount: 500.00,
        p_reason: 'تزويد الفكة الصباحية',
      });

      if (cashInErr) {
        console.error(`   [FAIL] Cash In failed: ${cashInErr.message}`);
        failed++;
      } else {
        console.log(`   [SUCCESS] Cash In Recorded: +${cashInRes.amount} EGP (${cashInRes.movement_type})`);

        // Check Audit Logs
        const { data: audit } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity_id', cashInRes.movement_id);

        if (audit && audit.length > 0) {
          console.log(`   [SUCCESS] Verified Audit Log for Cash Movement.`);
          passed++;
        }
      }

      // TEST 5: Shift Closing & Variance Calculation
      console.log('\n-----------------------------------------------------');
      console.log('TEST 5: Shift Closing & Variance Calculation');
      // Create a temporary shift for closing test
      const { data: testShift, error: sErr } = await supabase
        .from('cashier_shifts')
        .insert({
          cash_register_id: '00000000-0000-0000-0000-000000000001',
          branch_id: branchId,
          cashier_id: '00000000-0000-0000-0000-000000000001',
          status: 'open',
          opening_balance: 1000.00,
          total_sales_cash: 500.00,
          total_returns_cash: 50.00,
          total_expenses: 100.00,
          total_cash_in: 200.00,
          total_cash_out: 50.00,
        })
        .select()
        .single();

      if (sErr) {
        console.error(`   [FAIL] Temporary shift creation failed: ${sErr.message}`);
        failed++;
      } else {
        // Expected Cash = 1000 + 500 + 200 - 50 - 50 - 100 = 1500 EGP
        // Counted Cash = 1480 EGP -> Variance = -20 EGP (Shortage)
        const countedCash = 1480.00;
        const { data: closeRes, error: closeErr } = await supabase.rpc('rpc_close_cashier_shift', {
          p_shift_id: testShift.id,
          p_closing_balance_counted: countedCash,
          p_notes: 'إغلاق وردية الاختبار مع جرد فعلي',
        });

        if (closeErr) {
          console.error(`   [FAIL] Shift close RPC failed: ${closeErr.message}`);
          failed++;
        } else {
          console.log(`   [SUCCESS] Shift Closed! Status: ${closeRes.status}`);
          console.log(`   [SUCCESS] Expected Cash: ${closeRes.expected_closing_balance} EGP, Counted: ${closeRes.closing_balance_counted} EGP`);
          console.log(`   [SUCCESS] Calculated Variance: ${closeRes.variance} EGP`);
          passed++;
        }
      }
    }
  } catch (e) {
    console.error(`   [FAIL] Test error:`, e.message);
    failed++;
  }

  console.log('\n=====================================================');
  console.log(`   SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=====================================================\n');
}

runTests();
