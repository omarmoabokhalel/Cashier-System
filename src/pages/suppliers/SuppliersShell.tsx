import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Mail,
  Building,
  FileText,
  DollarSign,
  Edit3,
  CheckCircle2,
} from 'lucide-react';

interface Supplier {
  id: string;
  name_ar: string;
  name_en: string;
  company_name: string | null;
  contact_person: string | null;
  phone: string;
  email: string | null;
  tax_number: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export const SuppliersShell: React.FC = () => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('error', 'فشل التحميل', error.message);
      } else {
        setSuppliers(data || []);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
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
    setIsModalOpen(true);
  };

  const openEditModal = (supp: Supplier) => {
    setEditingSupplier(supp);
    setFormData({
      name_ar: supp.name_ar,
      name_en: supp.name_en,
      company_name: supp.company_name || '',
      contact_person: supp.contact_person || '',
      phone: supp.phone,
      email: supp.email || '',
      tax_number: supp.tax_number || '',
      address: supp.address || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_ar.trim() || !formData.phone.trim()) {
      showToast('warning', 'حقول مطلوبة', 'يرجى كتابة اسم المورد ورقم الهاتف');
      return;
    }

    setIsSaving(true);
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
      };

      if (editingSupplier) {
        const { error } = await (supabase.from('suppliers') as any)
          .update(payload)
          .eq('id', editingSupplier.id);

        if (error) showToast('error', 'فشل التعديل', error.message);
        else {
          showToast('success', 'تم تعديل المورد بنجاح');
          setIsModalOpen(false);
          fetchSuppliers();
        }
      } else {
        const { error } = await (supabase.from('suppliers') as any).insert(payload);

        if (error) showToast('error', 'فشل الإضافة', error.message);
        else {
          showToast('success', 'تم إضافة المورد بنجاح');
          setIsModalOpen(false);
          fetchSuppliers();
        }
      }
    } catch (e: any) {
      showToast('error', 'خطأ في العملية', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery)
  );

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" />
            <span>إدارة الموردين والشركات المصنعة</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            سجل الموردين، بيانات التواصل، الأرقام الضريبية وحساب الرصيد المالي
          </p>
        </div>

        <Button onClick={openCreateModal} variant="primary" className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2">
          <Plus className="w-4 h-4" />
          <span>إضافة مورد جديد</span>
        </Button>
      </div>

      {/* SEARCH BAR */}
      <Card className="p-4 bg-slate-900 border-slate-800">
        <Input
          placeholder="ابحث باسم المورد، اسم الشركة، أو رقم الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </Card>

      {/* SUPPLIERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-44 bg-slate-800/60 rounded-2xl animate-pulse" />)
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Truck className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-bold">لم يتم العثور على موردين</p>
          </div>
        ) : (
          filteredSuppliers.map((supp) => (
            <Card key={supp.id} className="p-4 bg-slate-900 border-slate-800 hover:border-amber-500/50 transition-all space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{supp.name_ar}</span>
                    <Badge variant="primary" size="sm">{supp.company_name || 'مصنع'}</Badge>
                  </h4>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{supp.name_en}</span>
                </div>

                <button
                  onClick={() => openEditModal(supp)}
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{supp.phone}</span>
                </div>
                {supp.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{supp.email}</span>
                  </div>
                )}
                {supp.tax_number && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>الرقم الضريبي: {supp.tax_number}</span>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* CREATE / EDIT SUPPLIER DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 font-sans" dir="rtl">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المورد (بالعربية) *</label>
              <Input
                placeholder="مثال: مصنع الأناقة للنسيج..."
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المورد (بالإنجليزية)</label>
              <Input
                placeholder="Elegance Textile Factory"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الشركة</label>
              <Input
                placeholder="شركة النسيج العربية"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف *</label>
              <Input
                placeholder="05XXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">البريد الإلكتروني</label>
              <Input
                type="email"
                placeholder="supplier@factory.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">الرقم الضريبي</label>
              <Input
                placeholder="300XXXXXX00003"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان والملاحظات</label>
            <textarea
              rows={2}
              placeholder="العنوان التفصيلي وملاحظات التوريد..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSaving} variant="primary" className="bg-amber-600 hover:bg-amber-500">
              حفظ المورد
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
