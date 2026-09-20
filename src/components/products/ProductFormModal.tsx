import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { uploadProductImage, deleteProductImage } from '../../utils/storage';
import { GeneratedVariant } from './VariantMatrixGenerator';
import {
  Package,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialProduct?: any;
  isDuplicate?: boolean;
}

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

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const sanitizeTaxonomyStorage = (key: string) => {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || '[]');
    let updated = false;
    const sanitized = cached.map((item: any) => {
      if (!item.id || !isValidUUID(item.id)) {
        item.id = generateUUID();
        updated = true;
      }
      return item;
    });
    if (updated) {
      localStorage.setItem(key, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return [];
  }
};

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProduct,
  isDuplicate = false,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Core Form States
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('5');
  const [isActive, setIsActive] = useState(true);

  // Image Upload State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Taxonomy Lists with Defaults
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);

  // Selected for Generator
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>([]);

  // Variants Matrix List
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);

  // Quick Add Sub-Modals State
  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'color' | 'size' | null>(null);
  const [quickNameAr, setQuickNameAr] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [quickHex, setQuickHex] = useState('#000000');
  const [savingQuick, setSavingQuick] = useState(false);

  const loadTaxonomy = async () => {
    try {
      const [
        { data: catData },
        { data: brandData },
        { data: sizeData },
        { data: colorData },
      ] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true),
        supabase.from('brands').select('*').eq('is_active', true),
        supabase.from('sizes').select('*').order('sort_order'),
        supabase.from('colors').select('*'),
      ]);

      const defaultCats = [
        { id: 'c0000000-0000-0000-0000-000000000001', name_ar: 'ملابس رجالي' },
        { id: 'c0000000-0000-0000-0000-000000000002', name_ar: 'ملابس حريمي' },
        { id: 'c0000000-0000-0000-0000-000000000003', name_ar: 'ملابس أطفال' },
        { id: 'c0000000-0000-0000-0000-000000000004', name_ar: 'إكسسوارات وهدايا' },
      ];
      const defaultBrands = [
        { id: 'b0000000-0000-0000-0000-000000000001', name_ar: 'بدون ماركة / غير محدد' },
        { id: 'b0000000-0000-0000-0000-000000000002', name_ar: 'زارا (Zara)' },
        { id: 'b0000000-0000-0000-0000-000000000003', name_ar: 'نايكي (Nike)' },
        { id: 'b0000000-0000-0000-0000-000000000004', name_ar: 'أديداس (Adidas)' },
      ];
      const defaultSizes = [
        { id: 's0000000-0000-0000-0000-000000000001', code: 'S', name_ar: 'صغير (S)' },
        { id: 's0000000-0000-0000-0000-000000000002', code: 'M', name_ar: 'وسط (M)' },
        { id: 's0000000-0000-0000-0000-000000000003', code: 'L', name_ar: 'كبير (L)' },
        { id: 's0000000-0000-0000-0000-000000000004', code: 'XL', name_ar: 'كبير جداً (XL)' },
        { id: 's0000000-0000-0000-0000-000000000005', code: 'XXL', name_ar: 'جامبو (XXL)' },
      ];
      const defaultColors = [
        { id: 'cl000000-0000-0000-0000-000000000001', code: 'BLK', name_ar: 'أسود', hex_code: '#000000' },
        { id: 'cl000000-0000-0000-0000-000000000002', code: 'WHT', name_ar: 'أبيض', hex_code: '#FFFFFF' },
        { id: 'cl000000-0000-0000-0000-000000000003', code: 'BLU', name_ar: 'كحلي / أزرق', hex_code: '#000080' },
        { id: 'cl000000-0000-0000-0000-000000000004', code: 'RED', name_ar: 'أحمر', hex_code: '#FF0000' },
        { id: 'cl000000-0000-0000-0000-000000000005', code: 'GRY', name_ar: 'رمادي', hex_code: '#808080' },
      ];

      const cachedCols = sanitizeTaxonomyStorage('custom_colors');
      const cachedSzs = sanitizeTaxonomyStorage('custom_sizes');
      const cachedCats = sanitizeTaxonomyStorage('custom_categories');
      const cachedBrands = sanitizeTaxonomyStorage('custom_brands');

      const mergedCats = [...(catData && catData.length > 0 ? catData : defaultCats)];
      cachedCats.forEach((c: any) => { if (!mergedCats.some(x => x.id === c.id)) mergedCats.push(c); });

      const mergedBrands = [...(brandData && brandData.length > 0 ? brandData : defaultBrands)];
      cachedBrands.forEach((b: any) => { if (!mergedBrands.some(x => x.id === b.id)) mergedBrands.push(b); });

      const mergedColors = [...(colorData && colorData.length > 0 ? colorData : defaultColors)];
      cachedCols.forEach((c: any) => { if (!mergedColors.some(x => x.id === c.id)) mergedColors.push(c); });

      const mergedSizes = [...(sizeData && sizeData.length > 0 ? sizeData : defaultSizes)];
      cachedSzs.forEach((s: any) => { if (!mergedSizes.some(x => x.id === s.id)) mergedSizes.push(s); });

      setCategories(mergedCats);
      setBrands(mergedBrands);
      setSizes(mergedSizes);
      setColors(mergedColors);
    } catch (e) {
      console.error('Error loading taxonomy:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTaxonomy();

      if (initialProduct) {
        setNameAr(isDuplicate ? `${initialProduct.name_ar} (نسخة)` : initialProduct.name_ar);
        setNameEn(initialProduct.name_en || '');
        setDescription(initialProduct.description || '');
        setCategoryId(initialProduct.category_id || '');
        setBrandId(initialProduct.brand_id || '');
        setBasePrice(initialProduct.base_price?.toString() || '0');
        setCostPrice(initialProduct.cost_price?.toString() || '0');
        setMinStockAlert(initialProduct.min_stock_alert?.toString() || '5');
        setIsActive(initialProduct.is_active ?? true);
        setImageUrl(initialProduct.image_url || null);

        if (initialProduct.product_variants) {
          const mappedVariants: GeneratedVariant[] = initialProduct.product_variants.map((pv: any) => ({
            id: isDuplicate ? undefined : pv.id,
            sizeId: pv.size_id,
            sizeCode: pv.sizes?.code || 'Std',
            colorId: pv.color_id,
            colorNameAr: pv.colors?.name_ar || 'عام',
            colorHex: pv.colors?.hex_code || '#000000',
            sku: isDuplicate ? `${pv.sku}-COPY` : pv.sku,
            barcode: isDuplicate ? `6281${Math.floor(10000000 + Math.random() * 90000000)}` : pv.barcode,
            costPrice: Number(pv.cost_price),
            sellingPrice: Number(pv.selling_price),
            stockQty: pv.branch_variant_stock?.[0]?.quantity || 10,
          }));
          setVariants(mappedVariants);
        }
      } else {
        setNameAr('');
        setNameEn('');
        setDescription('');
        setCategoryId('');
        setBrandId('');
        setBasePrice('89.00');
        setCostPrice('35.00');
        setMinStockAlert('5');
        setIsActive(true);
        setImageUrl(null);
        setVariants([]);
        setSelectedColorIds([]);
        setSelectedSizeIds([]);
      }
    }
  }, [isOpen, initialProduct, isDuplicate]);

  // Image Upload Handlers
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const publicUrl = await uploadProductImage(file);
      if (publicUrl) {
        setImageUrl(publicUrl);
        showToast('success', 'تم رفع صورة المنتج بنجاح');
      }
    } catch (err: any) {
      showToast('error', 'فشل رفع الصورة', err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Quick Generate Variants
  const handleGenerateVariants = () => {
    if (selectedColorIds.length === 0 || selectedSizeIds.length === 0) {
      showToast('warning', 'حدد لوناً واحداً ومقاساً واحداً على الأقل لتوليد الأنواع تلقائياً');
      return;
    }

    const generated: GeneratedVariant[] = [];
    const baseSelling = parseFloat(basePrice) || 0;
    const baseCost = parseFloat(costPrice) || 0;
    const prefix = (nameAr.slice(0, 3) || 'PRD').replace(/\s+/g, '-').toUpperCase();

    selectedColorIds.forEach((colorId) => {
      const colorObj = colors.find((c) => c.id === colorId);
      selectedSizeIds.forEach((sizeId) => {
        const sizeObj = sizes.find((s) => s.id === sizeId);
        if (colorObj && sizeObj) {
          const randSku = `${prefix}-${colorObj.code || 'CLR'}-${sizeObj.code}-${Math.floor(1000 + Math.random() * 9000)}`;
          const randBarcode = `6281${Math.floor(10000000 + Math.random() * 90000000)}`;
          
          generated.push({
            sizeId,
            sizeCode: sizeObj.code,
            colorId,
            colorNameAr: colorObj.name_ar,
            colorHex: colorObj.hex_code || '#000000',
            sku: randSku,
            barcode: randBarcode,
            costPrice: baseCost,
            sellingPrice: baseSelling,
            stockQty: 10,
          });
        }
      });
    });

    setVariants(generated);
    showToast('success', `تم توليد ${generated.length} أصناف ألوان ومقاسات للمنتج`);
  };

  const updateVariantRow = (index: number, field: keyof GeneratedVariant, val: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: val };
    setVariants(updated);
  };

  const removeVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Quick Add Taxonomy Item
  const handleSaveQuickItem = async () => {
    if (!quickNameAr.trim()) {
      showToast('error', 'يرجى كتابة الاسم بالعربية');
      return;
    }

    setSavingQuick(true);
    try {
      const newId = generateUUID();
      if (quickAddType === 'category') {
        const catCode = quickCode.trim() || `CAT-${Date.now().toString().slice(-4)}`;
        const newItem = {
          id: newId,
          name_ar: quickNameAr.trim(),
          name_en: quickNameAr.trim(),
          code: catCode,
          is_active: true,
        };
        try {
          await (supabase.from('categories') as any).insert(newItem);
        } catch (err) {
          console.log('Database insert note:', err);
        }
        const cached = JSON.parse(localStorage.getItem('custom_categories') || '[]');
        localStorage.setItem('custom_categories', JSON.stringify([...cached, newItem]));
        setCategories((prev) => [...prev.filter((c) => c.id !== newId), newItem]);
        setCategoryId(newId);
        showToast('success', 'تم إضافة الفئة الجديدة بنجاح');
      } else if (quickAddType === 'brand') {
        const newItem = {
          id: newId,
          name_ar: quickNameAr.trim(),
          name_en: quickNameAr.trim(),
          is_active: true,
        };
        try {
          await (supabase.from('brands') as any).insert(newItem);
        } catch (err) {
          console.log('Database insert note:', err);
        }
        const cached = JSON.parse(localStorage.getItem('custom_brands') || '[]');
        localStorage.setItem('custom_brands', JSON.stringify([...cached, newItem]));
        setBrands((prev) => [...prev.filter((b) => b.id !== newId), newItem]);
        setBrandId(newId);
        showToast('success', 'تم إضافة الماركة الجديدة بنجاح');
      } else if (quickAddType === 'color') {
        const colCode = quickCode.trim() || `CLR-${Date.now().toString().slice(-3)}`;
        const newItem = {
          id: newId,
          name_ar: quickNameAr.trim(),
          name_en: quickNameAr.trim(),
          code: colCode,
          hex_code: quickHex || '#000000',
        };
        try {
          await (supabase.from('colors') as any).insert(newItem);
        } catch (err) {
          console.log('Database insert note:', err);
        }
        const cached = JSON.parse(localStorage.getItem('custom_colors') || '[]');
        localStorage.setItem('custom_colors', JSON.stringify([...cached, newItem]));
        setColors((prev) => [...prev.filter((c) => c.id !== newId), newItem]);
        setSelectedColorIds((prev) => Array.from(new Set([...prev, newId])));
        showToast('success', 'تم إضافة اللون الجديد وتحديده بنجاح');
      } else if (quickAddType === 'size') {
        const szCode = quickCode.trim() || quickNameAr.trim().toUpperCase();
        const newItem = {
          id: newId,
          name_ar: quickNameAr.trim(),
          name_en: szCode,
          code: szCode,
          sort_order: sizes.length + 1,
        };
        try {
          await (supabase.from('sizes') as any).insert(newItem);
        } catch (err) {
          console.log('Database insert note:', err);
        }
        const cached = JSON.parse(localStorage.getItem('custom_sizes') || '[]');
        localStorage.setItem('custom_sizes', JSON.stringify([...cached, newItem]));
        setSizes((prev) => [...prev.filter((s) => s.id !== newId), newItem]);
        setSelectedSizeIds((prev) => Array.from(new Set([...prev, newId])));
        showToast('success', 'تم إضافة المقاس الجديد وتحديده بنجاح');
      }

      setQuickAddType(null);
      setQuickNameAr('');
      setQuickCode('');
      await loadTaxonomy();
    } catch (e: any) {
      showToast('error', 'تعذر الإضافة', e.message);
    } finally {
      setSavingQuick(false);
    }
  };

  // Submit Main Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast('error', 'حقل اسم المنتج بالعربية مطلوب');
      return;
    }

    setLoading(true);
    try {
      let productId = initialProduct?.id && !isDuplicate ? initialProduct.id : null;

      // 1. Ensure selected Category exists in DB
      if (categoryId) {
        const catObj = categories.find((c) => c.id === categoryId);
        if (catObj) {
          const { error: cErr } = await (supabase.from('categories') as any).upsert(
            {
              id: catObj.id,
              name_ar: catObj.name_ar,
              name_en: catObj.name_en || catObj.name_ar,
              code: catObj.code || `CAT-${catObj.id.slice(0, 6)}`,
              is_active: true,
            },
            { onConflict: 'id' }
          );
          if (cErr) console.warn('Category upsert note:', cErr);
        }
      }

      // 2. Ensure selected Brand exists in DB
      if (brandId) {
        const brandObj = brands.find((b) => b.id === brandId);
        if (brandObj) {
          const { error: bErr } = await (supabase.from('brands') as any).upsert(
            {
              id: brandObj.id,
              name_ar: brandObj.name_ar,
              name_en: brandObj.name_en || brandObj.name_ar,
              is_active: true,
            },
            { onConflict: 'id' }
          );
          if (bErr) console.warn('Brand upsert note:', bErr);
        }
      }

      const productPayload = {
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        brand_id: brandId || null, // Optional
        base_price: parseFloat(basePrice) || 0,
        cost_price: parseFloat(costPrice) || 0,
        min_stock_alert: parseInt(minStockAlert) || 5,
        is_active: isActive,
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      };

      if (productId) {
        const { error: prodErr } = await (supabase.from('products') as any)
          .update(productPayload)
          .eq('id', productId);
        if (prodErr) throw prodErr;
      } else {
        const { data: newProd, error: prodErr } = await (supabase.from('products') as any)
          .insert(productPayload)
          .select('id')
          .single();
        if (prodErr) throw prodErr;
        productId = newProd.id;
      }

      const branchId = '00000000-0000-0000-0000-000000000001';

      // 3. Save variants
      if (variants.length > 0) {
        // Ensure all colors referenced by variants exist in DB
        const usedColorIds = Array.from(new Set(variants.map((v) => v.colorId).filter(Boolean)));
        for (const cid of usedColorIds) {
          const colObj = colors.find((c) => c.id === cid);
          if (colObj) {
            const { error: colErr } = await (supabase.from('colors') as any).upsert(
              {
                id: colObj.id,
                name_ar: colObj.name_ar,
                name_en: colObj.name_en || colObj.name_ar,
                code: colObj.code || `CLR-${colObj.id.slice(0, 6)}`,
                hex_code: colObj.hex_code || '#000000',
              },
              { onConflict: 'id' }
            );
            if (colErr) console.warn('Color upsert note:', colErr);
          }
        }

        // Ensure all sizes referenced by variants exist in DB
        const usedSizeIds = Array.from(new Set(variants.map((v) => v.sizeId).filter(Boolean)));
        for (const sid of usedSizeIds) {
          const szObj = sizes.find((s) => s.id === sid);
          if (szObj) {
            const { error: szErr } = await (supabase.from('sizes') as any).upsert(
              {
                id: szObj.id,
                name_ar: szObj.name_ar,
                name_en: szObj.name_en || szObj.code,
                code: szObj.code || `SZ-${szObj.id.slice(0, 6)}`,
                sort_order: szObj.sort_order || 1,
              },
              { onConflict: 'id' }
            );
            if (szErr) console.warn('Size upsert note:', szErr);
          }
        }

        for (const v of variants) {
          let variantId = v.id;
          const variantPayload = {
            product_id: productId,
            size_id: v.sizeId,
            color_id: v.colorId,
            sku: v.sku,
            barcode: v.barcode,
            cost_price: v.costPrice,
            selling_price: v.sellingPrice,
            is_active: true,
            updated_at: new Date().toISOString(),
          };

          if (variantId) {
            const { error: vErr } = await (supabase.from('product_variants') as any)
              .update(variantPayload)
              .eq('id', variantId);
            if (vErr) throw vErr;
          } else {
            const { data: newV, error: vErr } = await (supabase.from('product_variants') as any)
              .insert(variantPayload)
              .select('id')
              .single();
            if (vErr) throw vErr;
            variantId = newV.id;
          }

          await (supabase.from('branch_variant_stock') as any).upsert(
            {
              branch_id: branchId,
              variant_id: variantId,
              quantity: v.stockQty,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'branch_id,variant_id' }
          );
        }
      } else {
        // Create standard default variant if none generated
        const targetColor = colors[0] || {
          id: 'cl000000-0000-0000-0000-000000000001',
          name_ar: 'أسود',
          code: 'BLK',
          hex_code: '#000000',
        };
        const targetSize = sizes[0] || {
          id: 's0000000-0000-0000-0000-000000000001',
          name_ar: 'صغير (S)',
          code: 'S',
          sort_order: 1,
        };

        await (supabase.from('colors') as any).upsert(
          {
            id: targetColor.id,
            name_ar: targetColor.name_ar,
            name_en: targetColor.name_en || targetColor.name_ar,
            code: targetColor.code || 'BLK',
            hex_code: targetColor.hex_code || '#000000',
          },
          { onConflict: 'id' }
        ).catch(() => {});

        await (supabase.from('sizes') as any).upsert(
          {
            id: targetSize.id,
            name_ar: targetSize.name_ar,
            name_en: targetSize.name_en || targetSize.code,
            code: targetSize.code || 'S',
            sort_order: targetSize.sort_order || 1,
          },
          { onConflict: 'id' }
        ).catch(() => {});

        const defaultSku = `${(nameAr.slice(0, 3) || 'PRD').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const defaultBarcode = `6281${Math.floor(10000000 + Math.random() * 90000000)}`;

        const { data: stdV } = await (supabase.from('product_variants') as any).insert({
          product_id: productId,
          size_id: targetSize.id,
          color_id: targetColor.id,
          sku: defaultSku,
          barcode: defaultBarcode,
          cost_price: parseFloat(costPrice) || 0,
          selling_price: parseFloat(basePrice) || 0,
          is_active: true,
        }).select('id').single();

        if (stdV) {
          await (supabase.from('branch_variant_stock') as any).upsert({
            branch_id: branchId,
            variant_id: stdV.id,
            quantity: 10,
          }, { onConflict: 'branch_id,variant_id' });
        }
      }

      showToast('success', 'تم حفظ المنتج والأنواع بنجاح في قاعدة البيانات!');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      showToast('error', 'تعذر حفظ المنتج', err.message || 'تأكد من عدم تكرار رمز SKU أو الباركود');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={initialProduct && !isDuplicate ? 'تعديل بيانات المنتج' : isDuplicate ? 'استنساخ المنتج' : 'إضافة منتج جديد وسريع'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 font-sans text-xs max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar" dir="rtl">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Package className="w-4 h-4" />
              <span>البيانات الأساسية للمنتج والتسعير</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="اسم المنتج (بالعربية) *"
                placeholder="مثال: قميص قطن كلاسيكي"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="الاسم الإنجليزي / الكود الداخلي"
                placeholder="Classic Cotton Shirt"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
            </div>

            {/* Category & Brand Dropdowns with Quick Add */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">الفئة / التصنيف الرئيسي</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('category')}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3 h-3" /> فئة جديدة
                  </button>
                </div>
                <Select
                  options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="اختر التصنيف..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">الماركة (اختياري)</label>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('brand')}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3 h-3" /> ماركة جديدة
                  </button>
                </div>
                <Select
                  options={[
                    { value: '', label: 'بدون ماركة / غير محدد (اختياري)' },
                    ...brands.map((b) => ({ value: b.id, label: b.name_ar })),
                  ]}
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  placeholder="اختر الماركة (اختياري)..."
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="السعر الأساسي للبيع (ج.م) *"
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
              />
              <Input
                label="سعر التكلفة الحقيقي (ج.م)"
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
              <Input
                label="حد تنبيه نقص المخزون"
                type="number"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
              />
            </div>
          </div>

          {/* SECTION 2: DYNAMIC VARIANT MATRIX GENERATOR */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>تحديد الألوان والمقاسات والمخزون</span>
              </h3>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddType('color')}
                  className="text-[11px] bg-slate-900 border border-slate-800 hover:bg-slate-800 px-2 py-1 rounded-lg text-indigo-400 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> لون جديد
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAddType('size')}
                  className="text-[11px] bg-slate-900 border border-slate-800 hover:bg-slate-800 px-2 py-1 rounded-lg text-purple-400 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> مقاس جديد
                </button>
              </div>
            </div>

            {/* Color Selector Tags */}
            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">1. اختر الألوان المتاحة لهذا المنتج:</label>
              <div className="flex flex-wrap gap-2">
                {colors.map((col) => {
                  const isSelected = selectedColorIds.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() =>
                        setSelectedColorIds((prev) =>
                          prev.includes(col.id) ? prev.filter((id) => id !== col.id) : [...prev, col.id]
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-indigo-950 border-indigo-500 text-white shadow-md shadow-indigo-950/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: col.hex_code || '#000' }} />
                      <span>{col.name_ar}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Selector Tags */}
            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">2. اختر المقاسات المتاحة لهذا المنتج:</label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => {
                  const isSelected = selectedSizeIds.includes(sz.id);
                  return (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() =>
                        setSelectedSizeIds((prev) =>
                          prev.includes(sz.id) ? prev.filter((id) => id !== sz.id) : [...prev, sz.id]
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-purple-950 border-purple-500 text-white shadow-md shadow-purple-950/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sz.code} ({sz.name_ar})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Action Button */}
            <Button
              type="button"
              onClick={handleGenerateVariants}
              variant="secondary"
              className="bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-800 font-bold gap-1.5 w-full py-2.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>توليد جدول الألوان والمقاسات التلقائي ({selectedColorIds.length * selectedSizeIds.length} صنف)</span>
            </Button>

            {/* Generated Variants Table */}
            {variants.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">جدول الأصناف المتولدة ({variants.length})</span>
                  <span className="text-slate-400 text-[11px]">يمكنك تعديل الأسعار، الباركود والمخزون مباشرة</span>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                      <tr>
                        <th className="p-2.5">اللون / المقاس</th>
                        <th className="p-2.5">رمز SKU</th>
                        <th className="p-2.5">الباركود (Barcode)</th>
                        <th className="p-2.5">سعر البيع</th>
                        <th className="p-2.5">المخزون الأول</th>
                        <th className="p-2.5 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {variants.map((v, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-slate-200 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: v.colorHex }} />
                            <span>{v.colorNameAr} / {v.sizeCode}</span>
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => updateVariantRow(idx, 'sku', e.target.value)}
                              className="w-32 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-indigo-300"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={v.barcode}
                              onChange={(e) => updateVariantRow(idx, 'barcode', e.target.value)}
                              className="w-32 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-emerald-300"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={v.sellingPrice}
                              onChange={(e) => updateVariantRow(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-emerald-400 font-bold"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              value={v.stockQty}
                              onChange={(e) => updateVariantRow(idx, 'stockQty', parseInt(e.target.value) || 0)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-white"
                            />
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeVariantRow(idx)}
                              className="p-1 text-rose-400 hover:bg-rose-950 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: IMAGE UPLOAD */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-slate-300 font-semibold">صورة المنتج الرئيسية (اختياري)</label>
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 text-center bg-slate-900 flex flex-col items-center justify-center gap-2">
              {imageUrl ? (
                <div className="relative group">
                  <img src={imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-800 shadow" />
                  <button
                    type="button"
                    onClick={() => {
                      deleteProductImage(imageUrl);
                      setImageUrl(null);
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow hover:bg-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                  <label className="cursor-pointer bg-slate-950 hover:bg-slate-800 text-indigo-400 font-bold px-3 py-1.5 rounded-xl text-xs border border-slate-800 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'جاري الرفع...' : 'رفع صورة للمنتج'}</span>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 sticky bottom-0 bg-slate-900 py-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={loading} icon={<CheckCircle2 className="w-4 h-4" />}>
              حفظ المنتج والأصناف بالكامل
            </Button>
          </div>
        </form>
      </Dialog>

      {/* QUICK ADD TAXONOMY SUB-MODAL */}
      <Dialog
        isOpen={quickAddType !== null}
        onClose={() => setQuickAddType(null)}
        title={
          quickAddType === 'category'
            ? 'إضافة فئة ملابس جديدة'
            : quickAddType === 'brand'
            ? 'إضافة ماركة جديدة'
            : quickAddType === 'color'
            ? 'إضافة لون جديد'
            : 'إضافة مقاس جديد'
        }
        maxWidth="sm"
      >
        <div className="space-y-4 font-sans text-xs" dir="rtl">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">الاسم بالعربية *</label>
            <Input
              placeholder="مثال: فئة هوديز / ماركة زارا / أحمر زاهي..."
              value={quickNameAr}
              onChange={(e) => setQuickNameAr(e.target.value)}
              required
              autoFocus
            />
          </div>

          {(quickAddType === 'category' || quickAddType === 'color' || quickAddType === 'size') && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">الكود المختصر (رمز الإنجليزي)</label>
              <Input
                placeholder="مثال: CAT-HOODIE / RED / XL"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
              />
            </div>
          )}

          {quickAddType === 'color' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">رمز اللون Hex Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={quickHex}
                  onChange={(e) => setQuickHex(e.target.value)}
                  className="w-10 h-9 rounded bg-slate-950 border border-slate-800 cursor-pointer"
                />
                <Input value={quickHex} onChange={(e) => setQuickHex(e.target.value)} className="font-mono" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setQuickAddType(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveQuickItem} isLoading={savingQuick} variant="primary">
              حفظ الخيار الجديد
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
