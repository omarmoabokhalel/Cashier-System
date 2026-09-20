import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import {
  CircleDollarSign,
  Plus,
  Search,
  Calendar,
  Tag,
  FileText,
  User,
  Zap,
  Home,
  Wrench,
  Truck,
  Package,
  Users,
  Layers,
} from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  payee: string | null;
  created_at: string;
}

export const ExpensesShell: React.FC = () => {
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Electricity',
    amount: '',
    description: '',
    payee: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoriesMap: Record<string, { label: string; icon: any; color: string }> = {
    Rent: { label: 'إيجارات ومباني', icon: Home, color: 'text-amber-400 bg-amber-950/60' },
    Electricity: { label: 'كهرباء ومرافق', icon: Zap, color: 'text-yellow-400 bg-yellow-950/60' },
    Maintenance: { label: 'صيانة وتصليح', icon: Wrench, color: 'text-sky-400 bg-sky-950/60' },
    Delivery: { label: 'شحن وتوصيل', icon: Truck, color: 'text-indigo-400 bg-indigo-950/60' },
    Packaging: { label: 'تغليف وأكياس', icon: Package, color: 'text-purple-400 bg-purple-950/60' },
    Salaries: { label: 'رواتب ومكافآت', icon: Users, color: 'text-emerald-400 bg-emerald-950/60' },
    Other: { label: 'مصروفات أخرى', icon: Layers, color: 'text-slate-400 bg-slate-800' },
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('error', 'فشل التحميل', error.message);
      } else {
        setExpenses(data || []);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formData.amount);
    if (!amountVal || amountVal <= 0 || !formData.description.trim()) {
      showToast('warning', 'بيانات غير مكتملة', 'يرجى إدخال مبلغ صحيح ووصف للمصروف');
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

      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_record_expense', {
        p_cashier_shift_id: shiftId,
        p_category: formData.category,
        p_amount: amountVal,
        p_description: formData.description.trim(),
        p_payee: formData.payee.trim() || null,
      });

      if (error) {
        showToast('error', 'فشل تسجيل المصروف', error.message);
      } else {
        showToast('success', 'تم تسجيل المصروف بنجاح!', `${amountVal.toFixed(2)} ج.م`);
        setIsModalOpen(false);
        setFormData({ category: 'Electricity', amount: '', description: '', payee: '' });
        fetchExpenses();
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء التسجيل', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpensesAmount = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  const filteredExpenses = expenses.filter(
    (exp) => selectedCategoryFilter === 'all' || exp.category === selectedCategoryFilter
  );

  return (
    <div className="p-6 space-y-6 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-rose-400" />
            <span>إدارة المصروفات والنثريات التشغيلية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            تسجيل وتصنيف كافة المصروفات اليومية وخصمها تلقائياً من الوردية الحالية
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} variant="primary" className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-2">
          <Plus className="w-4 h-4" />
          <span>تسجيل مصروف جديد</span>
        </Button>
      </div>

      {/* SUMMARY CARD & CATEGORY FILTER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 block">إجمالي المصروفات المسجلة</span>
          <span className="text-xl font-black text-rose-400 font-mono">
            {totalExpensesAmount.toFixed(2)} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </span>
        </Card>

        <div className="md:col-span-3 flex items-center gap-2 overflow-x-auto custom-scrollbar bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
              selectedCategoryFilter === 'all' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            الكل ({expenses.length})
          </button>
          {Object.entries(categoriesMap).map(([catKey, catMeta]) => {
            const count = expenses.filter((e) => e.category === catKey).length;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategoryFilter(catKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedCategoryFilter === catKey ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {catMeta.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* EXPENSES LIST */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-slate-800/60 rounded-2xl animate-pulse" />)
        ) : filteredExpenses.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            <CircleDollarSign className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-bold">لا توجد مصروفات مسجلة ضمن هذا التصنيف</p>
          </Card>
        ) : (
          filteredExpenses.map((exp) => {
            const meta = categoriesMap[exp.category] || categoriesMap['Other'];
            const IconComponent = meta.icon;

            return (
              <Card key={exp.id} className="p-4 bg-slate-900 border-slate-800 flex justify-between items-center text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border border-slate-700 ${meta.color}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{exp.description}</h4>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>التصنيف: <strong className="text-slate-200">{meta.label}</strong></span>
                      {exp.payee && <span>المستلم: <strong className="text-slate-200">{exp.payee}</strong></span>}
                      <span>التاريخ: {new Date(exp.created_at).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                </div>

                <span className="text-base font-black text-rose-400 font-mono">
                  -{Number(exp.amount).toFixed(2)} ج.م
                </span>
              </Card>
            );
          })
        )}
      </div>

      {/* REGISTER EXPENSE DIALOG */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="تسجيل مصروف جديد" maxWidth="md">
        <form onSubmit={handleRecordExpense} className="space-y-4 font-sans" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">تصنيف المصروف *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-rose-500"
            >
              {Object.entries(categoriesMap).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المبلغ (ج.م) *</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">وصف المصروف *</label>
            <Input
              placeholder="مثال: شراء أكياس تغليف للفرع..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المستلم / الجهه (اختياري)</label>
            <Input
              placeholder="مثال: شركة الكهرباء / عامل الصيانة..."
              value={formData.payee}
              onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isSubmitting} variant="primary" className="bg-rose-600 hover:bg-rose-500">
              تأكيد وتسجيل المصروف
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
