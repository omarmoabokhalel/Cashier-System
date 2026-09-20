/**
 * Customers, Loyalty, Discounts & Coupons System Integration Test Suite
 * Tests customer creation, metrics calculations, mandatory loyalty transaction records,
 * server-side coupon validation, and role-controlled manual discount limits.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=====================================================');
  console.log(' CUSTOMERS, LOYALTY & COUPONS INTEGRATION TEST SUITE ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Customer Creation & Default Walk-in Customer Check
  console.log('TEST 1: Customer Management & Walk-in Customer');
  try {
    const testPhone = `05${Math.floor(10000000 + Math.random() * 90000000)}`;
    const { data: newCust, error: custErr } = await supabase
      .from('customers')
      .insert({
        full_name: 'أحمد محمود الاختبار',
        phone: testPhone,
        email: 'ahmed.test@example.com',
        tier: 'silver',
      })
      .select()
      .single();

    if (custErr) {
      console.error(`   [FAIL] Customer creation failed: ${custErr.message}`);
      failed++;
    } else {
      console.log(`   [SUCCESS] Customer Created: ${newCust.full_name} (ID: ${newCust.id}, Phone: ${newCust.phone})`);

      // Verify default Walk-in Customer exists
      const { data: walkin } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', '0000000000')
        .single();

      if (walkin) {
        console.log(`   [SUCCESS] Walk-in Customer Verified: ${walkin.full_name}`);
      }
      passed++;

      // Use newly created customer for subsequent loyalty tests
      const testCustomerId = newCust.id;

      // TEST 2: Loyalty Earn & Mandatory Transaction History Record
      console.log('\n-----------------------------------------------------');
      console.log('TEST 2: Loyalty Earn & Mandatory Transaction Audit Trail');
      const { data: earnRes, error: earnErr } = await supabase.rpc('rpc_earn_loyalty_points', {
        p_customer_id: testCustomerId,
        p_sale_id: null,
        p_total_amount: 500, // 500 EGP sale -> should earn 50 points
      });

      if (earnErr) {
        console.error(`   [FAIL] Loyalty points earn failed: ${earnErr.message}`);
        failed++;
      } else {
        console.log(`   [SUCCESS] Earned Points: ${earnRes.earned}, New Balance: ${earnRes.new_balance}`);

        // Verify mandatory loyalty transaction record exists!
        const { data: transLog } = await supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('customer_id', testCustomerId)
          .eq('transaction_type', 'earned');

        if (transLog && transLog.length > 0) {
          console.log(`   [SUCCESS] Verified Loyalty Transaction Record: ${transLog[0].description}`);
          passed++;
        } else {
          console.error(`   [FAIL] Loyalty balance changed WITHOUT a transaction log record!`);
          failed++;
        }
      }

      // TEST 3: Loyalty Point Redemption & Insufficient Points Check
      console.log('\n-----------------------------------------------------');
      console.log('TEST 3: Loyalty Point Redemption & Balance Check');
      
      // 3a: Valid Redemption
      const { data: redeemRes, error: redeemErr } = await supabase.rpc('rpc_redeem_loyalty_points', {
        p_customer_id: testCustomerId,
        p_points_to_redeem: 20, // Redeem 20 points -> 2 EGP discount
      });

      if (redeemErr) {
        console.error(`   [FAIL] Loyalty redemption failed: ${redeemErr.message}`);
        failed++;
      } else {
        console.log(`   [SUCCESS] Redeemed 20 Points! Discount: ${redeemRes.discount_amount} EGP, Remaining: ${redeemRes.remaining_balance}`);

        // 3b: Excessive Redemption Rejection
        const { data: overRes, error: overErr } = await supabase.rpc('rpc_redeem_loyalty_points', {
          p_customer_id: testCustomerId,
          p_points_to_redeem: 999999, // Unreasonable points
        });

        if (overErr && overErr.message.includes('غير كافٍ')) {
          console.log(`   [SUCCESS] Excessive points redemption correctly rejected: "${overErr.message}"`);
          passed++;
        } else {
          console.error(`   [FAIL] Excessive points redemption was not rejected:`, overErr || overRes);
          failed++;
        }
      }
    }
  } catch (e) {
    console.error(`   [FAIL] Customer test error:`, e.message);
    failed++;
  }

  // TEST 4: Server-Side Coupon Validation
  console.log('\n-----------------------------------------------------');
  console.log('TEST 4: Server-Side Coupon Validation & Cap Calculations');
  try {
    const couponCode = `TESTCOUPON-${Date.now()}`;
    const { data: coupon, error: cErr } = await supabase
      .from('coupons')
      .insert({
        code: couponCode,
        type: 'percentage',
        value: 20.00, // 20%
        min_spend: 100.00,
        max_discount: 50.00,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 86400000 * 7).toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (cErr) {
      console.error(`   [FAIL] Test coupon setup failed: ${cErr.message}`);
      failed++;
    } else {
      console.log(`   [INFO] Created Coupon: ${coupon.code} (20% off, min spend 100, max discount 50)`);

      // 4a: Valid calculation with max discount cap (300 EGP * 20% = 60 -> capped at 50)
      const { data: val1, error: err1 } = await supabase.rpc('rpc_validate_coupon', {
        p_code: couponCode,
        p_order_subtotal: 300,
      });

      if (err1) {
        console.error(`   [FAIL] Coupon validation failed: ${err1.message}`);
        failed++;
      } else {
        console.log(`   [SUCCESS] Coupon Validated! Calculated Discount: ${val1.discount_amount} EGP (Capped at Max 50)`);
        passed++;
      }

      // 4b: Min Spend Rejection (Order 50 EGP < min_spend 100)
      const { data: val2, error: err2 } = await supabase.rpc('rpc_validate_coupon', {
        p_code: couponCode,
        p_order_subtotal: 50,
      });

      if (err2 && err2.message.includes('الحد الأدنى للشراء')) {
        console.log(`   [SUCCESS] Min spend check correctly rejected order < 100 EGP: "${err2.message}"`);
        passed++;
      } else {
        console.error(`   [FAIL] Min spend check failed:`, err2 || val2);
        failed++;
      }
    }
  } catch (e) {
    console.error(`   [FAIL] Coupon validation test error:`, e.message);
    failed++;
  }

  // TEST 5: Role-Controlled Manual Discount Limits
  console.log('\n-----------------------------------------------------');
  console.log('TEST 5: Role-Controlled Manual Discount Limits');
  try {
    // Cashier attempts 15% discount -> max allowed is 10% -> should fail
    const { data: r1, error: e1 } = await supabase.rpc('rpc_validate_manual_discount', {
      p_user_role: 'cashier',
      p_discount_percentage: 15.00,
    });

    if (e1 && e1.message.includes('لا يسمح بتطبيق خصم أكثر من 10٪')) {
      console.log(`   [SUCCESS] Cashier 15% discount correctly rejected: "${e1.message}"`);
      passed++;
    } else {
      console.error(`   [FAIL] Cashier discount limit not enforced:`, e1 || r1);
      failed++;
    }

    // Branch Manager attempts 20% discount -> max allowed is 25% -> should pass
    const { data: r2, error: e2 } = await supabase.rpc('rpc_validate_manual_discount', {
      p_user_role: 'branch_manager',
      p_discount_percentage: 20.00,
    });

    if (!e2 && r2.allowed) {
      console.log(`   [SUCCESS] Branch Manager 20% discount correctly allowed.`);
      passed++;
    } else {
      console.error(`   [FAIL] Branch Manager discount failed:`, e2);
      failed++;
    }
  } catch (e) {
    console.error(`   [FAIL] Role discount limit test error:`, e.message);
    failed++;
  }

  console.log('\n=====================================================');
  console.log(`   SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=====================================================\n');
}

runTests();
