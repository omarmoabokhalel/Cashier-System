const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../supabase/migrations/20260918000000_initial_schema.sql');
const seedPath = path.join(__dirname, '../supabase/seed.sql');

console.log('Reading migration file...');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');
console.log(`Migration size: ${migrationContent.length} bytes`);

console.log('Reading seed file...');
const seedContent = fs.readFileSync(seedPath, 'utf8');
console.log(`Seed size: ${seedContent.length} bytes`);

// Validate key required tables exist in migration
const requiredTables = [
  'branches', 'roles', 'permissions', 'role_permissions', 'profiles',
  'categories', 'brands', 'sizes', 'colors', 'products', 'product_variants',
  'branch_variant_stock', 'inventory_movements', 'stock_adjustments', 'stock_adjustment_items',
  'customers', 'suppliers', 'cash_registers', 'cashier_shifts',
  'sales', 'sale_items', 'payments', 'returns', 'return_items', 'exchanges', 'exchange_items',
  'purchases', 'purchase_items', 'cash_movements', 'expenses',
  'loyalty_accounts', 'loyalty_transactions', 'coupons', 'discounts',
  'notifications', 'audit_logs', 'settings', 'app_config'
];

let missingTables = [];
requiredTables.forEach(table => {
  const pattern = new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\b`, 'i');
  if (!pattern.test(migrationContent)) {
    missingTables.push(table);
  }
});

if (missingTables.length > 0) {
  console.error('❌ Missing tables:', missingTables);
  process.exit(1);
} else {
  console.log(`✅ All ${requiredTables.length} required database tables are present in migration.`);
}

// Validate required RPC functions exist
const requiredRPCs = [
  'rpc_create_sale',
  'rpc_process_return',
  'rpc_process_exchange',
  'rpc_receive_purchase',
  'rpc_adjust_inventory',
  'rpc_close_cashier_shift'
];

let missingRPCs = [];
requiredRPCs.forEach(rpc => {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION ${rpc}\\b`, 'i');
  if (!pattern.test(migrationContent)) {
    missingRPCs.push(rpc);
  }
});

if (missingRPCs.length > 0) {
  console.error('❌ Missing RPC functions:', missingRPCs);
  process.exit(1);
} else {
  console.log(`✅ All ${requiredRPCs.length} required RPC transactional functions are present.`);
}

console.log('🎉 Schema validation check passed cleanly!');
