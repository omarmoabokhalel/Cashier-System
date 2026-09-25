import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Package, UserCheck, Barcode, DollarSign, CheckCircle2, Plus, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NewProductCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (createdProduct?: any) => void;
}

interface SellerProfile {
  id: string;
  full_name: string;
}

export const NewProductCardModal: React.FC<NewProductCardModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [selectedSellerName, setSelectedSellerName] = useState<string>('');
  const [isAddingNewSeller, setIsAddingNewSeller] = useState(false);
  const [newSellerName, setNewSellerName] = useState('');
  
  const [productCode, setProductCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minSellingPrice, setMinSellingPrice] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSellers();
      resetForm();
    }
  }, [isOpen]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (!error && data && data.length > 0) {
        setSellers(data);
        const currentUserProfile = data.find((s) => s.full_name === user?.fullName);
        if (currentUserProfile) {
          setSelectedSellerId(currentUserProfile.id);
          setSelectedSellerName(currentUserProfile.full_name);
        } else {
          setSelectedSellerId(data[0].id);
          setSelectedSellerName(data[0].full_name);
        }
      } else {
        const defaultName = user?.fullName || 'الكاشير الرئيسي';
        setSellers([{ id: 'default-seller', full_name: defaultName }]);
        setSelectedSellerId('default-seller');
        setSelectedSellerName(defaultName);
      }
    } catch (e) {
      const defaultName = user?.fullName || 'الكاشير الرئيسي';
      setSellers([{ id: 'default-seller', full_name: defaultName }]);
      setSelectedSellerId('default-seller');
      setSelectedSellerName(defaultName);
    }
  };

  const resetForm = () => {
    const autoCode = `100${Math.floor(10 + Math.random() * 90)}`;
    setProductCode(autoCode);
    setNameAr('');
    setCostPrice('');
    setSellingPrice('');
    setMinSellingPrice('');
    setIsAddingNewSeller(false);
    setNewSellerName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameAr.trim()) {
      showToast('warning', 'حقل اسم المنتج مطلوب', 'يرجى إدخال اسم المنتج كارت الصنف');
      return;
    }
    if (!productCode.trim()) {
      showToast('warning', 'حقل كود المنتج مطلوب', 'يرجى إدخال كود أو باركود المنتج');
      return;
    }
    if (!costPrice || parseFloat(costPrice) < 0) {
      showToast('warning', 'سعر الجملة مطلوب', 'يرجى إدخال سعر التكلفة/الجملة الصحيح');
      return;
    }
    if (!sellingPrice || parseFloat(sellingPrice) < 0) {
      showToast('warning', 'سعر البيع مطلوب', 'يرجى إدخال سعر البيع المستهدف');
      return;
    }

    setLoading(true);
    try {
      let finalSellerName = selectedSellerName;

      // Handle custom new seller name
      if (isAddingNewSeller) {
        if (!newSellerName.trim()) {
          showToast('warning', 'اسم البائع الجديد مطلوب', 'يرجى كتابة اسم البائع أو اختر بائعاً مسجلاً');
          setLoading(false);
          return;
        }
        finalSellerName = newSellerName.trim();

        // Optionally save to profiles database so it appears in sellers list
        try {
          const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seller-${Date.now()}`;
          await (supabase.from('profiles') as any).insert({
            id: newId,
            full_name: finalSellerName,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.log('Profile insert note:', e);
        }
      }

      const finalCode = productCode.trim();
      const finalBarcode = finalCode.length >= 6 ? finalCode : `62810000${finalCode.padStart(4, '0')}`;
      const cost = parseFloat(costPrice) || 0;
      const selling = parseFloat(sellingPrice) || 0;
      // Minimum selling price is optional! If empty, default to selling price
      const minSelling = minSellingPrice.trim() ? parseFloat(minSellingPrice) : selling;

      // 1. Insert product record into `products`
      const productPayload = {
        name_ar: nameAr.trim(),
        name_en: nameAr.trim(),
        product_code: finalCode,
        barcode: finalBarcode,
        cost_price: cost,
        base_price: selling,
        min_selling_price: minSelling,
        is_active: true,
        description: `تم إنشاؤه بواسطة البائع: ${finalSellerName}`,
        updated_at: new Date().toISOString(),
      };

      const { data: newProduct, error: prodErr } = await (supabase.from('products') as any)
        .insert(productPayload)
        .select()
        .single();

      if (prodErr) {
        throw new Error(prodErr.message || 'فشل إضافة كارت الصنف في قاعدة البيانات');
      }

      // 2. Insert standard variant for this product into `product_variants`
      const variantPayload = {
        product_id: newProduct.id,
        sku: finalCode,
        barcode: finalBarcode,
        cost_price: cost,
        selling_price: selling,
        discount_price: minSelling,
        min_selling_price: minSelling,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: newVariant, error: varErr } = await (supabase.from('product_variants') as any)
        .insert(variantPayload)
        .select()
        .single();

      if (varErr) {
        throw new Error(varErr.message || 'فشل إنشاء صنف المنتج');
      }

      // 3. Initialize Inventory quantity to 0
      const branchId = '00000000-0000-0000-0000-000000000001';
      await (supabase.from('branch_variant_stock') as any).upsert(
        {
          branch_id: branchId,
          variant_id: newVariant.id,
          quantity: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,variant_id' }
      );

      showToast(
        'success',
        'تم إنشاء كارت الصنف بنجاح!',
        `تم حفظ "${nameAr.trim()}" بكود (${finalCode}) وسعر جملة ${cost} ج.م ومخزون افتراضي (0) قطعة.`
      );

      onSaved({ ...newProduct, variantId: newVariant.id });
      onClose();
    } catch (err: any) {
      console.error('Error creating product card:', err);
      showToast('error', 'خطأ في إنشاء كارت الصنف', err.message || 'تأكد من عدم تكرار كود المنتج');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="إنشاء كارت صنف جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs" dir="rtl">
        <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/40 text-indigo-200 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <p className="font-bold text-xs">كارت صنف جديد للمخزون (الكمية الابتدائية: 0)</p>
            <p className="text-[11px] text-indigo-300/80">
              يتم تسجيل كارت الصنف أولاً وتسعيره، ثم يمكنك إضافة الكميات المشتراة عبر أمر الشراء.
            </p>
          </div>
        </div>

        {/* 1. اسم البائع أو الكاشير (إمكانية الاختيار أو كتابة اسم جديد) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>اسم البائع / الكاشير المسؤول *</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsAddingNewSeller(!isAddingNewSeller);
                if (isAddingNewSeller && sellers.length > 0) {
                  setSelectedSellerName(sellers[0].full_name);
                }
              }}
              className="text-[11px] text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              {isAddingNewSeller ? (
                <span>اختيار من البائعين المسجلين</span>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ كتابة اسم بائع جديد</span>
                </>
              )}
            </button>
          </div>

          {isAddingNewSeller ? (
            <Input
              type="text"
              placeholder="أدخل اسم البائع الجديد..."
              value={newSellerName}
              onChange={(e) => setNewSellerName(e.target.value)}
              className="font-bold text-indigo-300"
              required
              autoFocus
            />
          ) : (
            <select
              value={selectedSellerId}
              onChange={(e) => {
                if (e.target.value === '__add_new__') {
                  setIsAddingNewSeller(true);
                } else {
                  setSelectedSellerId(e.target.value);
                  const found = sellers.find((s) => s.id === e.target.value);
                  if (found) setSelectedSellerName(found.full_name);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
              required
            >
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
              <option value="__add_new__">+ إضافة بائع جديد...</option>
            </select>
          )}
        </div>

        {/* 2. كود المنتج & 3. اسم المنتج */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-indigo-400" />
              <span>كود المنتج / الباركود *</span>
            </label>
            <Input
              type="text"
              placeholder="مثال: 1001 أو 6281000..."
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="font-mono text-xs font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">اسم المنتج *</label>
            <Input
              type="text"
              placeholder="مثال: قميص قطني أبيض كلاسيك"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
            />
          </div>
        </div>

        {/* 4. سعر الجملة & 5. سعر البيع & 6. أقل سعر للبيع (اختياري) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-emerald-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>سعر الجملة (ج.م) *</span>
            </label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="مثال: 150"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="font-mono text-xs font-bold text-emerald-400"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-indigo-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>سعر البيع (ج.م) *</span>
            </label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="مثال: 250"
              value={sellingPrice}
              onChange={(e) => {
                setSellingPrice(e.target.value);
                if (!minSellingPrice) setMinSellingPrice(e.target.value);
              }}
              className="font-mono text-xs font-bold text-indigo-300"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1 text-amber-300/80 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>أقل سعر للبيع (اختياري)</span>
            </label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="اختياري (مثال: 220)"
              value={minSellingPrice}
              onChange={(e) => setMinSellingPrice(e.target.value)}
              className="font-mono text-xs font-bold text-amber-300"
            />
          </div>
        </div>

        {/* Confirmation Info Box */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-slate-400">
          <span>الكمية المبدئية عند الحفظ:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/60">
            0 قطعة
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            isLoading={loading}
            variant="primary"
            className="bg-indigo-600 hover:bg-indigo-500 font-bold px-5"
          >
            <CheckCircle2 className="w-4 h-4 gap-1.5" />
            <span>حفظ كارت الصنف</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
