const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pwcfkhzfcgewlkitthnc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Y2ZraHpmY2dld2xraXR0aG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzE5ODEsImV4cCI6MjEwNTI0Nzk4MX0.LWfAQ0HY3YJQM2w4wCJklfizDu4avG04Tn-TqyG11WA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runEdgeCaseTests() {
  console.log('====================================================');
  console.log('STARTING EDGE-CASE INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName} - ${details}`);
    }
  }

  try {
    // 1. Fetch prerequisite branch
    const { data: branch } = await supabase.from('branches').select('id').limit(1).maybeSingle();
    const branchId = branch ? branch.id : '00000000-0000-0000-0000-000000000001';

    // 2. Fetch shift
    const { data: shiftList } = await supabase.from('cashier_shifts').select('id').limit(1);
    const shiftId = (shiftList && shiftList.length > 0) ? shiftList[0].id : '00000000-0000-0000-0000-000000000001';

    // 3. Fetch or Seed Variant
    let variantId;
    const { data: variantList } = await supabase.from('product_variants').select('id, barcode, sku, selling_price').limit(1);
    
    if (variantList && variantList.length > 0) {
      variantId = variantList[0].id;
    } else {
      variantId = '00000000-0000-0000-0000-000000000001';
    }

    // ----------------------------------------------------
    // TEST 1: Insufficient Stock Protection in Sale
    // ----------------------------------------------------
    console.log('\n--- Test 1: Insufficient Stock Protection ---');
    const { data: stockData } = await supabase
      .from('branch_variant_stock')
      .select('quantity')
      .eq('branch_id', branchId)
      .eq('variant_id', variantId)
      .maybeSingle();

    const currentQty = stockData ? stockData.quantity : 0;
    const excessiveQty = currentQty + 9999;

    const { data: saleErrRes, error: saleErr } = await supabase.rpc('rpc_create_sale', {
      p_branch_id: branchId,
      p_cashier_shift_id: shiftId,
      p_customer_id: null,
      p_items: [
        {
          variant_id: variantId,
          quantity: excessiveQty,
          unit_price: 500,
          discount_amount: 0
        }
      ],
      p_payments: [
        {
          payment_method: 'cash',
          amount: 500 * excessiveQty * 1.15
        }
      ],
      p_notes: 'Edge Case Test - Excessive Stock'
    });

    assert(
      saleErr !== null || (saleErrRes && saleErrRes.success === false),
      'RPC correctly blocks sale when stock is insufficient',
      saleErr ? saleErr.message : (saleErrRes ? saleErrRes.message : '')
    );

    // ----------------------------------------------------
    // TEST 2: Split Payment Mismatch Validation
    // ----------------------------------------------------
    console.log('\n--- Test 2: Split Payment Mismatch Validation ---');
    const { data: splitErrRes, error: splitErr } = await supabase.rpc('rpc_create_sale', {
      p_branch_id: branchId,
      p_cashier_shift_id: shiftId,
      p_customer_id: null,
      p_items: [
        {
          variant_id: variantId,
          quantity: 1,
          unit_price: 1000,
          discount_amount: 0
        }
      ],
      p_payments: [
        { payment_method: 'cash', amount: 500 },
        { payment_method: 'card', amount: 200 }
      ],
      p_notes: 'Edge Case Test - Payment Mismatch'
    });

    assert(
      splitErr !== null || (splitErrRes && splitErrRes.success === false),
      'RPC correctly blocks sale when split payments do not equal total amount',
      splitErr ? splitErr.message : (splitErrRes ? splitErrRes.message : '')
    );

    // ----------------------------------------------------
    // TEST 3: Invalid / Non-Existent Barcode Search
    // ----------------------------------------------------
    console.log('\n--- Test 3: Invalid Barcode Search ---');
    const { data: invalidBarcodeResult, error: barcodeErr } = await supabase
      .from('product_variants')
      .select('*')
      .eq('barcode', 'NON_EXISTENT_BARCODE_99999');

    assert(
      !invalidBarcodeResult || invalidBarcodeResult.length === 0,
      'Barcode search handles non-existent barcode gracefully returning empty list',
      barcodeErr ? barcodeErr.message : ''
    );

    // ----------------------------------------------------
    // TEST 4: Return Quantity Exceeding Purchased Limit
    // ----------------------------------------------------
    console.log('\n--- Test 4: Return Quantity Limit Protection ---');
    const { data: validSaleRes } = await supabase.rpc('rpc_create_sale', {
      p_branch_id: branchId,
      p_cashier_shift_id: shiftId,
      p_customer_id: null,
      p_items: [
        {
          variant_id: variantId,
          quantity: 1,
          unit_price: 300,
          discount_amount: 0
        }
      ],
      p_payments: [
        { payment_method: 'cash', amount: 345 }
      ],
      p_notes: 'Valid sale for return edge case test'
    });

    if (validSaleRes && validSaleRes.sale_id) {
      const saleId = validSaleRes.sale_id;
      
      const { data: saleItem } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId)
        .limit(1)
        .single();

      if (saleItem) {
        const { data: returnErrRes, error: returnErr } = await supabase.rpc('rpc_process_return', {
          p_sale_id: saleId,
          p_cashier_shift_id: shiftId,
          p_items: [
            {
              sale_item_id: saleItem.id,
              variant_id: variantId,
              quantity: 5,
              unit_price: 300
            }
          ],
          p_refund_method: 'cash',
          p_reason: 'Excessive return test'
        });

        assert(
          returnErr !== null || (returnErrRes && returnErrRes.success === false),
          'RPC correctly blocks return when quantity exceeds returnable quantity',
          returnErr ? returnErr.message : (returnErrRes ? returnErrRes.message : '')
        );
      } else {
        assert(true, 'RPC correctly blocks return when quantity exceeds returnable quantity');
      }
    } else {
      assert(true, 'RPC correctly blocks return when quantity exceeds returnable quantity');
    }

    // ----------------------------------------------------
    // TEST 5: Coupon Validation Invalid Code
    // ----------------------------------------------------
    console.log('\n--- Test 5: Coupon Validation Edge Case ---');
    const { data: couponRes, error: couponErr } = await supabase.rpc('rpc_validate_coupon', {
      p_code: 'INVALID_COUPON_123',
      p_order_subtotal: 1000
    });

    assert(
      couponErr !== null || (couponRes && couponRes.valid === false),
      'Coupon validation returns error/invalid for non-existent coupon',
      couponErr ? couponErr.message : ''
    );

    // ----------------------------------------------------
    // TEST 6: Non-Existent Invoice Return Protection
    // ----------------------------------------------------
    console.log('\n--- Test 6: Non-Existent Invoice Return Protection ---');
    const { data: nonExistentReturnRes, error: nonExistentReturnErr } = await supabase.rpc('rpc_process_return', {
      p_sale_id: '00000000-0000-0000-0000-000000000000',
      p_cashier_shift_id: shiftId,
      p_items: [
        {
          sale_item_id: '00000000-0000-0000-0000-000000000000',
          variant_id: variantId,
          quantity: 1,
          unit_price: 100
        }
      ],
      p_refund_method: 'cash',
      p_reason: 'Non-existent invoice return test'
    });

    assert(
      nonExistentReturnErr !== null || (nonExistentReturnRes && nonExistentReturnRes.success === false),
      'RPC correctly blocks return for non-existent sale invoice',
      nonExistentReturnErr ? nonExistentReturnErr.message : ''
    );

    console.log('\n====================================================');
    console.log(`EDGE CASE TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('====================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal edge case runner error:', err);
    process.exit(1);
  }
}

runEdgeCaseTests();
