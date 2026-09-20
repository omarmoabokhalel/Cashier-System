import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { ProductFormModal } from '../../components/products/ProductFormModal';
import { ProductDetailsModal } from '../../components/products/ProductDetailsModal';
import {
  Package,
  Plus,
  Search,
  Eye,
  Edit,
  Copy,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Tags,
  CheckCircle2,
} from 'lucide-react';

export const ProductsShell: React.FC = () => {
  const { showToast } = useToast();
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Taxonomy Management Modal State
  const [isTaxonomyModalOpen, setIsTaxonomyModalOpen] = useState(false);
  const [taxonomyTab, setTaxonomyTab] = useState<'categories' | 'brands'>('categories');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);

  const fetchProductsData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, brandRes] = await Promise.all([
        supabase.from('products').select(`
          *,
          categories(name_ar),
          brands(name_ar),
          product_variants(
            id, sku, barcode, selling_price, cost_price, is_active, size_id, color_id,
            sizes(code, name_ar),
            colors(name_ar, hex_code),
            branch_variant_stock(quantity)
          )
        `).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('categories').select('*').eq('is_active', true),
        supabase.from('brands').select('*').eq('is_active', true),
      ]);

      if (prodRes.error) {
        console.error('Products error:', prodRes.error);
        showToast('error', 'خطأ في قراءة المنتجات من Supabase', prodRes.error.message);
      }

      const DEFAULT_CATEGORIES = [
        { id: 'c0000000-0000-0000-0000-000000000001', name_ar: 'ملابس رجالي' },
        { id: 'c0000000-0000-0000-0000-000000000002', name_ar: 'ملابس حريمي' },
        { id: 'c0000000-0000-0000-0000-000000000003', name_ar: 'ملابس أطفال' },
        { id: 'c0000000-0000-0000-0000-000000000004', name_ar: 'إكسسوارات وهدايا' },
      ];

      const DEFAULT_BRANDS = [
        { id: 'b0000000-0000-0000-0000-000000000001', name_ar: 'بدون ماركة / غير محدد' },
        { id: 'b0000000-0000-0000-0000-000000000002', name_ar: 'زارا (Zara)' },
        { id: 'b0000000-0000-0000-0000-000000000003', name_ar: 'نايكي (Nike)' },
        { id: 'b0000000-0000-0000-0000-000000000004', name_ar: 'أديداس (Adidas)' },
      ];

      setProducts(prodRes.data || []);
      setCategories(catRes.data && catRes.data.length > 0 ? catRes.data : DEFAULT_CATEGORIES);
      setBrands(brandRes.data && brandRes.data.length > 0 ? brandRes.data : DEFAULT_BRANDS);
    } catch (e: any) {
      showToast('error', 'فشل تحميل المنتجات', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsData();
  }, []);

  const filteredProducts = products.filter((p) => {
    const searchLower = search.toLowerCase();
    const nameMatch = p.name_ar?.toLowerCase().includes(searchLower) || p.name_en?.toLowerCase().includes(searchLower);
    const skuMatch = p.product_variants?.some((v: any) => v.sku?.toLowerCase().includes(searchLower));
    const barcodeMatch = p.product_variants?.some((v: any) => v.barcode?.toLowerCase().includes(searchLower));

    const categoryMatch = !selectedCategory || p.category_id === selectedCategory;
    const brandMatch = !selectedBrand || p.brand_id === selectedBrand;
    const statusMatch =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' && p.is_active) ||
      (selectedStatus === 'inactive' && !p.is_active);

    return (nameMatch || skuMatch || barcodeMatch) && categoryMatch && brandMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsDuplicateMode(false);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setSelectedProduct(product);
    setIsDuplicateMode(false);
    setIsFormModalOpen(true);
  };

  const handleOpenDuplicate = (product: any) => {
    setSelectedProduct(product);
    setIsDuplicateMode(true);
    setIsFormModalOpen(true);
  };

  const handleOpenDetails = (product: any) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  const handlePromptDelete = (product: any) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.from('products') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', productToDelete.id);

      if (error) throw error;

      showToast('success', 'تم نقل المنتج إلى المحذوفات بنجاح');
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchProductsData();
    } catch (err: any) {
      showToast('error', 'فشل حذف المنتج', err.message);
    } finally {
      setDeleting(false);
    }
  };

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

  // Add Category / Brand
  const handleAddTaxonomy = async () => {
    if (!newItemName.trim()) {
      showToast('error', 'يرجى كتابة اسم العنصر');
      return;
    }

    setSavingTaxonomy(true);
    try {
      const id = generateUUID();
      if (taxonomyTab === 'categories') {
        const code = newItemCode.trim() || `CAT-${Date.now().toString().slice(-4)}`;
        await (supabase.from('categories') as any).insert({
          id,
          name_ar: newItemName.trim(),
          name_en: newItemName.trim(),
          code,
          is_active: true,
        });
        showToast('success', 'تم إضافة الفئة الجديدة بنجاح');
      } else {
        await (supabase.from('brands') as any).insert({
          id,
          name_ar: newItemName.trim(),
          name_en: newItemName.trim(),
          is_active: true,
        });
        showToast('success', 'تم إضافة الماركة الجديدة بنجاح');
      }

      setNewItemName('');
      setNewItemCode('');
      fetchProductsData();
    } catch (e: any) {
      showToast('error', 'تعذر الإضافة', e.message);
    } finally {
      setSavingTaxonomy(false);
    }
  };

  const handleDeleteTaxonomyItem = async (table: 'categories' | 'brands', id: string) => {
    try {
      await (supabase.from(table) as any).delete().eq('id', id);
      showToast('success', 'تم الحذف بنجاح');
      fetchProductsData();
    } catch (e: any) {
      showToast('error', 'فشل الحذف', e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans select-none text-slate-100" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-400" />
            <span>إدارة كشوفات المنتجات وأصناف الملابس</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">عرض، إنشاء، استنساخ وتحديث كارت المنتج وتخصيص الألوان والمقاسات</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsTaxonomyModalOpen(true)}
            variant="secondary"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 gap-1.5 text-xs"
          >
            <Tags className="w-4 h-4 text-indigo-400" />
            <span>إدارة الفئات والماركات</span>
          </Button>

          <PermissionGuard permission="create_product">
            <Button onClick={handleOpenCreate} icon={<Plus className="w-4 h-4" />} className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs">
              إضافة منتج جديد
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Input
            placeholder="ابحث بالاسم، SKU أو الباركود..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
          <Select
            options={[
              { value: '', label: 'جميع الفئات والتصنيفات' },
              ...categories.map((c) => ({ value: c.id, label: c.name_ar })),
            ]}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          />
          <Select
            options={[
              { value: '', label: 'جميع الماركات' },
              ...brands.map((b) => ({ value: b.id, label: b.name_ar })),
            ]}
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setCurrentPage(1);
            }}
          />
          <Select
            options={[
              { value: 'all', label: 'جميع الحالات (نشط وموقف)' },
              { value: 'active', label: 'المنتجات النشطة فقط' },
              { value: 'inactive', label: 'المنتجات الموقوفة فقط' },
            ]}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as any);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* PRODUCTS TABLE */}
      <Card className="p-4 bg-slate-900 border-slate-800">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl bg-slate-800/60" />
            ))}
          </div>
        ) : paginatedProducts.length === 0 ? (
          <EmptyState
            icon={<Package className="w-12 h-12 text-slate-600" />}
            title="لا توجد منتجات مطابقة"
            description="لم نجد أي منتجات تناسب معايير البحث والفلترة المحددة."
            actionLabel="إضافة منتج جديد"
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950">
                    <th className="p-3">المنتج والاسم</th>
                    <th className="p-3">الفئة / الماركة</th>
                    <th className="p-3">سعر البيع الأساسي</th>
                    <th className="p-3">سعر التكلفة</th>
                    <th className="p-3">عدد الأصناف المتوفرة</th>
                    <th className="p-3 text-center">إجمالي المخزون</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedProducts.map((p) => {
                    const variantsCount = p.product_variants?.length || 0;
                    const totalStock = p.product_variants?.reduce((sum: number, v: any) => {
                      const qty = v.branch_variant_stock?.[0]?.quantity || 0;
                      return sum + qty;
                    }, 0) || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name_ar}
                                className="w-10 h-10 object-cover rounded-xl border border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                                <Package className="w-5 h-5 text-indigo-400" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-slate-100 text-sm">{p.name_ar}</h4>
                              <span className="text-[10px] text-slate-400 font-mono">{p.name_en || 'لا يوجد كود إنجليزي'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-200 block">{p.categories?.name_ar || 'بدون فئة'}</span>
                            <span className="text-[10px] text-slate-400 block">{p.brands?.name_ar || 'بدون ماركة'}</span>
                          </div>
                        </td>

                        <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                          {Number(p.base_price || 0).toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                        </td>

                        <td className="p-3 font-mono text-slate-300">
                          {Number(p.cost_price || 0).toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                        </td>

                        <td className="p-3">
                          <Badge variant="secondary" size="sm">
                            {variantsCount} أصناف (ألوان/مقاسات)
                          </Badge>
                        </td>

                        <td className="p-3 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            totalStock > (p.min_stock_alert || 5)
                              ? 'bg-slate-800 text-slate-200'
                              : totalStock > 0
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {totalStock} قطعة
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <Badge variant={p.is_active ? 'success' : 'danger'} size="sm">
                            {p.is_active ? 'نشط' : 'موقف'}
                          </Badge>
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenDetails(p)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                              title="معاينة التفاصيل والباركود"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <PermissionGuard permission="edit_product">
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 text-indigo-400 hover:bg-indigo-950/60 rounded-lg"
                                title="تعديل المنتج"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </PermissionGuard>

                            <PermissionGuard permission="create_product">
                              <button
                                onClick={() => handleOpenDuplicate(p)}
                                className="p-1.5 text-amber-400 hover:bg-amber-950/60 rounded-lg"
                                title="استنساخ المنتج"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </PermissionGuard>

                            <PermissionGuard permission="delete_product">
                              <button
                                onClick={() => handlePromptDelete(p)}
                                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg"
                                title="حذف المنتج"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                عرض الصفحات: <strong className="text-white">{currentPage}</strong> من <strong className="text-white">{totalPages}</strong> (إجمالي {filteredProducts.length} منتج)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* MODALS */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSaved={fetchProductsData}
        initialProduct={selectedProduct}
        isDuplicate={isDuplicateMode}
      />

      <ProductDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        product={selectedProduct}
      />

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد نقل المنتج إلى المحذوفات"
        message={`هل أنت تأكد من نقل المنتج "${productToDelete?.name_ar}" إلى المحذوفات؟ يمكنك استعادته لاحقاً.`}
        confirmText="حذف المنتج"
        isLoading={deleting}
      />

      {/* TAXONOMY MANAGEMENT MODAL */}
      <Dialog
        isOpen={isTaxonomyModalOpen}
        onClose={() => setIsTaxonomyModalOpen(false)}
        title="إدارة فئات الملابس والماركات"
        maxWidth="md"
      >
        <div className="space-y-4 font-sans text-xs" dir="rtl">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setTaxonomyTab('categories')}
              className={`px-4 py-2 font-bold border-b-2 transition-all ${
                taxonomyTab === 'categories' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent'
              }`}
            >
              فئات وتصنيفات الملابس ({categories.length})
            </button>
            <button
              onClick={() => setTaxonomyTab('brands')}
              className={`px-4 py-2 font-bold border-b-2 transition-all ${
                taxonomyTab === 'brands' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent'
              }`}
            >
              الماركات والعلامات التجارية ({brands.length})
            </button>
          </div>

          {/* Quick Add Form */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-200">
              إضافة {taxonomyTab === 'categories' ? 'فئة ملابس جديدة' : 'ماركة جديدة'}
            </h4>
            <div className="flex gap-2">
              <Input
                placeholder="الاسم بالعربية (مثال: جاكيتات / زارا)..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
              {taxonomyTab === 'categories' && (
                <Input
                  placeholder="الكود (اختياري)..."
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  className="w-32"
                />
              )}
              <Button onClick={handleAddTaxonomy} isLoading={savingTaxonomy} className="bg-indigo-600 hover:bg-indigo-500 shrink-0">
                إضافة
              </Button>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
            {(taxonomyTab === 'categories' ? categories : brands).map((item) => (
              <div key={item.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <span className="font-bold text-slate-100">{item.name_ar}</span>
                <button
                  onClick={() => handleDeleteTaxonomyItem(taxonomyTab, item.id)}
                  className="p-1 text-rose-400 hover:bg-rose-950 rounded transition-colors"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
};
