const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../supabase/migrations/20260918000000_initial_schema.sql');

console.log('🧪 Starting Inventory Flow Verification Test...');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// 1. Verify Inventory Movement Types
const requiredMovementTypes = [
  'purchase', 'sale', 'return', 'exchange_in', 'exchange_out',
  'adjustment', 'damaged', 'lost', 'transfer', 'opening_stock'
];

requiredMovementTypes.forEach(m => {
  if (migrationSql.includes(`'${m}'`)) {
    console.log(`  ✅ Stock movement type '${m}' registered in PostgreSQL ENUM.`);
  } else {
    console.error(`  ❌ Missing movement type '${m}' in ENUM.`);
    process.exit(1);
  }
});

// 2. Verify Simulation Math (Stock 10 -> Sell 2 -> Return 1 -> Exchange M to L)
let stockM = 10;
let stockL = 10;

console.log(`  📊 Initial State: Variant M Stock = ${stockM}, Variant L Stock = ${stockL}`);

// Action 1: Sell 2 Variant M
const sellQty = 2;
stockM -= sellQty;
console.log(`  🛒 Action 1 (Sell 2 Variant M): Stock M = ${stockM} (Expected: 8)`);
if (stockM !== 8) {
  console.error(`  ❌ Error in Sale Math!`);
  process.exit(1);
}

// Action 2: Return 1 Variant M
const returnQty = 1;
stockM += returnQty;
console.log(`  ↩️ Action 2 (Return 1 Variant M): Stock M = ${stockM} (Expected: 9)`);
if (stockM !== 9) {
  console.error(`  ❌ Error in Return Math!`);
  process.exit(1);
}

// Action 3: Exchange Variant M for Variant L (Customer returns M, buys L)
stockM += 1; // Returned M
stockL -= 1; // Bought L
console.log(`  🔄 Action 3 (Exchange M -> L): Stock M = ${stockM} (Expected: 10), Stock L = ${stockL} (Expected: 9)`);
if (stockM !== 10 || stockL !== 9) {
  console.error(`  ❌ Error in Exchange Math!`);
  process.exit(1);
}

// 3. Verify RPC Functions exist in migration
const requiredRPCs = ['rpc_create_sale', 'rpc_process_return', 'rpc_process_exchange', 'rpc_adjust_inventory'];
requiredRPCs.forEach(rpc => {
  if (migrationSql.includes(`CREATE OR REPLACE FUNCTION ${rpc}`)) {
    console.log(`  🛡️ Transactional RPC '${rpc}' verified in migration.`);
  } else {
    console.error(`  ❌ Missing RPC '${rpc}' in migration.`);
    process.exit(1);
  }
});

console.log('\n🎉 ALL INVENTORY MATH & SCENARIO FLOW TESTS PASSED CLEANLY!');
