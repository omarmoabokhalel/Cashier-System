import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Printer, CheckCircle2, FileText, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: {
    invoiceNumber: string;
    createdAt: string;
    storeName?: string;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    taxNumber?: string;
    receiptHeader?: string;
    receiptFooter?: string;
    cashierName?: string;
    customerName?: string;
    items: Array<{
      productNameAr: string;
      sizeCode: string;
      colorNameAr: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      totalPrice: number;
    }>;
    subtotal: number;
    discountAmount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
  } | null;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  saleData,
}) => {
  const [printFormat, setPrintFormat] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [storeConfig, setStoreConfig] = useState<{
    storeName?: string;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    taxNumber?: string;
    receiptHeader?: string;
    receiptFooter?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
      loadBranchSettings();
    }
  }, [isOpen]);

  const loadBranchSettings = async () => {
    try {
      // 1. Fetch fresh from Supabase branches table
      const { data: branchData } = await (supabase.from('branches') as any).select('*').limit(1);
      const { data: configData } = await (supabase.from('app_config') as any).select('*');

      let currentBranch = branchData && branchData.length > 0 ? branchData[0] : null;

      if (!currentBranch) {
        const cached = localStorage.getItem('branch_settings');
        if (cached) currentBranch = JSON.parse(cached);
      }

      let cfgMap: Record<string, any> = {};
      if (configData && configData.length > 0) {
        configData.forEach((item: { key: string; value: any }) => {
          cfgMap[item.key] = item.value;
        });
      } else {
        const cachedCfg = localStorage.getItem('app_config');
        if (cachedCfg) cfgMap = JSON.parse(cachedCfg);
      }

      if (currentBranch) {
        localStorage.setItem('branch_settings', JSON.stringify(currentBranch));
      }

      setStoreConfig({
        storeName: currentBranch?.name_ar || cfgMap.appName || 'متجر الملابس',
        branchName: currentBranch?.name_ar || 'الفرع الرئيسي',
        branchAddress: currentBranch?.address || '',
        branchPhone: currentBranch?.phone || '',
        taxNumber: currentBranch?.tax_number || '',
        receiptHeader: currentBranch?.receipt_header || cfgMap.receiptHeader || '',
        receiptFooter: currentBranch?.receipt_footer || cfgMap.receiptFooter || '',
      });
    } catch (e) {
      console.error('Error loading branch settings for receipt:', e);
    }
  };

  if (!saleData) return null;

  const handlePrint = () => {
    window.print();
  };

  const displayStoreName = storeConfig.storeName || saleData.storeName || 'متجر الملابس';
  const displayBranchName = storeConfig.branchName || saleData.branchName || 'الفرع الرئيسي';
  const displayAddress = storeConfig.branchAddress || saleData.branchAddress;
  const displayPhone = storeConfig.branchPhone || saleData.branchPhone;
  const displayTaxNumber = storeConfig.taxNumber || saleData.taxNumber;
  const displayHeaderNote = storeConfig.receiptHeader || saleData.receiptHeader;
  const displayFooterNote = storeConfig.receiptFooter || saleData.receiptFooter;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="فاتورة ضريبية مبسطة (معاينة وطباعة)" maxWidth="md">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Dynamic Thermal & Document Print Stylesheet */}
        <style>{`
          @page {
            size: ${printFormat === '58mm' ? '58mm auto' : printFormat === '80mm' ? '80mm auto' : 'A4 portrait'};
            margin: ${printFormat === 'a4' ? '10mm' : '0mm'};
          }

          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body * {
              visibility: hidden !important;
            }

            #printable-thermal-receipt,
            #printable-thermal-receipt * {
              visibility: visible !important;
              color: #000000 !important;
              border-color: #000000 !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }

            #printable-thermal-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: ${printFormat === '58mm' ? '54mm' : printFormat === '80mm' ? '76mm' : '100%'} !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: ${printFormat === '58mm' ? '2mm 1mm' : printFormat === '80mm' ? '4mm 2mm' : '10mm'} !important;
              background-color: #ffffff !important;
              font-family: 'Courier New', Courier, monospace, 'Cairo', sans-serif !important;
              font-size: ${printFormat === '58mm' ? '9.5px' : printFormat === '80mm' ? '11px' : '13px'} !important;
              line-height: 1.25 !important;
              direction: rtl !important;
              border: none !important;
              border-radius: 0 !important;
              box-sizing: border-box !important;
            }

            #printable-thermal-receipt .truncate {
              overflow: visible !important;
              white-space: normal !important;
              text-overflow: clip !important;
            }

            #printable-thermal-receipt h2 {
              font-size: ${printFormat === '58mm' ? '13px' : printFormat === '80mm' ? '15px' : '18px'} !important;
              font-weight: 900 !important;
              color: #000000 !important;
              margin-bottom: 2px !important;
            }

            #printable-thermal-receipt span,
            #printable-thermal-receipt p,
            #printable-thermal-receipt div {
              color: #000000 !important;
            }

            #printable-thermal-receipt .border-dashed {
              border-style: dashed !important;
              border-color: #000000 !important;
            }

            #printable-thermal-receipt .bg-slate-200 {
              background-color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* PRINT FORMAT SELECTOR */}
        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs no-print">
          <span className="text-slate-400 font-semibold">اختر قياس الورق للطباعة:</span>
          <div className="flex gap-1.5 font-bold">
            <button
              onClick={() => setPrintFormat('58mm')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === '58mm' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              58mm (حراري صغير)
            </button>
            <button
              onClick={() => setPrintFormat('80mm')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === '80mm' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              80mm (حراري قياسي)
            </button>
            <button
              onClick={() => setPrintFormat('a4')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === 'a4' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              A4 (ورق عادي)
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTAINER */}
        <div
          id="printable-thermal-receipt"
          className={`bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 font-mono text-xs shadow-2xl mx-auto space-y-3 ${
            printFormat === '58mm' ? 'max-w-[280px]' : printFormat === '80mm' ? 'max-w-[360px]' : 'max-w-[650px]'
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-700">
            <h2 className="text-base font-black text-white">{displayStoreName}</h2>
            {displayBranchName && (
              <p className="text-[11px] text-slate-300 font-semibold">{displayBranchName}</p>
            )}
            {(displayAddress || displayPhone) && (
              <p className="text-[10px] text-slate-400">
                {[displayAddress, displayPhone].filter(Boolean).join(' • ')}
              </p>
            )}
            {displayTaxNumber && (
              <p className="text-[10px] text-slate-400">الرقم الضريبي: {displayTaxNumber}</p>
            )}
            {displayHeaderNote && (
              <p className="text-[10px] text-emerald-400 font-semibold pt-0.5">{displayHeaderNote}</p>
            )}
            <div className="pt-1">
              <span className="inline-block bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded text-[10px] font-bold">
                فاتورة ضريبية مبسطة (VAT Simplified Tax Invoice)
              </span>
            </div>
          </div>

          {/* Meta Info */}
          <div className="space-y-1 text-[11px] border-b border-dashed border-slate-700 pb-2.5 text-slate-300">
            <div className="flex justify-between">
              <span>رقم الفاتورة:</span>
              <span className="font-bold text-white">{saleData.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>التاريخ والوقت:</span>
              <span>
                {new Date(saleData.createdAt).toLocaleDateString('ar-SA')} -{' '}
                {new Date(saleData.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>الكاشير:</span>
              <span>{saleData.cashierName || 'كاشير الفرع'}</span>
            </div>
            <div className="flex justify-between">
              <span>العميل:</span>
              <span>{saleData.customerName || 'عميل نقدي عام'}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2 border-b border-dashed border-slate-700 pb-3">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-800">
              <span className="w-1/2">الصنف</span>
              <span className="w-1/6 text-center">الكمية</span>
              <span className="w-1/3 text-left">الإجمالي</span>
            </div>
            {saleData.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold text-slate-100">
                  <span className="w-1/2 truncate">{item.productNameAr}</span>
                  <span className="w-1/6 text-center">{item.quantity}</span>
                  <span className="w-1/3 text-left">{item.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex text-[9px] text-slate-400 gap-2">
                  <span>مقاس: {item.sizeCode}</span>
                  <span>لون: {item.colorNameAr}</span>
                  <span>سعر: {item.unitPrice.toFixed(2)}</span>
                  {item.discountAmount > 0 && <span>(خصم {item.discountAmount.toFixed(2)})</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-300 border-b border-dashed border-slate-700 pb-3">
            <div className="flex justify-between">
              <span>المجموع الفرعي (غير شامل الضريبة):</span>
              <span>{saleData.subtotal.toFixed(2)} ج.م</span>
            </div>
            {saleData.discountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>إجمالي الخصم:</span>
                <span>-{saleData.discountAmount.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>ضريبة القيمة المضافة ({saleData.taxRate}%):</span>
              <span>{saleData.taxAmount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-sm font-black text-white pt-1.5 border-t border-slate-800">
              <span>الإجمالي النهائي شامل الضريبة:</span>
              <span className="text-emerald-400">{saleData.totalAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Payment & Change */}
          <div className="space-y-1 text-[11px] text-slate-300 border-b border-dashed border-slate-700 pb-3">
            <div className="flex justify-between">
              <span>طريقة الدفع:</span>
              <span className="font-bold">
                {saleData.paymentMethod === 'cash' ? 'نقداً (Cash)' : saleData.paymentMethod === 'card' ? 'بطاقة (Card)' : 'مجزأ / أخر'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>المبلغ المدفوع:</span>
              <span>{saleData.paidAmount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-amber-300">
              <span>المبلغ المتبقي / المرجع:</span>
              <span>{saleData.changeAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Footer Note & Barcode preview */}
          <div className="text-center space-y-2 pt-1">
            <p className="text-[10px] text-slate-400 leading-snug whitespace-pre-line">
              {displayFooterNote || 'شكراً لتسوقكم معنا!\nيرجى الاحتفاظ بالفاتورة للاستبدال والاسترجاع خلال 14 يوماً.'}
            </p>

            <div className="flex justify-center gap-0.5 py-1">
              {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3].map((w, i) => (
                <div key={i} style={{ width: `${w}px` }} className="h-8 bg-slate-200 inline-block" />
              ))}
            </div>
            <span className="text-[9px] text-slate-500 font-mono tracking-widest">{saleData.invoiceNumber}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-800 no-print">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>

          <Button
            variant="primary"
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 px-6"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الفاتورة ({printFormat})</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
