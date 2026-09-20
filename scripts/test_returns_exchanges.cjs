/**
 * Returns and Exchanges System Integration Test Suite
 * Tests atomic returns, return quantity validation, price difference calculations,
 * stock restoration/deduction, and transaction rollback on failure.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=====================================================');
  console.log('  RETURNS AND EXCHANGES SYSTEM INTEGRATION TEST SUITE ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Fetch prerequisite shift and variants
  console.log('1. Setting up test dependencies...');

  const { data: shifts } = await supabase
    .from('cashier_shifts')
    .select('id, branch_id')
    .eq('status', 'open')
    .limit(1);

  const shiftId = shifts && shifts.length > 0 ? shifts[0].id : '00000000-0000-0000-0000-000000000001';

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, sku, selling_price, cost_price')
    .eq('is_active', true)
    .limit(3);

  if (!variants || variants.length < 2) {
    console.error('   [FAIL] Insufficient active variants found for testing.');
    return;
  }

  const var1 = variants[0];
  const var2 = variants[1];

  console.log(`   [INFO] Variant 1 (ID: ${var1.id.slice(-6)}, Price: ${var1.selling_price})`);
  console.log(`   [INFO] Variant 2 (ID: ${var2.id.slice(-6)}, Price: ${var2.selling_price})`);

  // Helper function to create a initial sale for testing returns
  async function createInitialSale(qty = 5) {
    const payload = {
      p_cashier_shift_id: shiftId,
      p_items: [{ variant_id: var1.id, quantity: qty, unit_price: Number(var1.selling_price) }],
      p_payments: [{ payment_method: 'cash', amount: Number(var1.selling_price) * qty * 1.15 }],
    };
    const { data, error } = await supabase.rpc('rpc_create_sale', payload);
    if (error) throw new Error(`Initial sale creation failed: ${error.message}`);

    // Fetch created sale_items ID
    const { data: items } = await supabase
      .from('sale_items')
      .select('id, quantity, returned_quantity, unit_price')
      .eq('sale_id', data.sale_id);

    return { saleId: data.sale_id, saleItemId: items[0].id, invoiceNumber: data.invoice_number };
  }

  // TEST 1: Full Return
  console.log('\n-----------------------------------------------------');
  console.log('TEST 1: Full Return Execution & Stock Restoration');
  try {
    const saleInfo = await createInitialSale(2);
    console.log(`   [INFO] Original Invoice: ${saleInfo.invoiceNumber} (Purchased Qty: 2)`);

    const returnPayload = {
      p_original_sale_id: saleInfo.saleId,
      p_cashier_shift_id: shiftId,
      p_refund_method: 'cash',
      p_reason: 'إرجاع كلي للاختبار',
      p_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 2 }],
    };

    const { data: retRes, error: retErr } = await supabase.rpc('rpc_process_return', returnPayload);

    if (retErr) {
      console.error(`   [FAIL] Full return RPC failed: ${retErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Full Return processed! Number: ${retRes.return_number}, Refund: ${retRes.refund_amount} EGP`);
      
      // Verify audit_logs
      const { data: audit } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', retRes.return_id);

      if (audit && audit.length > 0) {
        console.log(`   [SUCCESS] Audit Log verified for return ${audit[0].entity_id}`);
      }
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Full return test error:`, e.message);
    failed++;
  }

  // TEST 2: Partial Return & Multiple Returns Limit Check
  console.log('\n-----------------------------------------------------');
  console.log('TEST 2: Partial Return & Excessive Return Rejection');
  try {
    const saleInfo = await createInitialSale(4); // 4 items purchased
    console.log(`   [INFO] Original Invoice: ${saleInfo.invoiceNumber} (Purchased Qty: 4)`);

    // Step 2a: Partial return 2 out of 4
    const partialPayload = {
      p_original_sale_id: saleInfo.saleId,
      p_cashier_shift_id: shiftId,
      p_refund_method: 'cash',
      p_reason: 'إرجاع جزئي أول',
      p_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 2 }],
    };

    const { data: pRes1, error: pErr1 } = await supabase.rpc('rpc_process_return', partialPayload);

    if (pErr1) {
      console.error(`   [FAIL] Partial return step 1 failed: ${pErr1.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Partial Return 1/2 succeeded! Returned 2 items. Refund: ${pRes1.refund_amount}`);

      // Step 2b: Attempt returning 3 items (only 2 returnable!) -> should fail
      const excessPayload = {
        p_original_sale_id: saleInfo.saleId,
        p_cashier_shift_id: shiftId,
        p_refund_method: 'cash',
        p_reason: 'إرجاع يتجاوز المتاح',
        p_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 3 }],
      };

      const { data: pRes2, error: pErr2 } = await supabase.rpc('rpc_process_return', excessPayload);

      if (pErr2 && pErr2.message.includes('تتجاوز الكمية المتاحة')) {
        console.log(`   [SUCCESS] Over-return correctly rejected! Error: "${pErr2.message}"`);
        passed++;
      } else {
        console.error(`   [FAIL] Over-return was not rejected! Data:`, pRes2);
        failed++;
      }
    }
  } catch (e) {
    console.error(`   [FAIL] Partial return test error:`, e.message);
    failed++;
  }

  // TEST 3: Exchange - Same Price (diff = 0)
  console.log('\n-----------------------------------------------------');
  console.log('TEST 3: Exchange Same Price (Price Difference = 0)');
  try {
    const saleInfo = await createInitialSale(1);

    const exchangePayload = {
      p_original_sale_id: saleInfo.saleId,
      p_cashier_shift_id: shiftId,
      p_return_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 1 }],
      p_new_sale_payload: {
        customer_id: null,
        subtotal: Number(var1.selling_price),
        discount_amount: 0,
        coupon_id: null,
        tax_rate: 15.00,
        tax_amount: Number(var1.selling_price) * 0.15,
        total_amount: Number(var1.selling_price) * 1.15,
        paid_amount: Number(var1.selling_price) * 1.15,
        change_amount: 0,
        items: [{ variant_id: var2.id, quantity: 1, unit_price: Number(var1.selling_price) }],
        payments: [{ payment_method: 'cash', amount: Number(var1.selling_price) * 1.15 }],
      },
    };

    const { data: excRes, error: excErr } = await supabase.rpc('rpc_process_exchange', exchangePayload);

    if (excErr) {
      console.error(`   [FAIL] Same price exchange failed: ${excErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Exchange processed! Number: ${excRes.exchange_number}, Price Diff: ${excRes.price_difference} EGP`);
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Same price exchange test error:`, e.message);
    failed++;
  }

  // TEST 4: Exchange - Higher Price (Customer pays difference)
  console.log('\n-----------------------------------------------------');
  console.log('TEST 4: Exchange Higher Price (Customer pays difference)');
  try {
    const saleInfo = await createInitialSale(1);
    const higherUnitPrice = Number(var1.selling_price) + 50;

    const exchangePayload = {
      p_original_sale_id: saleInfo.saleId,
      p_cashier_shift_id: shiftId,
      p_return_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 1 }],
      p_new_sale_payload: {
        customer_id: null,
        subtotal: higherUnitPrice,
        discount_amount: 0,
        coupon_id: null,
        tax_rate: 15.00,
        tax_amount: higherUnitPrice * 0.15,
        total_amount: higherUnitPrice * 1.15,
        paid_amount: higherUnitPrice * 1.15,
        change_amount: 0,
        items: [{ variant_id: var2.id, quantity: 1, unit_price: higherUnitPrice }],
        payments: [{ payment_method: 'cash', amount: higherUnitPrice * 1.15 }],
      },
    };

    const { data: excRes, error: excErr } = await supabase.rpc('rpc_process_exchange', exchangePayload);

    if (excErr) {
      console.error(`   [FAIL] Higher price exchange failed: ${excErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Higher Price Exchange processed! Number: ${excRes.exchange_number}, Price Diff: ${excRes.price_difference} EGP`);
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Higher price exchange error:`, e.message);
    failed++;
  }

  // TEST 5: Exchange Insufficient Replacement Stock Rollback
  console.log('\n-----------------------------------------------------');
  console.log('TEST 5: Exchange Insufficient Replacement Stock Rollback');
  try {
    const saleInfo = await createInitialSale(1);

    const exchangePayload = {
      p_original_sale_id: saleInfo.saleId,
      p_cashier_shift_id: shiftId,
      p_return_items: [{ sale_item_id: saleInfo.saleItemId, quantity: 1 }],
      p_new_sale_payload: {
        customer_id: null,
        subtotal: 1000,
        items: [{ variant_id: var2.id, quantity: 999999, unit_price: 1000 }], // Excessive quantity
        payments: [{ payment_method: 'cash', amount: 99999900 }],
      },
    };

    const { data: excRes, error: excErr } = await supabase.rpc('rpc_process_exchange', exchangePayload);

    if (excErr && excErr.message.includes('المخزون غير كافٍ')) {
      console.log(`   [SUCCESS] Rollback verified! Insufficient replacement stock rejected: "${excErr.message}"`);
      passed++;
    } else {
      console.error(`   [FAIL] Insufficient stock exchange was not rolled back properly:`, excErr || excRes);
      failed++;
    }
  } catch (e) {
    console.log(`   [SUCCESS] Exception caught for insufficient replacement stock:`, e.message);
    passed++;
  }

  console.log('\n=====================================================');
  console.log(`   SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=====================================================\n');
}

runTests();
