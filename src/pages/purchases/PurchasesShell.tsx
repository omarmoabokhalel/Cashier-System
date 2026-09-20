import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import {
  ShoppingBag,
  Search,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  DollarSign,
  PackageCheck,
  FileText,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  purchase_number: string;
  supplier_id: string;
  suppliers?: { name_ar: string };
  status: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  purchase_items?: any[];
}

export const PurchasesShell: React.FC = () => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New PO Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<Array<{ variantId: string; qty: number; unitCost: number }>>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Receive Shipment Modal State
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receiveFormItems, setReceiveFormItems] = useState<Array<{ variantId: string; productName: string; sizeCode: string; qty: number; unitCost: number }>>([]);
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [{ data: poData }, { data: suppData }, { data: varData }] = await Promise.all([
        supabase
          .from('purchases')
          .select(`
            id, purchase_number, supplier_id, status, total_amount, paid_amount, created_at,
            suppliers(name_ar),
            purchase_items(
              id, variant_id, quantity_ordered, quantity_received, unit_cost_price, total_cost,
              product_variants(sku, sizes(code), colors(name_ar), products(name_ar))
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, name_ar').eq('is_active', true),
        supabase
          .from('product_variants')
          .select('id, sku, cost_price, selling_price, sizes(code), colors(name_ar), products(name_ar)')
          .eq('is_active', true)
          .limit(30),
      ]);

      setPurchases(poData || []);
      setSuppliers(suppData || []);
      setVariants(varData || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addPoItem = (variantId: string) => {
    const v = variants.find((item) => item.id === variantId);
    if (!v) return;

    setPoItems((prev) => {
      const existing = prev.find((i) => i.variantId === variantId);
      if (existing) {
        return prev.map((i) => (i.variantId === variantId ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { variantId, qty: 1, unitCost: Number(v.cost_price || 50) }];
    });
  };

  const calculatePoTotal = () => poItems.reduce((acc, i) => acc + i.qty * i.unitCost, 0);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poItems.length === 0) {
      showToast('warning', 'بيانات ناقصة', 'يرجى اختيار المورد وإضافة صنف واحد على الأقل');
      return;
    }

    setIsCreating(true);
    try {
      const branchId = '00000000-0000-0000-0000-000000000001';
      const totalAmt = calculatePoTotal();
      const poNum = `PO-${Date.now().toString().slice(-6)}`;

      const { data: po, error: poErr }: { data: any; error: any } = await (supabase.from('purchases') as any)
        .insert({
          purchase_number: poNum,
          supplier_id: selectedSupplierId,
          branch_id: branchId,
          status: 'ordered',
          total_amount: totalAmt,
          paid_amount: totalAmt,
        })
        .select()
        .single();

      if (poErr) {
        showToast('error', 'فشل إنشاء أمر الشراء', poErr.message);
      } else {
        const itemsPayload = poItems.map((i) => ({
          purchase_id: po.id,
          variant_id: i.variantId,
          quantity_ordered: i.qty,
          unit_cost_price: i.unitCost,
          total_cost: i.qty * i.unitCost,
        }));

        await (supabase.from('purchase_items') as any).insert(itemsPayload);

        showToast('success', 'تم إنشاء أمر الشراء!', poNum);
        setIsModalOpen(false);
        setPoItems([]);
        fetchInitialData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ في عملية الإنشاء', e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPo(po);
    const formItems = (po.purchase_items || []).map((pi: any) => ({
      variantId: pi.variant_id,
      productName: pi.product_variants?.products?.name_ar || 'منتج',
      sizeCode: pi.product_variants?.sizes?.code || 'N/A',
      qty: pi.quantity_ordered,
      unitCost: Number(pi.unit_cost_price),
    }));
    setReceiveFormItems(formItems);
  };

  const handleConfirmReceive = async () => {
    if (!receivingPo) return;

    setIsReceiving(true);
    try {
      const receivedItemsPayload = receiveFormItems.map((i) => ({
        variant_id: i.variantId,
        quantity_received: i.qty,
        unit_cost_price: i.unitCost,
      }));

      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_receive_purchase', {
        p_purchase_id: receivingPo.id,
        p_received_items: receivedItemsPayload,
      });

      if (error) {
        showToast('error', 'فشل استلام الشحنة', error.message);
      } else {
        showToast('success', 'تم استلام الشحنة وتحديث المخزون ومتوسط التكلفة بنجاح!');
        setReceivingPo(null);
        fetchInitialData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ في عملية الاستلام', e.message);
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-400" />
            <span>أوامر الشراء والشحنات الواردة</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إنشاء فواتير الشراء، متابعة الموردين واستلام الشحنات وتحديث متوسط تكلفة البضاعة
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} variant="primary" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
          <Plus className="w-4 h-4" />
          <span>إنشاء أمر شراء جديد</span>
        </Button>
      </div>

      {/* PURCHASES LIST */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-800/60 rounded-2xl animate-pulse" />)
        ) : purchases.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-bold">لا توجد أمر شراء مسجلة حالياً</p>
          </Card>
        ) : (
          purchases.map((po) => (
            <Card key={po.id} className="p-4 bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-mono text-sm">#{po.purchase_number}</span>
                  <Badge variant={po.status === 'received' ? 'primary' : 'secondary'} size="sm">
                    {po.status === 'received' ? 'مستلمة بالكامل' : 'قيد الانتظار'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>المورد: <strong className="text-slate-200">{po.suppliers?.name_ar || 'عام'}</strong></span>
                  <span>التاريخ: {new Date(po.created_at).toLocaleDateString('ar-SA')}</span>
                  <span>عدد الأصناف: {po.purchase_items?.length || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">إجمالي أمر الشراء</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {Number(po.total_amount).toFixed(2)} ج.م
                  </span>
                </div>

                {po.status !== 'received' ? (
                  <Button
                    onClick={() => openReceiveModal(po)}
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>استلام الشحنة</span>
                  </Button>
                ) : (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/40">
                    <CheckCircle2 className="w-4 h-4" /> تم الإضافة للمخزون
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* CREATE PO DIALOG */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إنشاء أمر شراء جديد" maxWidth="md">
        <form onSubmit={handleCreatePo} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اختر المورد *</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="">-- حدد المورد --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">إضافة أصناف للشراء</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addPoItem(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- اختر منتج لإضافته --</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.products?.name_ar} ({v.sizes?.code} • {v.colors?.name_ar})
                </option>
              ))}
            </select>
          </div>

          {/* Selected PO Items */}
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {poItems.map((item) => {
              const v = variants.find((i) => i.id === item.variantId);
              return (
                <div key={item.variantId} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-100 block">{v?.products?.name_ar} ({v?.sizes?.code})</span>
                    <span className="text-[10px] text-slate-400">التكلفة الإجمالية: {(item.qty * item.unitCost).toFixed(2)} ج.م</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => {
                        const q = parseInt(e.target.value) || 1;
                        setPoItems((prev) => prev.map((i) => (i.variantId === item.variantId ? { ...i, qty: q } : i)));
                      }}
                      className="w-16 text-center font-mono h-7 text-xs font-bold"
                    />
                    <Input
                      type="number"
                      step="0.5"
                      min={0}
                      value={item.unitCost}
                      onChange={(e) => {
                        const c = parseFloat(e.target.value) || 0;
                        setPoItems((prev) => prev.map((i) => (i.variantId === item.variantId ? { ...i, unitCost: c } : i)));
                      }}
                      className="w-20 text-center font-mono h-7 text-xs font-bold"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
            <span>إجمالي أمر الشراء:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{calculatePoTotal().toFixed(2)} ج.م</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isCreating} variant="primary" className="bg-indigo-600 hover:bg-indigo-500">
              حفظ وتأكيد الطلب
            </Button>
          </div>
        </form>
      </Dialog>

      {/* RECEIVE SHIPMENT DIALOG */}
      <Dialog isOpen={!!receivingPo} onClose={() => setReceivingPo(null)} title="تأكيد استلام الشحنة الواردة" maxWidth="md">
        <div className="space-y-4 font-sans" dir="rtl">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
            <span>رقم الشحنة: <strong className="font-mono text-indigo-400">#{receivingPo?.purchase_number}</strong></span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {receiveFormItems.map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-100">{item.productName} ({item.sizeCode})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">الكمية المستلمة:</span>
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => {
                      const q = parseInt(e.target.value) || 1;
                      setReceiveFormItems((prev) => prev.map((i, iIdx) => (iIdx === idx ? { ...i, qty: q } : i)));
                    }}
                    className="w-20 text-center font-mono h-7 text-xs font-bold"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleConfirmReceive} isLoading={isReceiving} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500">
            تأكيد استلام الشحنة وتحديث المخزون
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
