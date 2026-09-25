import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Truck, Phone, Mail, Building, FileText } from 'lucide-react';

export interface Supplier {
  id: string;
  name_ar: string;
  name_en?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  phone: string;
  email?: string | null;
  tax_number?: string | null;
  address?: string | null;
  is_active?: boolean;
}

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (supplier?: Supplier) => void;
  initialSupplier?: Supplier | null;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialSupplier,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_number: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSupplier) {
        setFormData({
          name_ar: initialSupplier.name_ar || '',
          name_en: initialSupplier.name_en || '',
          company_name: initialSupplier.company_name || '',
          contact_person: initialSupplier.contact_person || '',
          phone: initialSupplier.phone || '',
          email: initialSupplier.email || '',
          tax_number: initialSupplier.tax_number || '',
          address: initialSupplier.address || '',
        });
      } else {
        setFormData({
          name_ar: '',
          name_en: '',
          company_name: '',
          contact_person: '',
          phone: '',
          email: '',
          tax_number: '',
          address: '',
        });
      }
    }
  }, [isOpen, initialSupplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name_ar.trim()) {
      showToast('warning', 'اسم المورد مطلوب', 'يرجى كتابة اسم المورد بالعربية');
      return;
    }
    if (!formData.phone.trim()) {
      showToast('warning', 'رقم الهاتف مطلوب', 'يرجى كتابة رقم هاتف التواصل مع المورد');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name_ar: formData.name_ar.trim(),
        name_en: formData.name_en.trim() || formData.name_ar.trim(),
        company_name: formData.company_name.trim() || null,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        tax_number: formData.tax_number.trim() || null,
        address: formData.address.trim() || null,
        is_active: true,
      };

      if (initialSupplier) {
        const { data, error } = await (supabase.from('suppliers') as any)
          .update(payload)
          .eq('id', initialSupplier.id)
          .select()
          .single();

        if (error) throw error;
        showToast('success', 'تم تعديل بيانات المورد بنجاح!');
        onSaved(data);
      } else {
        const { data, error } = await (supabase.from('suppliers') as any)
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        showToast('success', 'تم إضافة المورد الجديد بنجاح!');
        onSaved(data);
      }

      onClose();
    } catch (e: any) {
      console.error('Error saving supplier:', e);
      showToast('error', 'فشل حفظ المورد', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs" dir="rtl">
        <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-800/40 text-amber-200 flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="font-bold">سجل الموردين والمصانع (بيانات التوريد والتواصل والضرائب)</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">اسم المورد (بالعربية) *</label>
            <Input
              placeholder="مثال: مصنع الأناقة للنسيج"
              value={formData.name_ar}
              onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">اسم المورد (بالإنجليزية)</label>
            <Input
              placeholder="Elegance Textile Factory"
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">اسم الشركة / المصنع</label>
            <Input
              placeholder="شركة النسيج والتوريدات"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف *</label>
            <Input
              placeholder="01000000000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">البريد الإلكتروني</label>
            <Input
              type="email"
              placeholder="supplier@factory.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">الرقم الضريبي</label>
            <Input
              placeholder="300XXXXXX00003"
              value={formData.tax_number}
              onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">العنوان والملاحظات</label>
          <textarea
            rows={2}
            placeholder="عنوان المصنع وملاحظات التوريد..."
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={loading} variant="primary" className="bg-amber-600 hover:bg-amber-500 font-bold">
            حفظ بيانات المورد
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
