const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pwcfkhzfcgewlkitthnc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Y2ZraHpmY2dld2xraXR0aG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzE5ODEsImV4cCI6MjEwNTI0Nzk4MX0.LWfAQ0HY3YJQM2w4wCJklfizDu4avG04Tn-TqyG11WA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('====================================================');
  console.log('SEEDING DEMO DATA INTO SUPABASE DATABASE');
  console.log('====================================================\n');

  try {
    // 1. Seed Main Branch
    console.log('1. Seeding Main Branch...');
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .upsert({
        code: 'MAIN',
        name_ar: 'الفرع الرئيسي - القاهرة',
        name_en: 'Main Branch - Cairo',
        phone: '01000000000',
        address: 'شارع التحرير، وسط البلد، القاهرة',
        tax_number: '123-456-789',
        receipt_header: 'متجر الملابس العصرية - أحدث الصيحات',
        receipt_footer: 'شكراً لتسوقكم معنا! الاستبدال خلال 14 يوماً مع إحضار الفاتورة.',
        is_active: true
      }, { onConflict: 'code' })
      .select('id')
      .single();

    if (branchErr) console.error('Branch Seed Warning:', branchErr.message);
    const branchId = branch ? branch.id : '00000000-0000-0000-0000-000000000001';

    // 2. Seed System Roles
    console.log('2. Seeding System Roles...');
    const rolesData = [
      { code: 'owner', name_ar: 'المالك / المدير العام', name_en: 'Owner', is_system: true },
      { code: 'admin', name_ar: 'مدير النظام', name_en: 'System Admin', is_system: true },
      { code: 'branch_manager', name_ar: 'مدير الفرع', name_en: 'Branch Manager', is_system: true },
      { code: 'cashier', name_ar: 'كاشير مبيعات', name_en: 'Cashier', is_system: true },
      { code: 'inventory_manager', name_ar: 'مسؤول المخزون', name_en: 'Inventory Manager', is_system: true }
    ];
    for (const r of rolesData) {
      await supabase.from('roles').upsert(r, { onConflict: 'code' });
    }

    // 3. Seed Categories
    console.log('3. Seeding Product Categories...');
    const categoriesData = [
      { code: 'CAT-MEN', name_ar: 'ملابس رجالي', name_en: 'Men Wear', is_active: true },
      { code: 'CAT-WOMEN', name_ar: 'ملابس حريمي', name_en: 'Women Wear', is_active: true },
      { code: 'CAT-KIDS', name_ar: 'ملابس أطفال', name_en: 'Kids Wear', is_active: true },
      { code: 'CAT-ACC', name_ar: 'إكسسوارات وهدايا', name_en: 'Accessories', is_active: true }
    ];
    const catMap = {};
    for (const c of categoriesData) {
      const { data: res } = await supabase.from('categories').upsert(c, { onConflict: 'code' }).select('id, code').single();
      if (res) catMap[res.code] = res.id;
    }

    // 4. Seed Brands
    console.log('4. Seeding Brands...');
    const brandsData = [
      { name_ar: 'زارا', name_en: 'Zara', is_active: true },
      { name_ar: 'نايكي', name_en: 'Nike', is_active: true },
      { name_ar: 'أديداس', name_en: 'Adidas', is_active: true },
      { name_ar: 'إل سي وايكيكي', name_en: 'LC Waikiki', is_active: true }
    ];
    const brandIds = [];
    for (const b of brandsData) {
      const { data: res } = await supabase.from('brands').upsert(b, { onConflict: 'name_en' }).select('id').single();
      if (res) brandIds.push(res.id);
    }

    // 5. Seed Sizes
    console.log('5. Seeding Sizes...');
    const sizesData = [
      { code: 'S', name_ar: 'صغير (S)', name_en: 'Small', sort_order: 1 },
      { code: 'M', name_ar: 'وسط (M)', name_en: 'Medium', sort_order: 2 },
      { code: 'L', name_ar: 'كبير (L)', name_en: 'Large', sort_order: 3 },
      { code: 'XL', name_ar: 'كبير جداً (XL)', name_en: 'X-Large', sort_order: 4 },
      { code: 'XXL', name_ar: 'جامبو (XXL)', name_en: 'XX-Large', sort_order: 5 }
    ];
    const sizeMap = {};
    for (const s of sizesData) {
      const { data: res } = await supabase.from('sizes').upsert(s, { onConflict: 'code' }).select('id, code').single();
      if (res) sizeMap[res.code] = res.id;
    }

    // 6. Seed Colors
    console.log('6. Seeding Colors...');
    const colorsData = [
      { code: 'BLK', name_ar: 'أسود', name_en: 'Black', hex_code: '#000000' },
      { code: 'WHT', name_ar: 'أبيض', name_en: 'White', hex_code: '#FFFFFF' },
      { code: 'BLU', name_ar: 'كحلي / أزرق', name_en: 'Navy Blue', hex_code: '#000080' },
      { code: 'RED', name_ar: 'أحمر', name_en: 'Red', hex_code: '#FF0000' },
      { code: 'GRY', name_ar: 'رمادي', name_en: 'Grey', hex_code: '#808080' }
    ];
    const colorMap = {};
    for (const col of colorsData) {
      const { data: res } = await supabase.from('colors').upsert(col, { onConflict: 'code' }).select('id, code').single();
      if (res) colorMap[res.code] = res.id;
    }

    // 7. Seed Products & Variants
    console.log('7. Seeding Products & Variants with Barcodes and Stock...');
    const productsToCreate = [
      {
        name_ar: 'قميص قطن كاجوال رجالي',
        name_en: "Men's Casual Cotton Shirt",
        category_id: catMap['CAT-MEN'],
        brand_id: brandIds[0],
        base_price: 450,
        cost_price: 250,
        tax_rate: 15,
        min_stock_alert: 5,
        variants: [
          { size: 'M', color: 'BLK', sku: 'SHIRT-BLK-M', barcode: '629100000001', price: 450, cost: 250, qty: 50 },
          { size: 'L', color: 'BLK', sku: 'SHIRT-BLK-L', barcode: '629100000002', price: 450, cost: 250, qty: 45 },
          { size: 'XL', color: 'WHT', sku: 'SHIRT-WHT-XL', barcode: '629100000003', price: 450, cost: 250, qty: 30 },
          { size: 'L', color: 'BLU', sku: 'SHIRT-BLU-L', barcode: '629100000004', price: 450, cost: 250, qty: 40 }
        ]
      },
      {
        name_ar: 'بنطلون جينز أزرق رجالي',
        name_en: "Men's Blue Denim Jeans",
        category_id: catMap['CAT-MEN'],
        brand_id: brandIds[1],
        base_price: 650,
        cost_price: 380,
        tax_rate: 15,
        min_stock_alert: 5,
        variants: [
          { size: 'M', color: 'BLU', sku: 'JEANS-BLU-M', barcode: '629100000005', price: 650, cost: 380, qty: 35 },
          { size: 'L', color: 'BLU', sku: 'JEANS-BLU-L', barcode: '629100000006', price: 650, cost: 380, qty: 50 },
          { size: 'XL', color: 'BLK', sku: 'JEANS-BLK-XL', barcode: '629100000007', price: 650, cost: 380, qty: 25 }
        ]
      },
      {
        name_ar: 'فستان حريمي أنيق',
        name_en: "Women's Elegant Dress",
        category_id: catMap['CAT-WOMEN'],
        brand_id: brandIds[0],
        base_price: 850,
        cost_price: 480,
        tax_rate: 15,
        min_stock_alert: 5,
        variants: [
          { size: 'S', color: 'RED', sku: 'DRESS-RED-S', barcode: '629100000008', price: 850, cost: 480, qty: 20 },
          { size: 'M', color: 'RED', sku: 'DRESS-RED-M', barcode: '629100000009', price: 850, cost: 480, qty: 25 },
          { size: 'L', color: 'BLK', sku: 'DRESS-BLK-L', barcode: '629100000010', price: 850, cost: 480, qty: 30 }
        ]
      },
      {
        name_ar: 'تيشرت أطفال قطن ملون',
        name_en: "Kids Cotton T-Shirt",
        category_id: catMap['CAT-KIDS'],
        brand_id: brandIds[3],
        base_price: 220,
        cost_price: 110,
        tax_rate: 15,
        min_stock_alert: 5,
        variants: [
          { size: 'S', color: 'WHT', sku: 'KIDS-WHT-S', barcode: '629100000011', price: 220, cost: 110, qty: 60 },
          { size: 'M', color: 'BLU', sku: 'KIDS-BLU-M', barcode: '629100000012', price: 220, cost: 110, qty: 55 }
        ]
      }
    ];

    for (const pInfo of productsToCreate) {
      const { data: prod } = await supabase.from('products').insert({
        name_ar: pInfo.name_ar,
        name_en: pInfo.name_en,
        category_id: pInfo.category_id,
        brand_id: pInfo.brand_id,
        base_price: pInfo.base_price,
        cost_price: pInfo.cost_price,
        tax_rate: pInfo.tax_rate,
        min_stock_alert: pInfo.min_stock_alert,
        is_active: true
      }).select('id').single();

      if (prod) {
        for (const vInfo of pInfo.variants) {
          const { data: varObj } = await supabase.from('product_variants').insert({
            product_id: prod.id,
            size_id: sizeMap[vInfo.size] || Object.values(sizeMap)[0],
            color_id: colorMap[vInfo.color] || Object.values(colorMap)[0],
            sku: vInfo.sku,
            barcode: vInfo.barcode,
            cost_price: vInfo.cost,
            selling_price: vInfo.price,
            is_active: true
          }).select('id').single();

          if (varObj) {
            await supabase.from('branch_variant_stock').upsert({
              branch_id: branchId,
              variant_id: varObj.id,
              quantity: vInfo.qty
            });
          }
        }
      }
    }

    // 8. Seed Walk-in & Registered Customers
    console.log('8. Seeding Customers...');
    const walkInCustomer = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'عميل نقدي (Walk-in)',
      phone: '0000000000',
      email: 'walkin@store.com',
      notes: 'عميل الصالة الرئيسي للبيع النقدي والسريع'
    };
    await supabase.from('customers').upsert(walkInCustomer, { onConflict: 'id' });

    const extraCustomers = [
      { name: 'أحمد محمود', phone: '01011112222', email: 'ahmed@gmail.com', address: 'مدينة نصر، القاهرة' },
      { name: 'سارة علي', phone: '01022223333', email: 'sara@gmail.com', address: 'المعادي، القاهرة' }
    ];
    for (const cust of extraCustomers) {
      await supabase.from('customers').insert(cust);
    }

    // 9. Seed Suppliers
    console.log('9. Seeding Suppliers...');
    const suppliersData = [
      { name: 'مصنع الملابس العصرية', phone: '01200001111', email: 'factory@textile.com', address: 'المحلة الكبرى', balance: 0 },
      { name: 'شركة النسيج الذهبي', phone: '01200002222', email: 'info@goldentextile.com', address: 'العاشر من رمضان', balance: 0 }
    ];
    for (const sup of suppliersData) {
      await supabase.from('suppliers').insert(sup);
    }

    // 10. Seed Active Coupons
    console.log('10. Seeding Active Coupons...');
    const couponsData = [
      { code: 'WELCOME10', type: 'percentage', value: 10, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 365*24*3600*1000).toISOString(), min_spend: 200, is_active: true },
      { code: 'SAVE50', type: 'fixed', value: 50, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 365*24*3600*1000).toISOString(), min_spend: 500, is_active: true }
    ];
    for (const coup of couponsData) {
      await supabase.from('coupons').insert(coup);
    }

    // 11. Seed Cash Register & Open Shift
    console.log('11. Seeding Cash Register & Opening Active Cashier Shift...');
    
    await supabase.from('profiles').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      full_name: 'كاشير المبيعات الرئيسي',
      branch_id: branchId,
      is_active: true
    });

    const { data: reg } = await supabase.from('cash_registers').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      branch_id: branchId,
      name_ar: 'خزينة الكاشير الرئيسية 01',
      name_en: 'Main Register 01',
      code: 'REG-01',
      is_active: true
    }, { onConflict: 'branch_id, code' }).select('id').single();

    if (reg) {
      await supabase.from('cashier_shifts').upsert({
        id: '00000000-0000-0000-0000-000000000001',
        cash_register_id: reg.id,
        branch_id: branchId,
        cashier_id: '00000000-0000-0000-0000-000000000001',
        status: 'open',
        opened_at: new Date().toISOString(),
        opening_balance: 1000,
        total_sales_cash: 0,
        total_sales_card: 0,
        total_returns_cash: 0,
        total_expenses: 0,
        total_cash_in: 0,
        total_cash_out: 0
      }, { onConflict: 'id' });
    }

    console.log('\n====================================================');
    console.log('SUCCESS! DEMO DATA SEEDED INTO SUPABASE DATABASE');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal Seeding Error:', err);
  }
}

seedDatabase();
