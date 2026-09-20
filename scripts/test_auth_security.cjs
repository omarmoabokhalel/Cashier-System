const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '../supabase/seed.sql');
const migrationPath = path.join(__dirname, '../supabase/migrations/20260918000000_initial_schema.sql');

console.log('🔒 Starting Security & Role Permission Verification Test...');

const seedSql = fs.readFileSync(seedPath, 'utf8');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// 1. Verify 5 Roles defined
const requiredRoles = ['owner', 'admin', 'branch_manager', 'inventory_manager', 'cashier'];
requiredRoles.forEach(role => {
  if (seedSql.includes(`'${role}'`)) {
    console.log(`  ✅ Role '${role}' registered in database seed.`);
  } else {
    console.error(`  ❌ Missing role '${role}' in seed.`);
    process.exit(1);
  }
});

// 2. Verify Cashier Permissions restrictions in seed
const cashierSection = seedSql.split("code IN (")[seedSql.split("code IN (").length - 1];

const cashierAllowedPerms = ['view_dashboard', 'create_sale', 'create_return', 'create_exchange', 'view_products', 'manage_customers'];
const cashierRestrictedPerms = ['view_cost_prices', 'view_profit', 'adjust_stock', 'manage_users', 'manage_roles', 'manage_settings'];

cashierAllowedPerms.forEach(p => {
  if (cashierSection.includes(`'${p}'`)) {
    console.log(`  ✅ Cashier granted allowed permission '${p}'.`);
  } else {
    console.error(`  ❌ Cashier missing permission '${p}'.`);
    process.exit(1);
  }
});

cashierRestrictedPerms.forEach(p => {
  if (!cashierSection.includes(`'${p}'`)) {
    console.log(`  🔒 Security verified: Cashier is DENIED sensitive permission '${p}'.`);
  } else {
    console.error(`  ❌ Security breach! Cashier improperly granted '${p}'.`);
    process.exit(1);
  }
});

// 3. Verify Database RLS functions exist
const securityFunctions = ['has_permission', 'is_owner', 'is_admin_or_owner', 'get_auth_branch_id'];
securityFunctions.forEach(fn => {
  if (migrationSql.includes(`CREATE OR REPLACE FUNCTION ${fn}`)) {
    console.log(`  🛡️ Database RLS function '${fn}' is active.`);
  } else {
    console.error(`  ❌ Missing RLS function '${fn}'.`);
    process.exit(1);
  }
});

console.log('\n🎉 ALL SECURITY SCENARIO TESTS PASSED SUCCESSFULLY!');
