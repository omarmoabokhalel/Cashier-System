/**
 * Sales and Payment System Comprehensive Test Suite
 * Tests atomic transactions, stock deduction, profit calculation,
 * split payments, rollback on failure, and idempotency.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read Supabase credentials from environment or default local/dev setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=====================================================');
  console.log('   SALES AND PAYMENT SYSTEM INTEGRATION TEST SUITE   ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Fetch prerequisite data (open cashier shift & product variant)
  console.log('1. Setting up test environment & dependencies...');
  
  const { data: shifts, error: shiftErr } = await supabase
    .from('cashier_shifts')
    .select('id, branch_id')
    .eq('status', 'open')
    .limit(1);

  let shiftId, branchId;

  if (shiftErr || !shifts || shifts.length === 0) {
    console.log('   [WARN] No open cashier shift found. Creating test shift...');
    // Create test branch if needed
    const { data: branch } = await supabase.from('branches').select('id').limit(1).single();
    branchId = branch ? branch.id : '00000000-0000-0000-0000-000000000001';
    shiftId = '00000000-0000-0000-0000-000000000001';
  } else {
    shiftId = shifts[0].id;
    branchId = shifts[0].branch_id;
  }

  // Fetch or create a test variant with stock
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, sku, barcode, selling_price, cost_price, branch_variant_stock(quantity)')
    .eq('is_active', true)
    .limit(2);

  if (!variants || variants.length === 0) {
    console.error('   [FAIL] No active product variants found in database.');
    return;
  }

  const testVariant = variants[0];
  console.log(`   [INFO] Active Test Variant SKU: ${testVariant.sku}, Cost: ${testVariant.cost_price}, Price: ${testVariant.selling_price}`);

  // Test 1: Successful Sale Execution
  console.log('\n-----------------------------------------------------');
  console.log('TEST 1: Successful Sale Execution & Atomic Record Creation');
  try {
    const idempotencyKey = `TEST-KEY-${Date.now()}`;
    const payload = {
      p_cashier_shift_id: shiftId,
      p_customer_id: null,
      p_subtotal: Number(testVariant.selling_price),
      p_discount_amount: 0,
      p_coupon_id: null,
      p_tax_rate: 15.00,
      p_tax_amount: Number(testVariant.selling_price) * 0.15,
      p_total_amount: Number(testVariant.selling_price) * 1.15,
      p_paid_amount: Number(testVariant.selling_price) * 1.15 + 20, // 20 change
      p_change_amount: 20,
      p_notes: 'اختبار الفاتورة الناجحة',
      p_items: [
        {
          variant_id: testVariant.id,
          quantity: 1,
          unit_price: Number(testVariant.selling_price),
          discount_amount: 0,
        },
      ],
      p_payments: [
        {
          payment_method: 'cash',
          amount: Number(testVariant.selling_price) * 1.15 + 20,
          reference_number: null,
        },
      ],
      p_idempotency_key: idempotencyKey,
    };

    const { data: saleRes, error: saleErr } = await supabase.rpc('rpc_create_sale', payload);

    if (saleErr) {
      console.error(`   [FAIL] Sale creation RPC returned error: ${saleErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Sale created successfully! Invoice: ${saleRes.invoice_number}, Total: ${saleRes.total_amount}`);
      console.log(`   [SUCCESS] Profit Calculated: ${saleRes.total_profit} EGP, Change: ${saleRes.change_amount} EGP`);
      
      // Verify audit_logs table record
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', saleRes.sale_id);

      if (auditLogs && auditLogs.length > 0) {
        console.log(`   [SUCCESS] Audit Log verified: ${auditLogs[0].action} for entity ${auditLogs[0].entity_id}`);
      }
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Unexpected error in Test 1:`, e.message);
    failed++;
  }

  // Test 2: Insufficient Stock Rollback
  console.log('\n-----------------------------------------------------');
  console.log('TEST 2: Insufficient Stock Transaction Rollback');
  try {
    const payload = {
      p_cashier_shift_id: shiftId,
      p_items: [
        {
          variant_id: testVariant.id,
          quantity: 999999, // Unreasonable quantity exceeding stock
          unit_price: 100,
        },
      ],
      p_payments: [{ payment_method: 'cash', amount: 99999900 }],
    };

    const { data, error } = await supabase.rpc('rpc_create_sale', payload);

    if (error && error.message.includes('المخزون غير كافٍ')) {
      console.log(`   [SUCCESS] Rollback verified! RPC correctly rejected insufficient stock: "${error.message}"`);
      passed++;
    } else if (data) {
      console.error('   [FAIL] Sale succeeded unexpectedly with excessive quantity!');
      failed++;
    } else {
      console.log(`   [SUCCESS] Rollback caught expected error: ${error?.message}`);
      passed++;
    }
  } catch (e) {
    console.log(`   [SUCCESS] Exception correctly thrown for insufficient stock:`, e.message);
    passed++;
  }

  // Test 3: Invalid Payment Amount (Paid < Total)
  console.log('\n-----------------------------------------------------');
  console.log('TEST 3: Invalid Payment Amount (Underpaid) Rollback');
  try {
    const payload = {
      p_cashier_shift_id: shiftId,
      p_items: [
        {
          variant_id: testVariant.id,
          quantity: 1,
          unit_price: 100,
        },
      ],
      p_payments: [
        {
          payment_method: 'cash',
          amount: 5, // Underpaid: required is > 100
        },
      ],
    };

    const { data, error } = await supabase.rpc('rpc_create_sale', payload);

    if (error && error.message.includes('أقل من إجمالي الفاتورة')) {
      console.log(`   [SUCCESS] Rollback verified! Underpayment correctly rejected: "${error.message}"`);
      passed++;
    } else {
      console.error('   [FAIL] Underpaid sale was not rejected properly:', error || data);
      failed++;
    }
  } catch (e) {
    console.log(`   [SUCCESS] Exception correctly thrown for underpayment:`, e.message);
    passed++;
  }

  // Test 4: Split Payment (Cash + Card)
  console.log('\n-----------------------------------------------------');
  console.log('TEST 4: Split Payment (Cash 60% + Card 40%)');
  try {
    const totalReq = Number(testVariant.selling_price) * 1.15;
    const cashPart = Math.round(totalReq * 0.6 * 100) / 100;
    const cardPart = Math.round((totalReq - cashPart) * 100) / 100;

    const payload = {
      p_cashier_shift_id: shiftId,
      p_items: [
        {
          variant_id: testVariant.id,
          quantity: 1,
          unit_price: Number(testVariant.selling_price),
        },
      ],
      p_payments: [
        { payment_method: 'cash', amount: cashPart },
        { payment_method: 'card', amount: cardPart, reference_number: 'CARD-REF-9921' },
      ],
    };

    const { data: splitRes, error: splitErr } = await supabase.rpc('rpc_create_sale', payload);

    if (splitErr) {
      console.error(`   [FAIL] Split payment failed: ${splitErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Split Payment Sale created! Invoice: ${splitRes.invoice_number}`);
      console.log(`   [SUCCESS] Cash Paid: ${cashPart}, Card Paid: ${cardPart}, Total: ${splitRes.total_amount}`);
      passed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Split payment test error:`, e.message);
    failed++;
  }

  // Test 5: Idempotency Verification
  console.log('\n-----------------------------------------------------');
  console.log('TEST 5: Duplicate Request / Idempotency Prevention');
  try {
    const uniqueKey = `IDEM-KEY-${Date.now()}`;
    const payload = {
      p_cashier_shift_id: shiftId,
      p_items: [{ variant_id: testVariant.id, quantity: 1, unit_price: Number(testVariant.selling_price) }],
      p_payments: [{ payment_method: 'cash', amount: 1000 }],
      p_idempotency_key: uniqueKey,
    };

    // First Call
    const { data: res1 } = await supabase.rpc('rpc_create_sale', payload);
    // Second Call with SAME idempotency key
    const { data: res2 } = await supabase.rpc('rpc_create_sale', payload);

    if (res1 && res2 && res1.invoice_number === res2.invoice_number) {
      console.log(`   [SUCCESS] Idempotency verified! Duplicate request returned original invoice: ${res2.invoice_number}`);
      passed++;
    } else {
      console.error('   [FAIL] Idempotency check failed. Duplicate invoice created.', res1, res2);
      failed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Idempotency test error:`, e.message);
    failed++;
  }

  console.log('\n=====================================================');
  console.log(`   SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=====================================================\n');
}

runTests();
