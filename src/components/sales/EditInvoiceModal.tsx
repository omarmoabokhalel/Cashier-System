import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import {
  Pencil,
  Trash2,
  Plus,
  Minus,
  Search,
  AlertCircle,
  Save,
  Receipt,
  User,
  CreditCard,
  Calendar,
  Clock,
  ShoppingBag,
  X,
} from 'lucide-react';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any | null;
  onInvoiceUpdated: () => void;
}

interface ItemEditState {
  id?: string; // sale_item id if existing
  variant_id: string;
  productName: string;
  sku: string;
  sizeCode: string;
  colorName: string;
  quantity: number;
  originalQuantity: number;
  unitPrice: number;
  minSellingPrice: number;
  discountAmount: number;
  costPrice: number;
}

export const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  isOpen,
  onClose,
  sale,
  onInvoiceUpdated,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(15);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Items State
  const [items, setItems] = useState<ItemEditState[]>([]);

  // Product Search State to add items
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Populate data when sale changes or modal opens
  useEffect(() => {
    if (sale && isOpen) {
      setSelectedCustomerId(sale.customer_id || sale.customers?.id || '');
      setPaymentMethod(sale.payments?.[0]?.payment_method || 'cash');
      setNotes(sale.notes || '');
      setInvoiceDiscount(Number(sale.discount_amount || 0));
      setTaxRate(Number(sale.tax_rate ?? 15));
      setPaidAmount(Number(sale.paid_amount || sale.total_amount || 0));

      // Format created_at to local 'YYYY-MM-DDTHH:mm' string for datetime-local input
      if (sale.created_at) {
        const d = new Date(sale.created_at);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        setCreatedAt(localISOTime);
      } else {
        setCreatedAt('');
      }

      // Map sale_items
      const mappedItems: ItemEditState[] = (sale.sale_items || []).map((item: any) => {
        const pv = item.product_variants || {};
        const p = pv.products || {};
        return {
          id: item.id,
          variant_id: item.variant_id || pv.id,
          productName: p.name_ar || 'منتج',
          sku: pv.sku || pv.barcode || '',
          sizeCode: pv.sizes?.code || 'Std',
          colorName: pv.colors?.name_ar || 'عام',
          quantity: Number(item.quantity),
          originalQuantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          minSellingPrice: Number(p.min_selling_price || 0),
          discountAmount: Number(item.discount_amount || 0),
          costPrice: Number(item.cost_price || p.cost_price || 0),
        };
      });
      setItems(mappedItems);

      fetchCustomers();
    }
  }, [sale, isOpen]);

  const fetchCustomers = async () => {
    try {
      const { data } = await (supabase.from('customers') as any)
        .select('id, full_name, phone')
        .order('full_name');
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Search product variants reliably to add to invoice
  const handleSearchVariants = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await (supabase.from('product_variants') as any)
        .select(`
          id, sku, barcode, selling_price, cost_price,
          products(id, name_ar, cost_price, min_selling_price, base_price, deleted_at),
          sizes(code),
          colors(name_ar),
          branch_variant_stock(quantity)
        `)
        .eq('is_active', true);

      const qLower = q.toLowerCase().trim();
      const filtered = (data || [])
        .filter((v: any) => {
          if (v.products?.deleted_at) return false;
          const nameMatch = v.products?.name_ar?.toLowerCase().includes(qLower);
          const skuMatch = v.sku?.toLowerCase().includes(qLower);
          const barcodeMatch = v.barcode?.toLowerCase().includes(qLower);
          return nameMatch || skuMatch || barcodeMatch;
        })
        .slice(0, 8);

      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddVariantToInvoice = (v: any) => {
    const existingIndex = items.findIndex((i) => i.variant_id === v.id);
    if (existingIndex > -1) {
      // Increment quantity
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      const newItem: ItemEditState = {
        variant_id: v.id,
        productName: v.products?.name_ar || 'منتج جديد',
        sku: v.sku || v.barcode || '',
        sizeCode: v.sizes?.code || 'Std',
        colorName: v.colors?.name_ar || 'عام',
        quantity: 1,
        originalQuantity: 0,
        unitPrice: Number(v.selling_price || v.products?.base_price || 0),
        minSellingPrice: Number(v.products?.min_selling_price || 0),
        discountAmount: 0,
        costPrice: Number(v.cost_price || v.products?.cost_price || 0),
      };
      setItems([...items, newItem]);
    }
    setSearchQuery('');
    setSearchResults([]);
    showToast('info', 'تمت إضافة المنتج', `تم إضافة ${v.products?.name_ar} إلى الفاتورة`);
  };

  const handleUpdateItem = (index: number, field: keyof ItemEditState, val: number) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const handleAdjustQuantity = (index: number, delta: number) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty > 0) {
      updated[index].quantity = newQty;
      setItems(updated);
    }
  };

  const handleRemoveItem = (index: number) => {
    const removedItemName = items[index]?.productName;
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    showToast('info', 'تم إزالة الصنف', `تم حذف ${removedItemName || ''} من الفاتورة`);
  };

  // Compute Invoice Financial Totals
  const itemsSubtotal = items.reduce((sum, item) => {
    const lineTotal = (item.unitPrice * item.quantity) - item.discountAmount;
    return sum + Math.max(0, lineTotal);
  }, 0);

  const subtotalAfterDiscount = Math.max(0, itemsSubtotal - invoiceDiscount);
  const computedTaxAmount = (subtotalAfterDiscount * (taxRate / 100));
  const computedTotalAmount = subtotalAfterDiscount + computedTaxAmount;
  const changeAmount = Math.max(0, paidAmount - computedTotalAmount);

  const handleSaveInvoice = async () => {
    if (!sale) return;
    if (items.length === 0) {
      showToast('error', 'لا يمكن تفعيل فاتورة فارغة', 'برجاء إضافة منتج واحد على الأقل للفاتورة');
      return;
    }

    // Check minimum selling price rules
    for (const item of items) {
      if (item.minSellingPrice > 0 && item.unitPrice < item.minSellingPrice) {
        showToast(
          'error',
          'سعر البيع مخالف',
          `المنتج "${item.productName}" سعر البيع (${item.unitPrice} ج.م) أقل من الحد الأدنى المسموح (${item.minSellingPrice} ج.م)`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const defaultBranchId = sale.branch_id || '00000000-0000-0000-0000-000000000001';
      const updatedCreatedAt = createdAt ? new Date(createdAt).toISOString() : sale.created_at;
      const oldShiftId = sale.cashier_shift_id;
      let newShiftId = oldShiftId;

      // Resolve matching cashier_shift_id for target date
      if (createdAt && updatedCreatedAt !== sale.created_at) {
        const targetDateStr = updatedCreatedAt.split('T')[0];
        const targetTime = new Date(updatedCreatedAt).getTime();

        const { data: allShifts } = await (supabase.from('cashier_shifts') as any)
          .select('id, opened_at, closed_at, status')
          .order('opened_at', { ascending: false });

        if (allShifts && allShifts.length > 0) {
          const matchingShift = allShifts.find((s: any) => {
            const opened = new Date(s.opened_at).getTime();
            const closed = s.closed_at ? new Date(s.closed_at).getTime() : Date.now();
            return opened <= targetTime && targetTime <= closed;
          });

          if (matchingShift) {
            newShiftId = matchingShift.id;
          } else {
            const sameDayShift = allShifts.find((s: any) => {
              const openedDay = new Date(s.opened_at).toISOString().split('T')[0];
              return openedDay === targetDateStr;
            });

            if (sameDayShift) {
              newShiftId = sameDayShift.id;
            }
          }
        }
      }

      // 1. Update `sales` table (including cashier_shift_id and created_at)
      const { error: saleErr } = await (supabase.from('sales') as any)
        .update({
          customer_id: selectedCustomerId || null,
          cashier_shift_id: newShiftId,
          subtotal: itemsSubtotal,
          discount_amount: invoiceDiscount,
          tax_rate: taxRate,
          tax_amount: computedTaxAmount,
          total_amount: computedTotalAmount,
          paid_amount: paidAmount,
          change_amount: changeAmount,
          notes: notes,
          created_at: updatedCreatedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sale.id);

      if (saleErr) throw saleErr;

      // 2. Update `payments` table
      const { data: existingPayment } = await (supabase.from('payments') as any)
        .select('id')
        .eq('sale_id', sale.id)
        .maybeSingle();

      if (existingPayment) {
        await (supabase.from('payments') as any)
          .update({
            cashier_shift_id: newShiftId,
            payment_method: paymentMethod,
            amount: computedTotalAmount,
            created_at: updatedCreatedAt,
          })
          .eq('id', existingPayment.id);
      } else {
        await (supabase.from('payments') as any).insert({
          sale_id: sale.id,
          cashier_shift_id: newShiftId,
          payment_method: paymentMethod,
          amount: computedTotalAmount,
          created_at: updatedCreatedAt,
        });
      }

      // Reconcile shift totals for old and new shifts
      const updateShiftTotals = async (shiftId: string | null) => {
        if (!shiftId) return;
        try {
          await (supabase.rpc as any)('rpc_recalculate_shift_sales', { p_shift_id: shiftId });
        } catch (errRecalc) {
          // Client side fallback calculation
          try {
            const { data: shiftSales } = await (supabase.from('sales') as any)
              .select('id, total_amount, payments(payment_method, amount)')
              .eq('cashier_shift_id', shiftId);

            let cashTotal = 0;
            let cardTotal = 0;
            (shiftSales || []).forEach((s: any) => {
              (s.payments || []).forEach((p: any) => {
                if (p.payment_method === 'card' || p.payment_method === 'wallet' || p.payment_method === 'bank_transfer') {
                  cardTotal += Number(p.amount || 0);
                } else {
                  cashTotal += Number(p.amount || 0);
                }
              });
            });

            await (supabase.from('cashier_shifts') as any)
              .update({
                total_sales_cash: cashTotal,
                total_sales_card: cardTotal,
                updated_at: new Date().toISOString(),
              })
              .eq('id', shiftId);
          } catch (e) {}
        }
      };

      if (oldShiftId) await updateShiftTotals(oldShiftId);
      if (newShiftId && newShiftId !== oldShiftId) await updateShiftTotals(newShiftId);

      // 3. Reconcile `sale_items` and inventory `branch_variant_stock`
      const originalSaleItems = sale.sale_items || [];
      const currentItemIds = items.filter((i) => i.id).map((i) => i.id!);

      // Deleted Items (removed from invoice)
      const removedItems = originalSaleItems.filter((i: any) => !currentItemIds.includes(i.id));
      for (const rem of removedItems) {
        // Delete sale_item row
        await (supabase.from('sale_items') as any).delete().eq('id', rem.id);

        // Restore stock
        const remQty = Number(rem.quantity || 0);
        if (remQty > 0 && rem.variant_id) {
          const { data: currentStockObj } = await (supabase.from('branch_variant_stock') as any)
            .select('id, quantity')
            .eq('branch_id', defaultBranchId)
            .eq('variant_id', rem.variant_id)
            .maybeSingle();

          if (currentStockObj) {
            await (supabase.from('branch_variant_stock') as any)
              .update({
                quantity: currentStockObj.quantity + remQty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentStockObj.id);
          }
        }
      }

      // Upsert current items and adjust inventory deltas
      for (const item of items) {
        const qtyDiff = item.quantity - item.originalQuantity;

        const itemPayload = {
          sale_id: sale.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          cost_price: item.costPrice,
          discount_amount: item.discountAmount,
          tax_amount: ((item.unitPrice * item.quantity) - item.discountAmount) * (taxRate / 100),
          total_price: (item.unitPrice * item.quantity) - item.discountAmount,
        };

        if (item.id) {
          // Update existing item
          await (supabase.from('sale_items') as any).update(itemPayload).eq('id', item.id);
        } else {
          // Insert new item
          await (supabase.from('sale_items') as any).insert(itemPayload);
        }

        // Adjust inventory if quantity changed
        if (qtyDiff !== 0) {
          const { data: stockEntry } = await (supabase.from('branch_variant_stock') as any)
            .select('id, quantity')
            .eq('branch_id', defaultBranchId)
            .eq('variant_id', item.variant_id)
            .maybeSingle();

          if (stockEntry) {
            const newStockQty = stockEntry.quantity - qtyDiff; // positive qtyDiff reduces stock
            await (supabase.from('branch_variant_stock') as any)
              .update({
                quantity: Math.max(0, newStockQty),
                updated_at: new Date().toISOString(),
              })
              .eq('id', stockEntry.id);
          } else {
            await (supabase.from('branch_variant_stock') as any).insert({
              branch_id: defaultBranchId,
              variant_id: item.variant_id,
              quantity: Math.max(0, -qtyDiff),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      showToast('success', 'تم تعديل الفاتورة بنجاح', `تم حفظ التعديلات وتحديث التاريخ والمخزون للفاتورة #${sale.invoice_number}`);
      onInvoiceUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'فشل تعديل الفاتورة', err.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`تعديل الفاتورة #${sale?.invoice_number || ''}`}
      maxWidth="2xl"
    >
      <div className="space-y-5 text-right font-sans text-xs select-none" dir="rtl">
        {/* Top Header Card */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="font-bold text-slate-200 block text-sm">
                تعديل عناصر وبيانات الفاتورة
              </span>
              <span className="text-[10px] text-slate-400">
                رقم الفاتورة الأصلي: #{sale?.invoice_number}
              </span>
            </div>
          </div>
          <Badge variant="primary" size="sm">
            رقم الفاتورة: #{sale?.invoice_number}
          </Badge>
        </div>

        {/* Customer, Date/Time & Payment Method Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>العميل:</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="">عميل نقدي عام (افتراضي)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>تاريخ ووقت إصدار الفاتورة:</span>
            </label>
            <Input
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>طريقة الدفع:</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="cash">نقداً (Cash)</option>
              <option value="card">بطاقة / فيزا (Card)</option>
              <option value="split">دفع مجزأ</option>
              <option value="wallet">محفظة إلكترونية</option>
            </select>
          </div>
        </div>

        {/* Product Search Bar to Add items */}
        <div className="relative">
          <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>إضافة منتج آخر للفاتورة:</span>
          </label>
          <div className="relative">
            <Input
              placeholder="ابحث بالاسم، الباركود أو SKU لإضافة أصناف لهذه الفاتورة..."
              value={searchQuery}
              onChange={(e) => handleSearchVariants(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searching && (
            <div className="absolute z-20 top-full mt-1 right-0 left-0 bg-slate-900 border border-slate-700 p-2 text-center text-slate-400 rounded-lg shadow-xl">
              جاري البحث...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="absolute z-30 top-full mt-1 right-0 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800">
              {searchResults.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleAddVariantToInvoice(v)}
                  className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <span className="font-bold text-slate-200">{v.products?.name_ar}</span>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>اللون: {v.colors?.name_ar || 'عام'}</span>
                      <span>المقاس: {v.sizes?.code || 'Std'}</span>
                      <span>SKU: {v.sku || '-'}</span>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="font-bold text-emerald-400">
                      {Number(v.selling_price || v.products?.base_price || 0).toFixed(2)} ج.م
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      المخزون: {v.branch_variant_stock?.[0]?.quantity || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoice Items Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          <div className="bg-slate-900 p-2.5 font-bold text-slate-300 flex items-center justify-between border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              أصناف الفاتورة ({items.length})
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              يمكنك تعديل الكمية، السعر والخصم أو إزالة صنف
            </span>
          </div>

          {items.length === 0 ? (
            <div className="p-6 text-center text-slate-500">لا توجد أصناف في هذه الفاتورة حالياً</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">اسم المنتج / المواصفة</th>
                    <th className="p-2.5 w-32 text-center">الكمية</th>
                    <th className="p-2.5 w-28">سعر الوحدة</th>
                    <th className="p-2.5 w-24">خصم الصنف</th>
                    <th className="p-2.5 w-28 text-left">إجمالي الصنف</th>
                    <th className="p-2.5 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => {
                    const lineTotal = (item.unitPrice * item.quantity) - item.discountAmount;
                    const hasMinPriceWarning = item.minSellingPrice > 0 && item.unitPrice < item.minSellingPrice;

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-200 block">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.colorName} | {item.sizeCode} | {item.sku}
                          </span>
                          {item.minSellingPrice > 0 && (
                            <span className="text-[9px] text-amber-400/90 block mt-0.5">
                              أقل سعر بيع مسموح: {item.minSellingPrice} ج.م
                            </span>
                          )}
                        </td>

                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(idx, -1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <Input
                              type="number"
                              min="1"
                              value={item.quantity.toString()}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="text-center font-mono py-1 px-1 h-7 text-xs bg-slate-900 w-12"
                            />

                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(idx, 1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.unitPrice.toString()}
                            onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={`text-center font-mono py-1 px-1.5 h-8 text-xs bg-slate-900 ${
                              hasMinPriceWarning ? 'border-red-500 text-red-400' : ''
                            }`}
                          />
                        </td>

                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.discountAmount.toString()}
                            onChange={(e) => handleUpdateItem(idx, 'discountAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="text-center font-mono py-1 px-1.5 h-8 text-xs bg-slate-900 text-amber-300"
                          />
                        </td>

                        <td className="p-2.5 text-left font-mono font-bold text-emerald-400 text-xs">
                          {Math.max(0, lineTotal).toFixed(2)} ج.م
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invoice Summary & Totals Adjustment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          {/* Notes & Invoice Discount inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">خصم كلي على الفاتورة (ج.م):</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={invoiceDiscount.toString()}
                onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="font-mono text-amber-400 bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">ملاحظات الفاتورة:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أضف ملاحظات أو تفاصيل التعديل..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs resize-none"
              />
            </div>
          </div>

          {/* Financial Calculation Box */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>مجموع الأجزاء (Subtotal):</span>
              <span>{itemsSubtotal.toFixed(2)} ج.م</span>
            </div>

            {invoiceDiscount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>خصم الفاتورة:</span>
                <span>-{invoiceDiscount.toFixed(2)} ج.م</span>
              </div>
            )}

            <div className="flex justify-between text-slate-400">
              <span>ضريبة المبيعات ({taxRate}%):</span>
              <span>+{computedTaxAmount.toFixed(2)} ج.م</span>
            </div>

            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm text-emerald-400">
              <span>الصافي النهائي الإجمالي:</span>
              <span>{computedTotalAmount.toFixed(2)} ج.م</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">المبلغ المدفوع:</span>
                <Input
                  type="number"
                  step="1"
                  value={paidAmount.toString()}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="h-7 py-0 font-mono text-xs text-center bg-slate-900"
                />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block font-sans">المتبقي / الباقي:</span>
                <span className="font-bold text-indigo-300 block mt-1">{changeAmount.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSaveInvoice}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-6 font-bold"
          >
            {loading ? (
              <span>جاري حفظ التعديلات...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ تعديلات الفاتورة</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
