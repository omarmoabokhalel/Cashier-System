import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Printer, CheckCircle2, FileText, Calendar, Building, DollarSign } from 'lucide-react';

interface DailyCloseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: {
    date: string;
    closedAt: string;
    performerName: string;
    openingBalance: number;
    cashSales: number;
    cardSales: number;
    totalSales: number;
    invoicesCount: number;
    expenses: number;
    returns: number;
    cashIn: number;
    cashOut: number;
    withdrawAtClose: number;
    withdrawReason: string;
    finalRegisterBalance: number;
  } | null;
}

export const DailyCloseReportModal: React.FC<DailyCloseReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
}) => {
  if (!reportData) return null;

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="تقرير تقفيل اليوم الشامل (End of Day Report)" maxWidth="2xl">
      <div className="space-y-4 font-sans select-none" dir="rtl">
        {/* PRINTABLE AREA */}
        <div id="printable-daily-close-report" className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 text-xs">
          {/* REPORT HEADER */}
          <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <span>تقرير تقفيل الحسابات اليومية</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                بيان تفصيلي شامل لحركة الخزنة والمبيعات والمصروفات حتى تاريخ اليوم
              </p>
            </div>
            <div className="text-left font-mono text-[11px] text-slate-300">
              <span className="block font-bold text-indigo-400">التاريخ: {reportData.date}</span>
              <span className="text-[10px] text-slate-400">الوقت: {new Date(reportData.closedAt).toLocaleTimeString('ar-EG')}</span>
            </div>
          </div>

          {/* USER & PERFORMER INFO */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-400">مسؤول التقفيل:</span>{' '}
              <strong className="text-slate-100 font-bold">{reportData.performerName || 'المالك / المدير'}</strong>
            </div>
            <div>
              <span className="text-slate-400">عدد الفواتير المنفذة:</span>{' '}
              <strong className="text-purple-400 font-mono font-bold">{reportData.invoicesCount} فاتورة</strong>
            </div>
          </div>

          {/* CASH REGISTER FLOW TABLE */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>1. حركة السيولة والنقدية بالخزنة (Cash Flow)</span>
            </h4>
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-400">رصيد افتتاح بداية اليوم:</span>
                <span className="font-mono font-bold text-slate-200">{reportData.openingBalance.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-400">(+) المبيعات النقدي (Cash):</span>
                <span className="font-mono font-bold text-emerald-400">+{reportData.cashSales.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-400">(+) الإيداعات النقدية الأخرى:</span>
                <span className="font-mono font-bold text-emerald-400">+{reportData.cashIn.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-400">(-) المصروفات التشغيلية:</span>
                <span className="font-mono font-bold text-rose-400">-{reportData.expenses.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-400">(-) المرتجعات النقدي:</span>
                <span className="font-mono font-bold text-rose-400">-{reportData.returns.toFixed(2)} ج.م</span>
              </div>
              {reportData.withdrawAtClose > 0 && (
                <div className="p-2.5 flex justify-between bg-rose-950/30">
                  <span className="text-rose-300 font-bold">(-) المسحوبات المباشرة عند التقفيل:</span>
                  <span className="font-mono font-bold text-rose-300">-{reportData.withdrawAtClose.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="p-3 bg-gradient-to-r from-emerald-950 to-slate-950 flex justify-between text-sm font-bold">
                <span className="text-emerald-300">(=) رصيد الخزنة المتبقي المترحل للغد:</span>
                <span className="font-mono text-emerald-300 text-base">{reportData.finalRegisterBalance.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* SALES BREAKDOWN TABLE */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>2. إجمالي الإيرادات وطرق الدفع</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-sans block">إجمالي مبيعات الفيزا (Card)</span>
                <span className="font-bold text-sky-400 text-sm">{reportData.cardSales.toFixed(2)} ج.م</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-sans block">إجمالي المبيعات الإجمالية</span>
                <span className="font-bold text-indigo-400 text-sm">{reportData.totalSales.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* REPORT FOOTER STAMP */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
            <span>نظام الكاشير والمبيعات ERP System</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              تم اعتماد وتقفيل الحسابات بنجاح
            </span>
          </div>
        </div>

        {/* DIALOG ACTIONS */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button onClick={handlePrintReport} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير (Print)</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
