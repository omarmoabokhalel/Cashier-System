import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { ProductFormModal } from '../../components/products/ProductFormModal';
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
  Pencil,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

import { useAuthStore } from '../../store/useAuthStore';

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
  notes?: string | null;
}

export const PurchasesShell: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New PO Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [handlerName, setHandlerName] = useState('');
  const [poItems, setPoItems] = useState<Array<{ variantId: string; qty: number; unitCost: number }>>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Edit PO Modal State
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    supplierId: '',
    handlerName: '',
    totalAmount: '',
    createdAt: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete PO State
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeletingPo, setIsDeletingPo] = useState(false);

  useEffect(() => {
    const defaultName = user?.fullName || localStorage.getItem('admin_display_name') || '';
    setHandlerName(defaultName);
  }, [user]);

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
      const [poRes, suppRes, varRes] = await Promise.all([
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
          .order('created_at', { ascending: false }),
      ]);

      if (poRes.error) console.warn('Purchases query note:', poRes.error.message);
      if (suppRes.error) console.warn('Suppliers query note:', suppRes.error.message);
      if (varRes.error) console.warn('Variants query note:', varRes.error.message);

      const activeVariants = (varRes.data || []).filter(
        (pv: any) => pv && pv.products && (!pv.deleted_at) && (!pv.products.deleted_at)
      );

      setPurchases(poRes.data || []);
      setSuppliers(suppRes.data || []);
      setVariants(activeVariants);
    } catch (e: any) {
      console.error('fetchInitialData error:', e);
      showToast('error', 'فشل تحميل بيانات المشتريات', e.message);
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
    if (!handlerName.trim()) {
      showToast('warning', 'اسم المستلم مطلوب', 'يرجى إدخال اسم الشخص المسؤول عن الشراء (إجباري)');
      return;
    }
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
          notes: `مسؤول الشراء: ${handlerName.trim()}`,
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

  const handleOpenEditPo = (po: PurchaseOrder) => {
    setEditingPo(po);
    const d = new Date(po.created_at);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    let extractedHandler = '';
    if (po.notes && po.notes.includes('مسؤول الشراء:')) {
      extractedHandler = po.notes.replace('مسؤول الشراء:', '').trim();
    } else {
      extractedHandler = user?.fullName || localStorage.getItem('admin_display_name') || '';
    }

    setEditFormData({
      supplierId: po.supplier_id || '',
      handlerName: extractedHandler,
      totalAmount: String(po.total_amount || 0),
      createdAt: localISO,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPo) return;
    if (!editFormData.handlerName.trim()) {
      showToast('warning', 'اسم المستلم مطلوب', 'يرجى إدخال اسم المسؤول عن الشراء (إجباري)');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updatedDate = editFormData.createdAt
        ? new Date(editFormData.createdAt).toISOString()
        : editingPo.created_at;
      const totalAmt = parseFloat(editFormData.totalAmount) || editingPo.total_amount;

      const { error } = await (supabase.from('purchases') as any)
        .update({
          supplier_id: editFormData.supplierId || editingPo.supplier_id,
          total_amount: totalAmt,
          paid_amount: totalAmt,
          created_at: updatedDate,
          notes: `مسؤول الشراء: ${editFormData.handlerName.trim()}`,
        })
        .eq('id', editingPo.id);

      if (error) {
        showToast('error', 'فشل تعديل أمر الشراء', error.message);
      } else {
        showToast('success', 'تم تعديل أمر الشراء بنجاح!');
        setIsEditModalOpen(false);
        setEditingPo(null);
        fetchInitialData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء التعديل', e.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDeletePo = async () => {
    if (!poToDelete) return;
    setIsDeletingPo(true);
    try {
      await (supabase.from('purchase_items') as any).delete().eq('purchase_id', poToDelete.id);
      const { error } = await (supabase.from('purchases') as any).delete().eq('id', poToDelete.id);

      if (error) {
        showToast('error', 'فشل مسح أمر الشراء', error.message);
      } else {
        showToast('success', 'تم مسح أمر الشراء بنجاح');
        setPoToDelete(null);
        fetchInitialData();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء المسح', e.message);
    } finally {
      setIsDeletingPo(false);
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

                <div className="flex items-center gap-2">
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

                  <Button
                    onClick={() => handleOpenEditPo(po)}
                    size="sm"
                    variant="secondary"
                    className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 gap-1 text-[11px] px-2.5 py-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                    <span>تعديل</span>
                  </Button>

                  <Button
                    onClick={() => setPoToDelete(po)}
                    size="sm"
                    variant="secondary"
                    className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-200 gap-1 text-[11px] px-2.5 py-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* CREATE PO DIALOG */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إنشاء أمر شراء جديد" maxWidth="md">
        <form onSubmit={handleCreatePo} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الشخص المسؤول / المستلم للشحنة * (إجباري)</label>
            <Input
              type="text"
              placeholder="أدخل اسم الشخص المستلم..."
              value={handlerName}
              onChange={(e) => setHandlerName(e.target.value)}
              required
              autoFocus
            />
          </div>

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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">إضافة أصناف للشراء</label>
              <button
                type="button"
                onClick={() => setIsProductFormOpen(true)}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-800/40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إضافة منتج جديد غير موجود</span>
              </button>
            </div>
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
                  {v.products?.name_ar} {v.sizes?.code ? `(${v.sizes.code} • ${v.colors?.name_ar || 'عام'})` : ''}
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

      {/* QUICK PRODUCT FORM MODAL */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        isFromPurchaseOrder={true}
        onSaved={async () => {
          setIsProductFormOpen(false);
          try {
            const { data: varData } = await (supabase.from('product_variants') as any)
              .select('id, sku, cost_price, selling_price, sizes(code), colors(name_ar), products(name_ar)')
              .eq('is_active', true)
              .order('created_at', { ascending: false });

            const activeVariants = (varData || []).filter(
              (pv: any) => pv && pv.products && (!pv.deleted_at) && (!pv.products.deleted_at)
            );
            setVariants(activeVariants);

            if (activeVariants.length > 0) {
              const newestVariant = activeVariants[0];
              addPoItem(newestVariant.id);
              showToast(
                'success',
                'تم إنشاء المنتج وإضافته لأمر الشراء!',
                `تمت إضافة "${newestVariant.products?.name_ar}" لأمر الشراء (المخزون الحالي: 0 قطعة حتى تأكيد الاستلام)`
              );
            }
          } catch (e: any) {
            console.error(e);
          }
        }}
      />

      {/* EDIT PO DIALOG */}
      <Dialog isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="تعديل أمر الشراء" maxWidth="md">
        <form onSubmit={handleUpdatePo} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">تاريخ ووقت إصدرا أمر الشراء (تعديل التاريخ)</label>
            <Input
              type="datetime-local"
              value={editFormData.createdAt}
              onChange={(e) => setEditFormData({ ...editFormData, createdAt: e.target.value })}
              className="bg-slate-950 border-slate-800 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الشخص المسؤول / المستلم * (إجباري)</label>
            <Input
              type="text"
              placeholder="اسم المسؤول..."
              value={editFormData.handlerName}
              onChange={(e) => setEditFormData({ ...editFormData, handlerName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المورد</label>
            <select
              value={editFormData.supplierId}
              onChange={(e) => setEditFormData({ ...editFormData, supplierId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">إجمالي أمر الشراء (ج.م)</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={editFormData.totalAmount}
              onChange={(e) => setEditFormData({ ...editFormData, totalAmount: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSubmittingEdit} variant="primary" className="bg-indigo-600 hover:bg-indigo-500">
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CONFIRM DELETE PO DIALOG */}
      <ConfirmDialog
        isOpen={!!poToDelete}
        onClose={() => setPoToDelete(null)}
        onConfirm={handleConfirmDeletePo}
        title="تأكيد مسح أمر الشراء"
        message={`هل أنت تأكد من مسح أمر الشراء رقم (#${poToDelete?.purchase_number}) بقيمة ${Number(poToDelete?.total_amount).toFixed(2)} ج.م؟`}
        confirmText="حذف أمر الشراء"
        cancelText="إلغاء"
        isLoading={isDeletingPo}
        variant="danger"
      />
    </div>
  );
};
