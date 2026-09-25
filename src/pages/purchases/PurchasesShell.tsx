import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';

// Modals
import { NewProductCardModal } from '../../components/purchases/NewProductCardModal';
import { PurchaseInvoicePrintModal, PurchaseInvoiceData } from '../../components/purchases/PurchaseInvoicePrintModal';
import { SupplierFormModal, Supplier } from '../../components/suppliers/SupplierFormModal';

import {
  ShoppingBag,
  Search,
  Plus,
  Truck,
  CheckCircle2,
  PackageCheck,
  FileText,
  Pencil,
  Trash2,
  Printer,
  DollarSign,
  Barcode,
  Users,
  Edit3,
  Calendar,
  Layers,
  ArrowRight,
  UserPlus,
  UserCheck,
} from 'lucide-react';

interface PurchaseOrderRecord {
  id: string;
  purchase_number: string;
  supplier_id: string;
  suppliers?: { id?: string; name_ar: string; company_name?: string; phone?: string };
  status: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  notes?: string | null;
  purchase_items?: any[];
}

interface ProductVariantOption {
  id: string;
  sku: string;
  barcode: string;
  cost_price: number;
  selling_price: number;
  min_selling_price: number;
  products?: { id: string; name_ar: string; product_code: string };
  sizes?: { code: string };
  colors?: { name_ar: string };
}

interface POItemDraft {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  wholesalePrice: number;
  sellingPrice: number;
  minSellingPrice?: number;
}

interface CashierOption {
  id: string;
  full_name: string;
}

interface PurchasesShellProps {
  initialTab?: 'orders' | 'suppliers';
}

export const PurchasesShell: React.FC<PurchasesShellProps> = ({ initialTab = 'orders' }) => {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>(initialTab);

  // Data states
  const [purchases, setPurchases] = useState<PurchaseOrderRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<ProductVariantOption[]>([]);
  const [cashiersList, setCashiersList] = useState<CashierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isProductCardModalOpen, setIsProductCardModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Supplier Delete state
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // Create Purchase Order Modal State
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poHandlerName, setPoHandlerName] = useState('');
  const [isAddingNewCashier, setIsAddingNewCashier] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [poItemsDraft, setPoItemsDraft] = useState<POItemDraft[]>([]);
  const [isSavingPo, setIsSavingPo] = useState(false);

  // Printable Invoice Modal State
  const [printablePo, setPrintablePo] = useState<PurchaseInvoiceData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Edit PO Modal State
  const [editingPo, setEditingPo] = useState<PurchaseOrderRecord | null>(null);
  const [isEditPoModalOpen, setIsEditPoModalOpen] = useState(false);
  const [editPoSupplierId, setEditPoSupplierId] = useState('');
  const [editPoHandlerName, setEditPoHandlerName] = useState('');
  const [editPoItemsDraft, setEditPoItemsDraft] = useState<POItemDraft[]>([]);
  const [isSavingEditPo, setIsSavingEditPo] = useState(false);

  // Delete PO State
  const [poToDelete, setPoToDelete] = useState<PurchaseOrderRecord | null>(null);
  const [isDeletingPo, setIsDeletingPo] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const defaultName = user?.fullName || localStorage.getItem('admin_display_name') || 'الكاشير الرئيسي';
    setPoHandlerName(defaultName);
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, suppRes, varRes, profileRes] = await Promise.all([
        supabase
          .from('purchases')
          .select(`
            id, purchase_number, supplier_id, status, total_amount, paid_amount, created_at, notes,
            suppliers(id, name_ar, company_name, phone),
            purchase_items(
              id, variant_id, quantity_ordered, quantity_received, unit_cost_price, total_cost,
              product_variants(
                id, sku, barcode, cost_price, selling_price, min_selling_price,
                products(id, name_ar, product_code),
                sizes(code), colors(name_ar)
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
        supabase
          .from('product_variants')
          .select('id, sku, barcode, cost_price, selling_price, min_selling_price, sizes(code), colors(name_ar), products(id, name_ar, product_code)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('is_active', true)
          .order('full_name'),
      ]);

      if (poRes.error) console.warn('PO fetch note:', poRes.error.message);
      if (suppRes.error) console.warn('Supplier fetch note:', suppRes.error.message);
      if (varRes.error) console.warn('Variant fetch note:', varRes.error.message);

      const activeVariants = (varRes.data || []).filter(
        (pv: any) => pv && pv.products && (!pv.deleted_at) && (!pv.products.deleted_at)
      );

      setPurchases(poRes.data || []);
      setSuppliers(suppRes.data || []);
      setVariants(activeVariants);

      if (profileRes.data && profileRes.data.length > 0) {
        setCashiersList(profileRes.data);
      } else {
        const defName = user?.fullName || 'الكاشير الرئيسي';
        setCashiersList([{ id: 'def-c', full_name: defName }]);
      }
    } catch (e: any) {
      console.error('fetchData error:', e);
      showToast('error', 'فشل تحميل بيانات المشتريات والموردين', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to add product code item to draft
  const handleSelectProductForPo = (variant: ProductVariantOption) => {
    const productName = variant.products?.name_ar || 'منتج غير مسمى';
    const sku = variant.sku || variant.products?.product_code || 'N/A';
    const cost = Number(variant.cost_price || 0);
    const selling = Number(variant.selling_price || 0);
    const minSelling = variant.min_selling_price ? Number(variant.min_selling_price) : selling;

    setPoItemsDraft((prev) => {
      const existingIdx = prev.findIndex((item) => item.variantId === variant.id);
      if (existingIdx >= 0) {
        showToast('warning', 'المنتج مضاف بالفعل', 'تم تحديد هذا المنتج مسبقاً، يمكنك تعديل كميته أسفله');
        return prev;
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku,
          productName,
          quantity: 0, // Default 0 as requested
          wholesalePrice: cost,
          sellingPrice: selling,
          minSellingPrice: minSelling,
        },
      ];
    });

    setProductSearchInput('');
    setShowProductSuggestions(false);
  };

  const calculatePoDraftTotal = (items: POItemDraft[]) =>
    items.reduce((acc, item) => acc + item.quantity * item.wholesalePrice, 0);

  // Submit Create New Purchase Order
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!poSupplierId) {
      showToast('warning', 'يرجى اختيار المورد', 'إجباري تحديد المورد لإصدار أمر الشراء');
      return;
    }
    if (!poHandlerName.trim()) {
      showToast('warning', 'اسم المستلم/الكاشير مطلوب', 'يرجى كتابة أو اختيار اسم الكاشير المسؤول');
      return;
    }
    if (poItemsDraft.length === 0) {
      showToast('warning', 'لا توجد أصناف', 'يرجى كتابة كود المنتج واختيار صنف واحد على الأقل');
      return;
    }
    const hasInvalidQty = poItemsDraft.some((item) => item.quantity <= 0);
    if (hasInvalidQty) {
      showToast('warning', 'تنبيه الكمية', 'يرجى تعديل الكمية من 0 إلى الكمية المطلوبة لشراء الأصناف');
      return;
    }

    setIsSavingPo(true);
    try {
      const branchId = '00000000-0000-0000-0000-000000000001';
      const totalAmt = calculatePoDraftTotal(poItemsDraft);
      const poNum = `PO-${Date.now().toString().slice(-6)}`;
      const selectedSupplier = suppliers.find((s) => s.id === poSupplierId);

      // 1. Create Purchase record in `purchases` table
      const { data: po, error: poErr } = await (supabase.from('purchases') as any)
        .insert({
          purchase_number: poNum,
          supplier_id: poSupplierId,
          branch_id: branchId,
          status: 'received',
          total_amount: totalAmt,
          paid_amount: totalAmt,
          notes: `مسؤول الشراء: ${poHandlerName.trim()}`,
        })
        .select()
        .single();

      if (poErr) throw poErr;

      // 2. Insert items into `purchase_items` & Update Inventory Stock + Prices
      for (const item of poItemsDraft) {
        const finalMinSelling = item.minSellingPrice !== undefined && item.minSellingPrice !== null && !isNaN(Number(item.minSellingPrice))
          ? Number(item.minSellingPrice)
          : item.sellingPrice;

        await (supabase.from('purchase_items') as any).insert({
          purchase_id: po.id,
          variant_id: item.variantId,
          quantity_ordered: item.quantity,
          quantity_received: item.quantity,
          unit_cost_price: item.wholesalePrice,
          total_cost: item.quantity * item.wholesalePrice,
        });

        // Update variant cost and selling prices if modified
        await (supabase.from('product_variants') as any)
          .update({
            cost_price: item.wholesalePrice,
            selling_price: item.sellingPrice,
            min_selling_price: finalMinSelling,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.variantId);

        // Fetch current inventory stock for branch
        const { data: curStock } = await (supabase.from('branch_variant_stock') as any)
          .select('quantity')
          .eq('branch_id', branchId)
          .eq('variant_id', item.variantId)
          .single();

        const currentQty = curStock?.quantity || 0;
        const newQty = currentQty + item.quantity;

        // Upsert stock into inventory
        await (supabase.from('branch_variant_stock') as any).upsert(
          {
            branch_id: branchId,
            variant_id: item.variantId,
            quantity: newQty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'branch_id,variant_id' }
        );
      }

      showToast(
        'success',
        'تم حفظ أمر الشراء وتحديث المخزون بنجاح!',
        `رقم أمر الشراء: ${poNum} - تمت إضافة الكميات لرصيد المخزون.`
      );

      // Prepare data for Printable Invoice
      const printInvoiceData: PurchaseInvoiceData = {
        id: po.id,
        purchase_number: poNum,
        created_at: po.created_at || new Date().toISOString(),
        supplier_name: selectedSupplier?.name_ar || 'عام',
        supplier_company: selectedSupplier?.company_name || undefined,
        supplier_phone: selectedSupplier?.phone,
        handler_name: poHandlerName,
        total_amount: totalAmt,
        status: 'received',
        items: poItemsDraft.map((i) => ({
          variant_id: i.variantId,
          product_name: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unit_cost_price: i.wholesalePrice,
          selling_price: i.sellingPrice,
          min_selling_price: i.minSellingPrice || i.sellingPrice,
          total_cost: i.quantity * i.wholesalePrice,
        })),
      };

      setIsCreatePoModalOpen(false);
      setPoItemsDraft([]);
      fetchData();

      // Automatically open printable invoice modal
      setPrintablePo(printInvoiceData);
      setIsPrintModalOpen(true);
    } catch (e: any) {
      console.error('Error creating PO:', e);
      showToast('error', 'فشل إنشاء أمر الشراء', e.message);
    } finally {
      setIsSavingPo(false);
    }
  };

  // Open Edit PO Dialog
  const handleOpenEditPo = (po: PurchaseOrderRecord) => {
    setEditingPo(po);
    setEditPoSupplierId(po.supplier_id || '');

    let extractedHandler = poHandlerName;
    if (po.notes && po.notes.includes('مسؤول الشراء:')) {
      extractedHandler = po.notes.replace('مسؤول الشراء:', '').trim();
    }
    setEditPoHandlerName(extractedHandler);

    const items: POItemDraft[] = (po.purchase_items || []).map((pi: any) => {
      const pv = pi.product_variants || {};
      return {
        variantId: pi.variant_id,
        sku: pv.sku || pv.products?.product_code || 'N/A',
        productName: pv.products?.name_ar || 'منتج',
        quantity: pi.quantity_ordered || pi.quantity_received || 1,
        wholesalePrice: Number(pi.unit_cost_price || pv.cost_price || 0),
        sellingPrice: Number(pv.selling_price || 0),
        minSellingPrice: Number(pv.min_selling_price || pv.selling_price || 0),
      };
    });
    setEditPoItemsDraft(items);
    setIsEditPoModalOpen(true);
  };

  // Update PO
  const handleUpdatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPo) return;

    setIsSavingEditPo(true);
    try {
      const totalAmt = calculatePoDraftTotal(editPoItemsDraft);

      // 1. Update purchase header
      await (supabase.from('purchases') as any)
        .update({
          supplier_id: editPoSupplierId || editingPo.supplier_id,
          total_amount: totalAmt,
          paid_amount: totalAmt,
          notes: `مسؤول الشراء: ${editPoHandlerName.trim()}`,
        })
        .eq('id', editingPo.id);

      // 2. Delete previous purchase_items and insert updated ones
      await (supabase.from('purchase_items') as any).delete().eq('purchase_id', editingPo.id);

      for (const item of editPoItemsDraft) {
        await (supabase.from('purchase_items') as any).insert({
          purchase_id: editingPo.id,
          variant_id: item.variantId,
          quantity_ordered: item.quantity,
          quantity_received: item.quantity,
          unit_cost_price: item.wholesalePrice,
          total_cost: item.quantity * item.wholesalePrice,
        });

        // Update variant prices if changed
        await (supabase.from('product_variants') as any)
          .update({
            cost_price: item.wholesalePrice,
            selling_price: item.sellingPrice,
            min_selling_price: item.minSellingPrice || item.sellingPrice,
          })
          .eq('id', item.variantId);
      }

      showToast('success', 'تم تعديل أمر الشراء بنجاح!');
      setIsEditPoModalOpen(false);
      setEditingPo(null);
      fetchData();
    } catch (e: any) {
      showToast('error', 'فشل التعديل', e.message);
    } finally {
      setIsSavingEditPo(false);
    }
  };

  // Confirm Delete PO
  const handleConfirmDeletePo = async () => {
    if (!poToDelete) return;
    setIsDeletingPo(true);
    try {
      await (supabase.from('purchase_items') as any).delete().eq('purchase_id', poToDelete.id);
      const { error } = await (supabase.from('purchases') as any).delete().eq('id', poToDelete.id);

      if (error) throw error;

      showToast('success', 'تم مسح أمر الشراء بنجاح');
      setPoToDelete(null);
      fetchData();
    } catch (e: any) {
      showToast('error', 'خطأ أثناء مسح أمر الشراء', e.message);
    } finally {
      setIsDeletingPo(false);
    }
  };

  // Confirm Delete Supplier
  const handleConfirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    setIsDeletingSupplier(true);
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', supplierToDelete.id);
      if (error) throw error;

      showToast('success', 'تم حذف المورد بنجاح من القائمة!');
      setSupplierToDelete(null);
      fetchData();
    } catch (e: any) {
      console.error('Error deleting supplier:', e);
      showToast('error', 'تعذر حذف المورد', e.message || 'قد يكون مرتبطاً بأوامر شراء موجودة');
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  // Open Printable Invoice from PO record
  const openInvoiceForPo = (po: PurchaseOrderRecord) => {
    let extractedHandler = poHandlerName;
    if (po.notes && po.notes.includes('مسؤول الشراء:')) {
      extractedHandler = po.notes.replace('مسؤول الشراء:', '').trim();
    }

    const invoiceItems = (po.purchase_items || []).map((pi: any) => {
      const pv = pi.product_variants || {};
      return {
        variant_id: pi.variant_id,
        product_name: pv.products?.name_ar || 'منتج',
        sku: pv.sku || pv.products?.product_code || 'N/A',
        size_code: pv.sizes?.code,
        color_name: pv.colors?.name_ar,
        quantity: pi.quantity_ordered || pi.quantity_received || 1,
        unit_cost_price: Number(pi.unit_cost_price || 0),
        selling_price: Number(pv.selling_price || 0),
        min_selling_price: Number(pv.min_selling_price || 0),
        total_cost: Number(pi.total_cost || (pi.quantity_ordered * pi.unit_cost_price)),
      };
    });

    const printData: PurchaseInvoiceData = {
      id: po.id,
      purchase_number: po.purchase_number,
      created_at: po.created_at,
      supplier_name: po.suppliers?.name_ar || 'عام',
      supplier_company: po.suppliers?.company_name,
      supplier_phone: po.suppliers?.phone,
      handler_name: extractedHandler,
      total_amount: Number(po.total_amount || 0),
      status: po.status,
      items: invoiceItems,
    };

    setPrintablePo(printData);
    setIsPrintModalOpen(true);
  };

  // Filtered Lists
  const filteredPurchases = purchases.filter(
    (po) =>
      po.purchase_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.suppliers?.name_ar?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.includes(searchQuery)
  );

  const matchedVariantsForPo = productSearchInput.trim()
    ? variants.filter((v) => {
        const q = productSearchInput.trim().toLowerCase();
        return (
          v.sku?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.products?.product_code?.toLowerCase().includes(q) ||
          v.products?.name_ar?.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-400" />
            <span>إدارة المشتريات والموردين</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إصدار أوامر الشراء، إنشاء كروت الأصناف، متابعة الموردين واستلام الفواتير وتحديث المخزون
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setIsSupplierModalOpen(true);
            }}
            variant="secondary"
            className="bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800/60 font-bold gap-2 text-xs"
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>+ إضافة مورد جديد</span>
          </Button>

          <Button
            onClick={() => setIsProductCardModalOpen(true)}
            variant="secondary"
            className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800/60 font-bold gap-2 text-xs"
          >
            <Barcode className="w-4 h-4 text-purple-400" />
            <span>+ إنشاء كارت صنف جديد (بكمية 0)</span>
          </Button>

          <Button
            onClick={() => {
              setPoItemsDraft([]);
              setIsCreatePoModalOpen(true);
            }}
            variant="primary"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs shadow-lg shadow-indigo-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>+ إنشاء أمر شراء جديد</span>
          </Button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>أوامر الشراء والشحنات ({purchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'border-amber-500 text-amber-400 bg-amber-950/30'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4 text-amber-400" />
          <span>سجل وقائمة الموردين ({suppliers.length})</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <Card className="p-4 bg-slate-900 border-slate-800">
        <Input
          placeholder={
            activeTab === 'orders'
              ? 'ابحث برقم أمر الشراء، اسم المورد...'
              : 'ابحث باسم المورد، الشركة، أو رقم الهاتف...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </Card>

      {/* TAB 1: PURCHASE ORDERS LIST */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-800/60 rounded-2xl animate-pulse" />)
          ) : filteredPurchases.length === 0 ? (
            <Card className="p-12 text-center text-slate-500">
              <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-bold">لا توجد أوامر شراء مسجلة حالياً</p>
              <Button
                onClick={() => setIsCreatePoModalOpen(true)}
                variant="primary"
                size="sm"
                className="mt-3 bg-indigo-600 hover:bg-indigo-500"
              >
                + اضغط هنا لإنشاء أول أمر شراء
              </Button>
            </Card>
          ) : (
            filteredPurchases.map((po) => (
              <Card
                key={po.id}
                className="p-4 bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col md:flex-row justify-between md:items-center gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono text-sm">#{po.purchase_number}</span>
                    <Badge variant="primary" size="sm" className="bg-emerald-950 text-emerald-400 border border-emerald-800">
                      مستلمة ومضافة للمخزون
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span>المورد: <strong className="text-slate-200">{po.suppliers?.name_ar || 'عام'}</strong></span>
                    <span>التاريخ: {new Date(po.created_at).toLocaleDateString('ar-EG')}</span>
                    <span>الأصناف: {po.purchase_items?.length || 0} صنف</span>
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
                    <Button
                      onClick={() => openInvoiceForPo(po)}
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 text-[11px] px-3 py-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة الفاتورة</span>
                    </Button>

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
      )}

      {/* TAB 2: SUPPLIERS LIST (WITH DELETE SUPPLIER SUPPORT) */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-44 bg-slate-800/60 rounded-2xl animate-pulse" />)
          ) : filteredSuppliers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Truck className="w-12 h-12 text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-bold">لم يتم العثور على موردين مسجلين</p>
              <Button
                onClick={() => {
                  setEditingSupplier(null);
                  setIsSupplierModalOpen(true);
                }}
                variant="primary"
                size="sm"
                className="mt-3 bg-amber-600 hover:bg-amber-500"
              >
                + إضافة مورد جديد الآن
              </Button>
            </div>
          ) : (
            filteredSuppliers.map((supp) => (
              <Card
                key={supp.id}
                className="p-4 bg-slate-900 border-slate-800 hover:border-amber-500/50 transition-all space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{supp.name_ar}</span>
                      <Badge variant="primary" size="sm" className="bg-amber-950 text-amber-400 border border-amber-800">
                        {supp.company_name || 'مورد'}
                      </Badge>
                    </h4>
                    {supp.name_en && <span className="text-[11px] text-slate-400 block mt-0.5">{supp.name_en}</span>}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSupplier(supp);
                        setIsSupplierModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="تعديل المورد"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSupplierToDelete(supp)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/80 rounded-lg transition-colors"
                      title="حذف المورد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>الهاتف: <strong className="text-white font-mono">{supp.phone}</strong></span>
                  </div>
                  {supp.email && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>البريد: {supp.email}</span>
                    </div>
                  )}
                  {supp.tax_number && (
                    <div className="flex items-center gap-2 text-indigo-300">
                      <span>الرقم الضريبي: {supp.tax_number}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL 1: CREATE NEW PURCHASE ORDER (REALTIME PRODUCT CODE AUTO-FILL & EDITABLE ITEMS) */}
      <Dialog
        isOpen={isCreatePoModalOpen}
        onClose={() => setIsCreatePoModalOpen(false)}
        title="إنشاء أمر شراء جديد"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePoSubmit} className="space-y-5 font-sans text-xs" dir="rtl">
          {/* Top Form Fields: Supplier & Cashier (Select + Add New Support) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  <span>اسم المورد *</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setIsSupplierModalOpen(true);
                  }}
                  className="text-[11px] text-amber-400 hover:underline font-bold"
                >
                  + مورد جديد
                </button>
              </div>
              <select
                value={poSupplierId}
                onChange={(e) => setPoSupplierId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">-- حدد المورد --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_ar} {s.company_name ? `(${s.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Cashier / Responsible Handler Selection or Custom Text Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>مسؤول الاستلام / الكاشير *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCashier(!isAddingNewCashier)}
                  className="text-[11px] text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  {isAddingNewCashier ? 'اختيار من قائمة الكاشيرية' : '+ كتابة اسم جديد'}
                </button>
              </div>

              {isAddingNewCashier ? (
                <Input
                  type="text"
                  placeholder="أدخل اسم مسؤول الاستلام..."
                  value={poHandlerName}
                  onChange={(e) => setPoHandlerName(e.target.value)}
                  className="font-bold text-indigo-300"
                  required
                />
              ) : (
                <select
                  value={poHandlerName}
                  onChange={(e) => {
                    if (e.target.value === '__add_custom_cashier__') {
                      setIsAddingNewCashier(true);
                    } else {
                      setPoHandlerName(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
                  required
                >
                  {cashiersList.map((c) => (
                    <option key={c.id} value={c.full_name}>
                      {c.full_name}
                    </option>
                  ))}
                  {!cashiersList.some((c) => c.full_name === poHandlerName) && poHandlerName && (
                    <option value={poHandlerName}>{poHandlerName}</option>
                  )}
                  <option value="__add_custom_cashier__">+ كتابة اسم كاشير جديد...</option>
                </select>
              )}
            </div>
          </div>

          {/* Product Code Search / Auto-Suggest Section */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-indigo-400 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Barcode className="w-4 h-4" />
              <span>إدخال كود المنتج (البحث التلقائي واقتراح الأكواد)</span>
            </h3>

            <div className="relative">
              <Input
                type="text"
                placeholder="أدخل أو امسح كود المنتج / الباركود كامل..."
                value={productSearchInput}
                onChange={(e) => {
                  setProductSearchInput(e.target.value);
                  setShowProductSuggestions(true);
                }}
                onFocus={() => setShowProductSuggestions(true)}
                icon={<Search className="w-4 h-4 text-indigo-400" />}
                className="font-mono font-bold"
              />

              {/* Suggestions Dropdown */}
              {showProductSuggestions && matchedVariantsForPo.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                  {matchedVariantsForPo.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handleSelectProductForPo(v)}
                      className="p-3 border-b border-slate-800 hover:bg-indigo-950/60 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-100 block">{v.products?.name_ar}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          الكود: {v.sku || v.products?.product_code} • {v.sizes?.code ? `مقاس (${v.sizes.code})` : ''}
                        </span>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-emerald-400 font-bold block">{v.cost_price || 0} ج.م (جملة)</span>
                        <span className="text-slate-400 text-[10px]">بيع: {v.selling_price || 0} ج.م</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Button to Create New Product Card */}
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>أول ما تكتب الكود بيظهر الصنف أسفله بكمية 0 والأسعار المحفوظة للتعديل</span>
              <button
                type="button"
                onClick={() => setIsProductCardModalOpen(true)}
                className="text-purple-400 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> إنشاء كارت صنف جديد إذا لم يكن موجوداً
              </button>
            </div>
          </div>

          {/* DRAFT ITEMS TABLE (EDITABLE QUANTITY & PRICES) */}
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            <label className="block text-slate-300 font-bold text-xs flex justify-between items-center">
              <span>الأصناف المحددة لأمر الشراء ({poItemsDraft.length})</span>
              <span className="text-slate-500 font-normal">يمكنك تعديل الكمية وسعر الجملة والبيع مباشرة</span>
            </label>

            {poItemsDraft.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                <Barcode className="w-8 h-8 text-slate-700 mx-auto mb-1" />
                <p>اكتب كود المنتج في الخانة أعلاه لإضافته هنا لمستند أمر الشراء</p>
              </div>
            ) : (
              poItemsDraft.map((item, idx) => (
                <div
                  key={item.variantId}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-100 block">{item.productName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">الكود: {item.sku}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPoItemsDraft(poItemsDraft.filter((_, i) => i !== idx))}
                      className="p-1 text-rose-400 hover:bg-rose-950 rounded-lg transition-colors"
                      title="إزالة الصنف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60">
                    {/* Quantity */}
                    <div>
                      <label className="text-[10px] text-indigo-400 font-bold block mb-1">
                        الكمية المشتراة *
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 0;
                          setPoItemsDraft((prev) =>
                            prev.map((i, iIdx) => (iIdx === idx ? { ...i, quantity: q } : i))
                          );
                        }}
                        className="font-mono text-center font-bold h-8 text-xs bg-slate-900 border-indigo-500/50"
                      />
                    </div>

                    {/* Wholesale Cost Price */}
                    <div>
                      <label className="text-[10px] text-emerald-400 font-bold block mb-1">
                        سعر الجملة (ج.م) *
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        value={item.wholesalePrice}
                        onChange={(e) => {
                          const c = parseFloat(e.target.value) || 0;
                          setPoItemsDraft((prev) =>
                            prev.map((i, iIdx) => (iIdx === idx ? { ...i, wholesalePrice: c } : i))
                          );
                        }}
                        className="font-mono text-center font-bold h-8 text-xs bg-slate-900 text-emerald-400"
                      />
                    </div>

                    {/* Selling Price */}
                    <div>
                      <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                        سعر البيع (ج.م)
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        value={item.sellingPrice}
                        onChange={(e) => {
                          const s = parseFloat(e.target.value) || 0;
                          setPoItemsDraft((prev) =>
                            prev.map((i, iIdx) => (iIdx === idx ? { ...i, sellingPrice: s } : i))
                          );
                        }}
                        className="font-mono text-center font-bold h-8 text-xs bg-slate-900"
                      />
                    </div>

                    {/* Minimum Selling Price (Optional) */}
                    <div>
                      <label className="text-[10px] text-amber-400/80 font-semibold block mb-1">
                        أقل سعر بيع (اختياري)
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        placeholder="اختياري"
                        value={item.minSellingPrice !== undefined ? item.minSellingPrice : ''}
                        onChange={(e) => {
                          const m = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          setPoItemsDraft((prev) =>
                            prev.map((i, iIdx) => (iIdx === idx ? { ...i, minSellingPrice: m } : i))
                          );
                        }}
                        className="font-mono text-center font-bold h-8 text-xs bg-slate-900 text-amber-300"
                      />
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 font-mono pt-1">
                    إجمالي هذا الصنف: <strong className="text-emerald-400">{(item.quantity * item.wholesalePrice).toFixed(2)} ج.م</strong>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Grand Total Bar */}
          <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="font-bold text-slate-300 text-xs">إجمالي قيمة أمر الشراء:</span>
            <span className="font-mono font-black text-emerald-400 text-base">
              {calculatePoDraftTotal(poItemsDraft).toFixed(2)} ج.م
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={() => setIsCreatePoModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSavingPo} variant="primary" className="bg-indigo-600 hover:bg-indigo-500 font-bold px-5">
              حفظ أمر الشراء وطباعة الفاتورة
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: EDIT EXISTING PURCHASE ORDER */}
      <Dialog isOpen={isEditPoModalOpen} onClose={() => setIsEditPoModalOpen(false)} title="تعديل أمر الشراء" maxWidth="md">
        <form onSubmit={handleUpdatePoSubmit} className="space-y-4 font-sans text-xs" dir="rtl">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">اسم المورد</label>
            <select
              value={editPoSupplierId}
              onChange={(e) => setEditPoSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">مسؤول الشراء / المستلم</label>
            <Input
              value={editPoHandlerName}
              onChange={(e) => setEditPoHandlerName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            <label className="block text-slate-300 font-bold">الأصناف والأسعار في أمر الشراء:</label>
            {editPoItemsDraft.map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-100 block">{item.productName}</span>
                  <span className="text-[10px] text-slate-400">الكود: {item.sku}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const q = parseInt(e.target.value) || 1;
                      setEditPoItemsDraft((prev) => prev.map((i, iIdx) => (iIdx === idx ? { ...i, quantity: q } : i)));
                    }}
                    className="w-16 text-center font-mono h-7 text-xs font-bold"
                  />
                  <Input
                    type="number"
                    step="0.5"
                    value={item.wholesalePrice}
                    onChange={(e) => {
                      const c = parseFloat(e.target.value) || 0;
                      setEditPoItemsDraft((prev) => prev.map((i, iIdx) => (iIdx === idx ? { ...i, wholesalePrice: c } : i)));
                    }}
                    className="w-20 text-center font-mono h-7 text-xs font-bold"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={() => setIsEditPoModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSavingEditPo} variant="primary" className="bg-indigo-600">
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CREATE / EDIT SUPPLIER MODAL */}
      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        initialSupplier={editingSupplier}
        onSaved={(newSupp) => {
          fetchData();
          if (newSupp && isCreatePoModalOpen) {
            setPoSupplierId(newSupp.id);
          }
        }}
      />

      {/* NEW PRODUCT CARD MODAL */}
      <NewProductCardModal
        isOpen={isProductCardModalOpen}
        onClose={() => setIsProductCardModalOpen(false)}
        onSaved={async (createdProd) => {
          await fetchData();
          if (createdProd && createdProd.variantId) {
            const v = variants.find((item) => item.id === createdProd.variantId) || {
              id: createdProd.variantId,
              sku: createdProd.product_code,
              barcode: createdProd.barcode,
              cost_price: createdProd.cost_price,
              selling_price: createdProd.base_price,
              min_selling_price: createdProd.min_selling_price,
              products: { id: createdProd.id, name_ar: createdProd.name_ar, product_code: createdProd.product_code },
            };
            handleSelectProductForPo(v as ProductVariantOption);
          }
        }}
      />

      {/* PRINTABLE PURCHASE INVOICE MODAL */}
      <PurchaseInvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        purchaseData={printablePo}
      />

      {/* CONFIRM DELETE PO DIALOG */}
      <ConfirmDialog
        isOpen={!!poToDelete}
        onClose={() => setPoToDelete(null)}
        onConfirm={handleConfirmDeletePo}
        title="تأكيد مسح أمر الشراء"
        message={`هل أنت متأكد من مسح أمر الشراء رقم (#${poToDelete?.purchase_number})؟`}
        confirmText="حذف أمر الشراء"
        cancelText="إلغاء"
        isLoading={isDeletingPo}
        variant="danger"
      />

      {/* CONFIRM DELETE SUPPLIER DIALOG */}
      <ConfirmDialog
        isOpen={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={handleConfirmDeleteSupplier}
        title="تأكيد حذف المورد"
        message={`هل أنت متأكد من حذف المورد "${supplierToDelete?.name_ar}" نهائياً من القائمة؟`}
        confirmText="حذف المورد"
        cancelText="إلغاء"
        isLoading={isDeletingSupplier}
        variant="danger"
      />
    </div>
  );
};
