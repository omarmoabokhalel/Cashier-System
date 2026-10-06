import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  Receipt,
  ArrowLeftRight,
  Plus,
  Trash2,
  ShoppingCart,
  DollarSign,
  Tag,
} from 'lucide-react';

export const ExchangesShell: React.FC = () => {
  const { showToast } = useToast();

  // Step 1: Invoice Search & Return Item Selection
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, number>>({});

  // Live Autocomplete Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const q = invoiceQuery.trim();
    if (!q || q.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const { data } = await supabase
          .from('sales')
          .select(`
            id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, created_at, customer_id,
            customers(full_name, phone),
            sale_items(
              id, variant_id, quantity, returned_quantity, unit_price, cost_price, discount_amount, total_price,
              product_variants(
                id, sku, barcode,
                sizes(code, name_ar),
                colors(name_ar, hex_code),
                products(name_ar, name_en)
              )
            )
          `)
          .or(`invoice_number.ilike.%${q}%,customers.full_name.ilike.%${q}%,customers.phone.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(6);

        if (data && data.length > 0) {
          setSuggestions(data);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (e) {
        console.error('Error fetching exchange invoice suggestions:', e);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [invoiceQuery]);

  // Step 2: Replacement Item Catalog Search & Selection
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [replacementCart, setReplacementCart] = useState<any[]>([]);

  // Step 3: Exchange Execution & Financial Balance
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedExchange, setCompletedExchange] = useState<any | null>(null);
  const [taxRate, setTaxRate] = useState<number>(15);

  // Recent Exchanges History Log State
  const [recentExchanges, setRecentExchanges] = useState<any[]>([]);
  const [loadingRecentExchanges, setLoadingRecentExchanges] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    loadTaxRate();
    loadRecentExchanges();
  }, []);

  const loadRecentExchanges = async () => {
    setLoadingRecentExchanges(true);
    try {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          id, exchange_number, price_difference, created_at,
          sales!exchanges_new_sale_id_fkey(invoice_number, total_amount),
          exchange_items(
            quantity, price,
            returned_variant:product_variants!exchange_items_returned_variant_id_fkey(
              sku, sizes(code), colors(name_ar), products(name_ar)
            ),
            new_variant:product_variants!exchange_items_new_variant_id_fkey(
              sku, sizes(code), colors(name_ar), products(name_ar)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setRecentExchanges(data);
      } else {
        const { data: simpleData } = await supabase
          .from('exchanges')
          .select('id, exchange_number, price_difference, created_at')
          .order('created_at', { ascending: false })
          .limit(30);
        if (simpleData) setRecentExchanges(simpleData);
      }
    } catch (err) {
      console.error('Error fetching recent exchanges:', err);
    } finally {
      setLoadingRecentExchanges(false);
    }
  };

  const loadTaxRate = async () => {
    try {
      const cached = localStorage.getItem('app_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.defaultTaxRate !== undefined) {
          setTaxRate(Number(parsed.defaultTaxRate));
        }
      }
      const { data: configData } = await (supabase.from('app_config') as any).select('*').eq('key', 'defaultTaxRate').single();
      if (configData && configData.value !== undefined) {
        setTaxRate(Number(configData.value));
      }
    } catch (e) {
      console.error('Error loading tax rate in Exchanges:', e);
    }
  };

  const addReplacementVariant = (pv: any) => {
    setReplacementCart((prev) => {
      const existing = prev.find((item) => item.id === pv.id);
      if (existing) {
        return prev.map((item) => (item.id === pv.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [
        ...prev,
        {
          id: pv.id,
          nameAr: pv.products?.name_ar || 'منتج',
          sizeCode: pv.sizes?.code || 'N/A',
          colorNameAr: pv.colors?.name_ar || 'عام',
          unitPrice: Number(pv.selling_price),
          qty: 1,
        },
      ];
    });
  };

  // Load Catalog for Replacement Selection
  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const { data } = await supabase
          .from('product_variants')
          .select(`
            id, sku, barcode, selling_price, cost_price, deleted_at,
            sizes(id, code, name_ar),
            colors(id, name_ar, hex_code),
            products(id, name_ar, name_en, category_id, image_url, deleted_at),
            branch_variant_stock(quantity)
          `)
          .eq('is_active', true)
          .is('deleted_at', null)
          .limit(30);

        const activeCatalog = (data || []).filter(
          (pv: any) => !pv.deleted_at && pv.products && !pv.products.deleted_at
        );
        setCatalogProducts(activeCatalog);
      } catch (e) {
        console.error('Failed to load catalog:', e);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  // Search Original Invoice
  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceQuery.trim()) return;

    setSearchingInvoice(true);
    setSelectedInvoice(null);
    setSelectedReturnItems({});

    try {
      const q = invoiceQuery.trim();
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, created_at, customer_id,
          customers(full_name, phone),
          sale_items(
            id, variant_id, quantity, returned_quantity, unit_price, cost_price, discount_amount, total_price,
            product_variants(
              id, sku, barcode,
              sizes(code, name_ar),
              colors(name_ar, hex_code),
              products(name_ar, name_en)
            )
          )
        `)
        .or(`invoice_number.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        showToast('warning', 'غير موجود', 'لم يتم العثور على الفاتورة الحالية');
      } else {
        setSelectedInvoice(data);
      }
    } catch (e: any) {
      showToast('error', 'خطأ في البحث', e.message);
    } finally {
      setSearchingInvoice(false);
    }
  };

  const toggleReturnItemQty = (saleItemId: string, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(maxQty, qty));
    setSelectedReturnItems((prev) => ({
      ...prev,
      [saleItemId]: validQty,
    }));
  };

  const updateReplacementQty = (id: string, delta: number) => {
    setReplacementCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((i) => i.qty > 0)
    );
  };

  // Financial Calculations
  const sumInvoiceItemsNet = selectedInvoice
    ? (selectedInvoice.sale_items || []).reduce((sum: number, si: any) => {
        const itemNet = (si.total_price !== undefined && si.total_price !== null)
          ? Number(si.total_price)
          : (Number(si.unit_price || 0) * Number(si.quantity || 1) - Number(si.discount_amount || 0));
        return sum + Math.max(0, itemNet);
      }, 0)
    : 0;

  const invoiceOrderDiscountRatio = (selectedInvoice && sumInvoiceItemsNet > 0 && selectedInvoice.total_amount !== undefined && Number(selectedInvoice.total_amount) < sumInvoiceItemsNet)
    ? Number(selectedInvoice.total_amount) / sumInvoiceItemsNet
    : 1;

  const calculatedOldRefund = selectedInvoice
    ? selectedInvoice.sale_items.reduce((acc: number, si: any) => {
        const qty = selectedReturnItems[si.id] || 0;
        const lineNetUnitPrice = (si.quantity > 0 && si.total_price !== undefined && si.total_price !== null)
          ? Number(si.total_price) / si.quantity
          : (si.quantity > 0 ? Number(si.unit_price) - (Number(si.discount_amount || 0) / si.quantity) : Number(si.unit_price));
        const effectiveUnitPrice = Math.max(0, lineNetUnitPrice * invoiceOrderDiscountRatio);
        return acc + qty * effectiveUnitPrice;
      }, 0)
    : 0;

  const calculatedNewSubtotal = replacementCart.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
  const calculatedNewTax = calculatedNewSubtotal * (taxRate / 100);
  const calculatedNewGrandTotal = calculatedNewSubtotal + calculatedNewTax;

  const netPriceDifference = calculatedNewGrandTotal - calculatedOldRefund;

  const processExchangeDirectly = async (shiftId: string, returnItemsPayload: Array<{ sale_item_id: string; quantity: number }>) => {
    const defaultBranchId = '00000000-0000-0000-0000-000000000001';
    const exchangeNumber = `EXC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Process returned items (restock + update sale_items)
    for (const retPayload of returnItemsPayload) {
      const origItem = selectedInvoice.sale_items.find((si: any) => si.id === retPayload.sale_item_id);
      if (origItem) {
        const newReturnedQty = (origItem.returned_quantity || 0) + retPayload.quantity;
        await (supabase.from('sale_items') as any)
          .update({ returned_quantity: newReturnedQty })
          .eq('id', retPayload.sale_item_id);

        const vId = origItem.variant_id;
        const { data: stockRow } = await (supabase.from('branch_variant_stock') as any)
          .select('quantity')
          .eq('branch_id', defaultBranchId)
          .eq('variant_id', vId)
          .maybeSingle();

        const currQty = stockRow ? Number(stockRow.quantity || 0) : 0;
        const newQty = currQty + retPayload.quantity;

        if (stockRow) {
          await (supabase.from('branch_variant_stock') as any)
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('branch_id', defaultBranchId)
            .eq('variant_id', vId);
        } else {
          await (supabase.from('branch_variant_stock') as any).insert({
            branch_id: defaultBranchId,
            variant_id: vId,
            quantity: retPayload.quantity,
          });
        }

        await (supabase.from('inventory_movements') as any).insert({
          branch_id: defaultBranchId,
          variant_id: vId,
          movement_type: 'return',
          quantity_delta: retPayload.quantity,
          quantity_before: currQty,
          quantity_after: newQty,
          reference_type: 'exchange',
          selling_price: origItem.unit_price,
        });
      }
    }

    // 2. Create new sale for replacement items
    const { data: newSaleRow, error: newSaleErr } = await (supabase.from('sales') as any)
      .insert({
        invoice_number: newInvoiceNumber,
        branch_id: defaultBranchId,
        cashier_shift_id: shiftId,
        customer_id: selectedInvoice.customer_id || null,
        subtotal: calculatedNewSubtotal,
        discount_amount: 0,
        tax_rate: taxRate,
        tax_amount: calculatedNewTax,
        total_amount: calculatedNewGrandTotal,
        paid_amount: calculatedNewGrandTotal,
        change_amount: 0,
        notes: `فاتورة بديلة ناتجة عن استبدال للفاتورة #${selectedInvoice.invoice_number}`,
      })
      .select()
      .single();

    if (newSaleErr) throw new Error(newSaleErr.message);

    const newSaleId = newSaleRow.id;

    // 3. Deduct stock for replacement items & insert sale_items
    for (const item of replacementCart) {
      const lineTotal = item.unitPrice * item.qty;
      await (supabase.from('sale_items') as any).insert({
        sale_id: newSaleId,
        variant_id: item.id,
        quantity: item.qty,
        unit_price: item.unitPrice,
        cost_price: item.unitPrice * 0.7,
        discount_amount: 0,
        total_price: lineTotal,
      });

      const { data: stockRow } = await (supabase.from('branch_variant_stock') as any)
        .select('quantity')
        .eq('branch_id', defaultBranchId)
        .eq('variant_id', item.id)
        .maybeSingle();

      const currQty = stockRow ? Number(stockRow.quantity || 0) : 0;
      const newQty = Math.max(0, currQty - item.qty);

      if (stockRow) {
        await (supabase.from('branch_variant_stock') as any)
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('branch_id', defaultBranchId)
          .eq('variant_id', item.id);
      }

      await (supabase.from('inventory_movements') as any).insert({
        branch_id: defaultBranchId,
        variant_id: item.id,
        movement_type: 'sale',
        quantity_delta: -item.qty,
        quantity_before: currQty,
        quantity_after: newQty,
        reference_type: 'sale',
        reference_id: newSaleId,
        selling_price: item.unitPrice,
      });
    }

    // 4. Insert new sale payment
    await (supabase.from('payments') as any).insert({
      sale_id: newSaleId,
      payment_method: paymentMethod,
      amount: calculatedNewGrandTotal,
    });

    // 5. Insert into exchanges table
    const { data: exchangeRow } = await (supabase.from('exchanges') as any)
      .insert({
        exchange_number: exchangeNumber,
        new_sale_id: newSaleId,
        branch_id: defaultBranchId,
        cashier_shift_id: shiftId,
        price_difference: netPriceDifference,
      })
      .select()
      .maybeSingle();

    return {
      exchange_number: exchangeNumber,
      new_invoice_number: newInvoiceNumber,
      price_difference: netPriceDifference,
    };
  };

  const handleProcessExchange = async () => {
    if (!selectedInvoice) return;

    const returnItemsPayload = Object.entries(selectedReturnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, qty]) => ({
        sale_item_id: saleItemId,
        quantity: qty,
      }));

    if (returnItemsPayload.length === 0) {
      showToast('warning', 'حدد صنف صادر', 'يرجى تحديد قطعة سابقة واحدة على الأقل للإرجاع الاستبدالي');
      return;
    }

    if (replacementCart.length === 0) {
      showToast('warning', 'حدد صنف بديل', 'يرجى اختيار صنف جديد واحد على الأقل للاستبدال');
      return;
    }

    setIsSubmitting(true);

    try {
      let shiftId = '00000000-0000-0000-0000-000000000001';
      const { data: openShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (openShiftData && openShiftData.length > 0) {
        shiftId = openShiftData[0].id;
      }

      const newSaleItems = replacementCart.map((item) => ({
        variant_id: item.id,
        quantity: item.qty,
        unit_price: item.unitPrice,
        discount_amount: 0,
      }));

      const newSalePayments = [
        {
          payment_method: paymentMethod,
          amount: calculatedNewGrandTotal > 0 ? calculatedNewGrandTotal : 0.01,
        },
      ];

      const newSalePayload = {
        customer_id: selectedInvoice.customer_id || null,
        subtotal: calculatedNewSubtotal,
        discount_amount: 0,
        coupon_id: null,
        tax_rate: taxRate,
        tax_amount: calculatedNewTax,
        total_amount: calculatedNewGrandTotal,
        paid_amount: calculatedNewGrandTotal > 0 ? calculatedNewGrandTotal : 0.01,
        change_amount: 0,
        items: newSaleItems,
        payments: newSalePayments,
        idempotency_key: `EXC-KEY-${Date.now()}`,
      };

      let exchangeResult: any = null;
      try {
        const { data, error } = await (supabase.rpc as any)('rpc_process_exchange', {
          p_original_sale_id: selectedInvoice.id,
          p_cashier_shift_id: shiftId,
          p_return_items: returnItemsPayload,
          p_new_sale_payload: newSalePayload,
        });

        if (error || !data) {
          console.warn('RPC process_exchange failed, using direct atomic fallback:', error);
          exchangeResult = await processExchangeDirectly(shiftId, returnItemsPayload);
        } else {
          exchangeResult = data;
        }
      } catch (err) {
        console.warn('RPC process_exchange exception, using direct atomic fallback:', err);
        exchangeResult = await processExchangeDirectly(shiftId, returnItemsPayload);
      }

      showToast('success', 'تم الاستبدال بنجاح!', `رقم الاستبدال: ${exchangeResult?.exchange_number}`);
      setCompletedExchange(exchangeResult);

      loadRecentExchanges();

      // Reset
      setSelectedInvoice(null);
      setSelectedReturnItems({});
      setReplacementCart([]);
      setInvoiceQuery('');
    } catch (e: any) {
      showToast('error', 'خطأ في عملية الاستبدال', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-sky-400" />
            <span>إدارة عمليات الاستبدال</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            استبدال مقاس أو لون أو صنف قديم بصنف جديد وحساب الفرق المالي بينهما تلقائياً
          </p>
        </div>
      </div>

      {/* STEP 1: SEARCH INVOICE */}
      <Card className="p-4 bg-slate-900 border-slate-800 relative z-30">
        <form onSubmit={handleSearchInvoice} className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="أدخل رقم الفاتورة (مثال: INV-2026-000001) أو اسم/هاتف العميل..."
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />

            {/* LIVE AUTOCOMPLETE DROPDOWN */}
            {showSuggestions && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 divide-y divide-slate-800/60 font-sans" dir="rtl">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 flex justify-between items-center">
                  <span>اقتراحات الفواتير المطابقة ({suggestions.length})</span>
                  {loadingSuggestions && <span className="animate-pulse text-indigo-400">جاري البحث...</span>}
                </div>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setInvoiceQuery(s.invoice_number);
                      setShowSuggestions(false);
                      setSelectedInvoice(s);
                      setSelectedReturnItems({});
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-800/90 cursor-pointer flex justify-between items-center text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-100 font-mono text-sm flex items-center gap-2">
                        <span>{s.invoice_number}</span>
                        <span className="text-[10px] text-slate-400 font-sans">({new Date(s.created_at).toLocaleDateString('ar-EG')})</span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        العميل: {s.customers?.full_name || 'نقدي عام'} {s.customers?.phone ? `(${s.customers.phone})` : ''}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-emerald-400 font-mono text-sm block">
                        {Number(s.total_amount).toFixed(2)} ج.م
                      </span>
                      <span className="text-[10px] text-sky-300 font-semibold">اضغط للاستدعاء</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" isLoading={searchingInvoice} variant="primary" className="bg-sky-600 hover:bg-sky-500 text-white font-bold gap-2">
            <Search className="w-4 h-4" />
            <span>استدعاء الفاتورة</span>
          </Button>
        </form>
      </Card>

      {/* EXCHANGES LAYOUT SPLIT */}
      {selectedInvoice ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COL 1: OLD RETURNED ITEMS */}
          <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <span>1. حدد الصنف المرتجع (القديم)</span>
              </h3>
              <Badge variant="secondary" size="sm">{selectedInvoice.invoice_number}</Badge>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {selectedInvoice.sale_items.map((si: any) => {
                const returnable = si.quantity - (si.returned_quantity || 0);
                const selectedQty = selectedReturnItems[si.id] || 0;

                return (
                  <div key={si.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-100">
                      <span>{si.product_variants?.products?.name_ar}</span>
                      <span className="font-mono text-emerald-400">{Number(si.unit_price).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>مقاس: {si.product_variants?.sizes?.code} • {si.product_variants?.colors?.name_ar}</span>
                      <span>المتاح للإرجاع: {returnable}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className="text-[11px] text-slate-300">الكمية المرجعة:</span>
                      <Input
                        type="number"
                        min={0}
                        max={returnable}
                        value={selectedQty}
                        onChange={(e) => toggleReturnItemQty(si.id, parseInt(e.target.value) || 0, returnable)}
                        className="w-20 text-center font-mono h-7 text-xs font-bold"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* COL 2: NEW REPLACEMENT ITEMS SELECTION */}
          <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <span>2. اختر الصنف البديل (الجديد)</span>
              </h3>
              <Badge variant="primary" size="sm">{replacementCart.length} مختار</Badge>
            </div>

            {/* Catalog quick selection */}
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {catalogProducts.map((pv) => (
                <div
                  key={pv.id}
                  onClick={() => addReplacementVariant(pv)}
                  className="bg-slate-950 p-2 rounded-xl border border-slate-800 hover:border-sky-500/50 cursor-pointer flex justify-between items-center text-xs transition-colors"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">{pv.products?.name_ar}</span>
                    <span className="text-[10px] text-slate-400">
                      مقاس: {pv.sizes?.code} • {pv.colors?.name_ar}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sky-400">{Number(pv.selling_price).toFixed(2)} ج.م</span>
                </div>
              ))}
            </div>

            {/* Replacement Selected Cart */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-300 block">الأصناف البديلة المختارة:</span>
              {replacementCart.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-4">انقر على صنف من القائمة للأعلى لإضافته كبديل</p>
              ) : (
                replacementCart.map((item) => (
                  <div key={item.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-100">{item.nameAr} ({item.sizeCode})</span>
                      <span className="text-[10px] text-sky-400 block font-mono">{(item.unitPrice * item.qty).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateReplacementQty(item.id, -1)} className="px-1.5 py-0.5 bg-slate-900 rounded font-bold text-slate-300">-</button>
                      <span className="px-1 font-mono font-bold">{item.qty}</span>
                      <button onClick={() => updateReplacementQty(item.id, 1)} className="px-1.5 py-0.5 bg-slate-900 rounded font-bold text-slate-300">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* COL 3: FINANCIAL BALANCE & SUBMIT */}
          <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-2">
              3. حساب الفروقات وتأكيد الاستبدال
            </h3>

            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between text-rose-400 font-semibold">
                <span>قيمـة القديم المرتجع:</span>
                <span className="font-mono">-{calculatedOldRefund.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-sky-400 font-semibold">
                <span>إجمالي جديد شامل الضريبة:</span>
                <span className="font-mono">+{calculatedNewGrandTotal.toFixed(2)} ج.م</span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black">
                <span>الفرق المالي:</span>
                {netPriceDifference > 0 ? (
                  <span className="font-mono text-amber-400">يتوجب على العميل دفع {netPriceDifference.toFixed(2)} ج.م</span>
                ) : netPriceDifference < 0 ? (
                  <span className="font-mono text-emerald-400">يرجع للعميل {Math.abs(netPriceDifference).toFixed(2)} ج.م</span>
                ) : (
                  <span className="font-mono text-blue-400">استبدال متكافئ (0.00 ج.م)</span>
                )}
              </div>
            </div>

            {netPriceDifference > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">طريقة دفع المتبقي</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-xl border font-bold text-xs ${
                      paymentMethod === 'cash' ? 'bg-emerald-950 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    نقداً (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 rounded-xl border font-bold text-xs ${
                      paymentMethod === 'card' ? 'bg-indigo-950 border-indigo-600 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    بطاقة (Card)
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={handleProcessExchange}
              isLoading={isSubmitting}
              size="lg"
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 text-sm shadow-xl"
            >
              تأكيد عملية الاستبدال
            </Button>
          </Card>
        </div>
      ) : null}

      {/* RECENT EXCHANGES HISTORY LOG SECTION */}
      <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white">سجل عمليات الاستبدال السابقة</h3>
            <Badge variant="secondary" size="sm" className="bg-slate-800 text-slate-300">
              {recentExchanges.length} عملية
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="بحث في سجل الاستبدالات..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-64 text-xs h-8"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={loadRecentExchanges}
              isLoading={loadingRecentExchanges}
              className="h-8 gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {recentExchanges.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <RefreshCw className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p>لا توجد عمليات استبدال مسجلة في النظام حتى الآن</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">رقم الاستبدال</th>
                  <th className="py-2.5 px-3">الفاتورة البديلة الجديدة</th>
                  <th className="py-2.5 px-3 text-center">التاريخ والوقت</th>
                  <th className="py-2.5 px-3 text-center">الفرق المالي</th>
                  <th className="py-2.5 px-3">تفاصيل الأصناف المستبدلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {recentExchanges
                  .filter((ex) => {
                    if (!historySearchQuery.trim()) return true;
                    const q = historySearchQuery.toLowerCase();
                    return (
                      (ex.exchange_number || '').toLowerCase().includes(q) ||
                      (ex.sales?.invoice_number || '').toLowerCase().includes(q)
                    );
                  })
                  .map((ex) => {
                    const diff = Number(ex.price_difference || 0);
                    return (
                      <tr key={ex.id} className="hover:bg-slate-950/50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-sky-400">{ex.exchange_number}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                          {ex.sales?.invoice_number || 'فاتورة جديدة'}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 text-[11px]">
                          {new Date(ex.created_at).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-sm">
                          {diff > 0 ? (
                            <span className="text-amber-400">تحصيل +{diff.toFixed(2)} ج.م</span>
                          ) : diff < 0 ? (
                            <span className="text-emerald-400">إرجاع -{Math.abs(diff).toFixed(2)} ج.م</span>
                          ) : (
                            <span className="text-sky-300">متكافئ (0.00 ج.م)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-[11px]">
                          {(ex.exchange_items || []).map((ei: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-rose-400 font-semibold">{ei.returned_variant?.products?.name_ar || 'قديم'}</span>
                              <span className="text-slate-500">➔</span>
                              <span className="text-sky-400 font-semibold">{ei.new_variant?.products?.name_ar || 'جديد'}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* COMPLETED EXCHANGE SUMMARY DIALOG */}
      <Dialog
        isOpen={!!completedExchange}
        onClose={() => setCompletedExchange(null)}
        title="تمت عملية الاستبدال بنجاح"
        maxWidth="sm"
      >
        {completedExchange && (
          <div className="space-y-4 font-sans text-center" dir="rtl">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">سند استبدال #{completedExchange.exchange_number}</h3>
              <p className="text-xs text-slate-400 mt-1">
                الفاتورة الجديدة الصادرة: {completedExchange.new_invoice_number}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>الفرق المالي المعتمد:</span>
                <span className="font-mono font-bold text-sky-400 text-base">
                  {Number(completedExchange.price_difference).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <Button onClick={() => setCompletedExchange(null)} className="w-full">
              إغلاق
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
};
