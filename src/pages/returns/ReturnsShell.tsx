import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { reconcileShiftTotals } from '../../utils/shiftReconciliation';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Tag,
  Plus,
  Minus,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';

interface ReturnItemForm {
  saleItemId: string;
  variantId: string;
  productNameAr: string;
  sizeCode: string;
  colorNameAr: string;
  unitPrice: number;
  purchasedQty: number;
  alreadyReturnedQty: number;
  returnableQty: number;
  requestedQty: number;
}

export const ReturnsShell: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemForm[]>([]);

  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'store_credit'>('cash');
  const [reason, setReason] = useState('طلب العميل إرجاع المنتجات');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReturn, setCompletedReturn] = useState<any | null>(null);

  // Live Autocomplete Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const pendingNum = localStorage.getItem('selected_return_invoice_number');
    if (pendingNum) {
      localStorage.removeItem('selected_return_invoice_number');
      setSearchQuery(pendingNum);
      const autoFetch = async () => {
        try {
          const { data } = await supabase
            .from('sales')
            .select(`
              id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, created_at,
              customers(full_name, phone),
              sale_items(
                id, variant_id, quantity, returned_quantity, unit_price, cost_price, discount_amount, total_price,
                product_variants(
                  sku, barcode,
                  sizes(code, name_ar),
                  colors(name_ar, hex_code),
                  products(name_ar, name_en)
                )
              )
            `)
            .eq('invoice_number', pendingNum)
            .maybeSingle();

          if (data) {
            selectSale(data);
          }
        } catch (e) {
          console.error(e);
        }
      };
      autoFetch();
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
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
            id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, created_at,
            customers(full_name, phone),
            sale_items(
              id, variant_id, quantity, returned_quantity, unit_price, cost_price, discount_amount, total_price,
              product_variants(
                sku, barcode,
                sizes(code, name_ar),
                colors(name_ar, hex_code),
                products(name_ar, name_en)
              )
            )
          `)
          .or(`invoice_number.ilike.%${q}%,customers.full_name.ilike.%${q}%,customers.phone.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(6);

        let filteredSuggestions = data || [];
        if (user?.roleCode === 'cashier') {
          filteredSuggestions = filteredSuggestions.filter((s: any) => {
            if (s.notes && (s.notes.includes('role:owner') || s.notes.includes('role:admin'))) return false;
            return true;
          });
        }

        if (filteredSuggestions && filteredSuggestions.length > 0) {
          setSuggestions(filteredSuggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (e) {
        console.error('Error fetching invoice suggestions:', e);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search Invoices by Invoice Number or Phone
  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSalesList([]);
    setSelectedSale(null);

    try {
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, invoice_number, subtotal, tax_amount, total_amount, paid_amount, created_at, notes,
          customers(full_name, phone),
          sale_items(
            id, variant_id, quantity, returned_quantity, unit_price, cost_price, discount_amount, total_price,
            product_variants(
              sku, barcode,
              sizes(code, name_ar),
              colors(name_ar, hex_code),
              products(name_ar, name_en)
            )
          )
        `)
        .or(`invoice_number.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      let filteredData = data || [];
      if (user?.roleCode === 'cashier') {
        filteredData = filteredData.filter((s: any) => {
          if (s.notes && (s.notes.includes('role:owner') || s.notes.includes('role:admin'))) return false;
          return true;
        });
      }

      if (error) {
        showToast('error', 'فشل البحث', error.message);
      } else if (!filteredData || filteredData.length === 0) {
        showToast('warning', 'غير موجود', 'لم يتم العثور على فاتورة مطابقة لرقم البحث');
      } else {
        setSalesList(filteredData);
        if (filteredData.length === 1) {
          selectSale(filteredData[0]);
        }
      }
    } catch (e: any) {
      showToast('error', 'خطأ في عملية البحث', e.message);
    } finally {
      setSearching(false);
    }
  };

  const selectSale = (sale: any) => {
    setSelectedSale(sale);
    const itemsForm: ReturnItemForm[] = (sale.sale_items || []).map((si: any) => {
      const returnable = si.quantity - (si.returned_quantity || 0);
      const effectiveUnitPrice = si.quantity > 0
        ? Number(si.unit_price) - (Number(si.discount_amount || 0) / si.quantity)
        : Number(si.unit_price);
      const maxReturnable = Math.max(0, returnable);
      return {
        saleItemId: si.id,
        variantId: si.variant_id,
        productNameAr: si.product_variants?.products?.name_ar || 'منتج',
        sizeCode: si.product_variants?.sizes?.code || 'N/A',
        colorNameAr: si.product_variants?.colors?.name_ar || 'عام',
        unitPrice: Math.max(0, effectiveUnitPrice),
        purchasedQty: si.quantity,
        alreadyReturnedQty: si.returned_quantity || 0,
        returnableQty: maxReturnable,
        requestedQty: maxReturnable, // Default to full returnable quantity
      };
    });
    setReturnItems(itemsForm);
  };

  const updateItemReturnQty = (saleItemId: string, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.saleItemId === saleItemId) {
          const validQty = Math.max(0, Math.min(item.returnableQty, qty));
          return { ...item, requestedQty: validQty };
        }
        return item;
      })
    );
  };

  const handleReturnAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({
        ...item,
        requestedQty: item.returnableQty,
      }))
    );
    showToast('info', 'تم تحديد كافة الأصناف المتاحة للإرجاع', 'تم ضبط كميات جميع أصناف الفاتورة بالكامل');
  };

  const handleClearAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({
        ...item,
        requestedQty: 0,
      }))
    );
    showToast('info', 'تم تصفير الكميات', 'قم بإدخال وتحديد الأصناف والكميات المراد إرجاعها مخصصاً');
  };

  const toggleItemSelection = (saleItemId: string) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.saleItemId === saleItemId) {
          const newQty = item.requestedQty > 0 ? 0 : item.returnableQty;
          return { ...item, requestedQty: newQty };
        }
        return item;
      })
    );
  };

  const adjustItemQty = (saleItemId: string, delta: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.saleItemId === saleItemId) {
          const newQty = Math.max(0, Math.min(item.returnableQty, item.requestedQty + delta));
          return { ...item, requestedQty: newQty };
        }
        return item;
      })
    );
  };

  const totalRefundAmount = returnItems.reduce((acc, item) => acc + item.requestedQty * item.unitPrice, 0);
  const totalReturnQty = returnItems.reduce((acc, item) => acc + item.requestedQty, 0);

  const handleProcessReturn = async () => {
    if (!selectedSale || totalReturnQty === 0) {
      showToast('warning', 'لا توجد أصناف', 'يرجى تحديد كمية إرجاع لصنف واحد على الأقل');
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

      const itemsPayload = returnItems
        .filter((item) => item.requestedQty > 0)
        .map((item) => ({
          sale_item_id: item.saleItemId,
          quantity: item.requestedQty,
        }));

      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_process_return', {
        p_original_sale_id: selectedSale.id,
        p_cashier_shift_id: shiftId,
        p_refund_method: refundMethod,
        p_reason: reason,
        p_items: itemsPayload,
      });

      if (error) {
        showToast('error', 'فشلت عملية الإرجاع', error.message);
      } else {
        showToast('success', 'تم الإرجاع بنجاح!', `رقم المستند: ${data?.return_number}`);
        reconcileShiftTotals(shiftId).catch(console.error);
        setCompletedReturn({
          returnNumber: data?.return_number,
          refundAmount: data?.refund_amount,
          invoiceNumber: selectedSale.invoice_number,
          itemsCount: itemsPayload.length,
          refundMethod,
        });

        // Reset view
        setSelectedSale(null);
        setReturnItems([]);
        setSalesList([]);
        setSearchQuery('');
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء تنفيذ الإرجاع', e.message);
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
            <RotateCcw className="w-6 h-6 text-rose-400" />
            <span>إدارة المرتجعات</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            البحث عن الفواتير الأصلية ومعالجة المرتجعات الكلية والجزئية واسترداد المبالغ
          </p>
        </div>
      </div>

      {/* SEARCH BAR CARD */}
      <Card className="p-4 bg-slate-900 border-slate-800 relative z-30">
        <form onSubmit={handleSearchInvoice} className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="أدخل رقم الفاتورة (مثال: INV-2026-000001) أو اسم/هاتف العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                      setSearchQuery(s.invoice_number);
                      setShowSuggestions(false);
                      selectSale(s);
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
                      <span className="text-[10px] text-indigo-300 font-semibold">اضغط للاستدعاء</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" isLoading={searching} variant="primary" className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-2">
            <Search className="w-4 h-4" />
            <span>بحث عن الفاتورة</span>
          </Button>
        </form>
      </Card>

      {/* SEARCH RESULTS SELECTION (If multiple) */}
      {salesList.length > 1 && !selectedSale && (
        <Card className="p-4 space-y-3 bg-slate-900 border-slate-800">
          <h4 className="text-xs font-bold text-slate-300">نتائج البحث ({salesList.length} فواتير)</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {salesList.map((s) => (
              <div
                key={s.id}
                onClick={() => selectSale(s)}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-rose-500/50 cursor-pointer flex justify-between items-center text-xs transition-all"
              >
                <div>
                  <span className="font-bold text-slate-100 font-mono">{s.invoice_number}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    العميل: {s.customers?.full_name || 'نقدي عام'} - {new Date(s.created_at).toLocaleDateString('ar-SA')}
                  </span>
                </div>
                <div className="text-left">
                  <span className="font-bold text-emerald-400 font-mono text-sm block">
                    {Number(s.total_amount).toFixed(2)} ج.م
                  </span>
                  <span className="text-[10px] text-slate-500">{s.sale_items?.length} أصناف</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SELECTED INVOICE DETAILS & RETURN FORM */}
      {selectedSale ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: ITEMS TABLE */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">تفاصيل الفاتورة #{selectedSale.invoice_number}</h3>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSelectedSale(null)}>
                  تغيير الفاتورة
                </Button>
              </div>

              {/* QUICK BATCH ACTIONS BAR */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                <span className="font-bold text-slate-300">خيارات التحديد السريع للأصناف:</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleReturnAll}
                    size="sm"
                    variant="secondary"
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs gap-1.5 px-3 py-1 font-bold"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>إرجاع الفاتورة بالكامل (الكل)</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClearAll}
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs gap-1.5 px-3 py-1 font-bold"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>تصفير الكميات (إلغاء التحديد)</span>
                  </Button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 px-2 text-center w-10">تحديد</th>
                      <th className="py-2 px-2">الصنف</th>
                      <th className="py-2 px-2 text-center">المقاس / اللون</th>
                      <th className="py-2 px-2 text-center">السعر الصافي</th>
                      <th className="py-2 px-2 text-center">المشتراة</th>
                      <th className="py-2 px-2 text-center">المعادة سابقاً</th>
                      <th className="py-2 px-2 text-center">المتاحة للإرجاع</th>
                      <th className="py-2 px-2 text-center w-36">كمية الإرجاع المطلوبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {returnItems.map((item) => {
                      const isSelected = item.requestedQty > 0;
                      return (
                        <tr key={item.saleItemId} className={`transition-colors ${isSelected ? 'bg-rose-950/20' : 'hover:bg-slate-950/40'}`}>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={item.returnableQty <= 0}
                              onChange={() => toggleItemSelection(item.saleItemId)}
                              className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-2 font-bold text-slate-100">{item.productNameAr}</td>
                          <td className="py-2.5 px-2 text-center text-slate-300">
                            {item.sizeCode} • {item.colorNameAr}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-200">
                            {item.unitPrice.toFixed(2)} ج.م
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">{item.purchasedQty}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-amber-400">
                            {item.alreadyReturnedQty}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-400">
                            {item.returnableQty}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                              <button
                                type="button"
                                onClick={() => adjustItemQty(item.saleItemId, -1)}
                                disabled={item.requestedQty <= 0 || item.returnableQty <= 0}
                                className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-200 font-bold transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <Input
                                type="number"
                                min={0}
                                max={item.returnableQty}
                                disabled={item.returnableQty <= 0}
                                value={item.requestedQty}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateItemReturnQty(item.saleItemId, parseInt(e.target.value) || 0)}
                                className="w-14 text-center font-mono h-7 text-xs font-black p-0 border-0 bg-transparent focus:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => adjustItemQty(item.saleItemId, 1)}
                                disabled={item.requestedQty >= item.returnableQty || item.returnableQty <= 0}
                                className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-200 font-bold transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: REFUND SUMMARY & SUBMIT */}
          <div className="space-y-4">
            <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                ملخص عملية الإرجاع
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">طريقة الاسترداد</label>
                  <select
                    value={refundMethod}
                    onChange={(e: any) => setRefundMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-rose-500"
                  >
                    <option value="cash">استرداد نقدي (Cash)</option>
                    <option value="card">إرجاع للبطاقة (Card Refund)</option>
                    <option value="store_credit">رصيد متجر / قسيمة شرائية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">سبب الإرجاع</label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>عدد القطع المراد إرجاعها:</span>
                    <span className="font-bold text-slate-200">{totalReturnQty} قطعة</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                    <span>المبلغ المسترد للعميل:</span>
                    <span className="font-mono text-rose-400">{totalRefundAmount.toFixed(2)} ج.م</span>
                  </div>
                </div>

                <Button
                  onClick={handleProcessReturn}
                  isLoading={isSubmitting}
                  disabled={totalReturnQty === 0}
                  size="lg"
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 text-sm shadow-xl"
                >
                  تأكيد الإرجاع وإصدار السند
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {/* COMPLETED RETURN SUMMARY DIALOG */}
      <Dialog
        isOpen={!!completedReturn}
        onClose={() => setCompletedReturn(null)}
        title="تمت عملية الإرجاع بنجاح"
        maxWidth="sm"
      >
        {completedReturn && (
          <div className="space-y-4 font-sans text-center" dir="rtl">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">سند إرجاع رقم #{completedReturn.returnNumber}</h3>
              <p className="text-xs text-slate-400 mt-1">مرتبط بالفاتورة الأصلية: {completedReturn.invoiceNumber}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>المبلغ المسترد:</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  {Number(completedReturn.refundAmount).toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>طريقة الاسترداد:</span>
                <span>
                  {completedReturn.refundMethod === 'cash' ? 'نقداً' : completedReturn.refundMethod === 'card' ? 'بطاقة' : 'رصيد متجر'}
                </span>
              </div>
            </div>

            <Button onClick={() => setCompletedReturn(null)} className="w-full">
              إغلاق
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
};
