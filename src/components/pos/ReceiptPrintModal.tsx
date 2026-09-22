import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Printer } from 'lucide-react';
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

type PrintFormat = '80mm' | '58mm' | 'a4';

// حجم الخط الحقيقي لكل عنصر حسب مقاس الورق — دي بتتغير فعلياً بدل
// ما كانت أحجام ثابتة (text-[11px]) بتتجاهل مقاس الورق المختار
const SIZES: Record<
  PrintFormat,
  {
    widthMm: number;
    padding: string;
    header: number;
    sub: number;
    meta: number;
    itemHead: number;
    itemBody: number;
    itemDetail: number;
    totals: number;
    totalsFinal: number;
    footer: number;
    barcode: number;
  }
> = {
  '58mm': {
    widthMm: 54,
    padding: '2mm 1mm',
    header: 12.5,
    sub: 10,
    meta: 9.5,
    itemHead: 8.5,
    itemBody: 9.5,
    itemDetail: 8,
    totals: 9.5,
    totalsFinal: 11,
    footer: 8.5,
    barcode: 7.5,
  },
  '80mm': {
    widthMm: 76,
    padding: '4mm 2mm',
    header: 15,
    sub: 11,
    meta: 11,
    itemHead: 10,
    itemBody: 11,
    itemDetail: 9,
    totals: 11,
    totalsFinal: 13,
    footer: 10,
    barcode: 9,
  },
  a4: {
    widthMm: 190,
    padding: '10mm',
    header: 20,
    sub: 13,
    meta: 13,
    itemHead: 11.5,
    itemBody: 13,
    itemDetail: 10.5,
    totals: 13,
    totalsFinal: 16,
    footer: 11,
    barcode: 10,
  },
};

interface StoreConfig {
  storeName?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  taxNumber?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

// محتوى الفاتورة نفسه — بيتعمل رندر ليه مرتين:
// 1) داخل المودال للمعاينة على الشاشة
// 2) في الـ Portal الخاص بالطباعة (بره المودال تماماً)
// كده الاتنين دايماً متطابقين ومفيش تكرار كود ممكن يفرق بينهم بالغلط
const ReceiptBody: React.FC<{
  saleData: NonNullable<ReceiptPrintModalProps['saleData']>;
  storeConfig: StoreConfig;
  printFormat: PrintFormat;
  forPrint?: boolean;
}> = ({ saleData, storeConfig, printFormat, forPrint }) => {
  const s = SIZES[printFormat];

  const displayStoreName = storeConfig.storeName || saleData.storeName || 'متجر الملابس';
  const displayBranchName = storeConfig.branchName || saleData.branchName || 'الفرع الرئيسي';
  const displayAddress = storeConfig.branchAddress || saleData.branchAddress;
  const displayPhone = storeConfig.branchPhone || saleData.branchPhone;
  const displayHeaderNote = storeConfig.receiptHeader || saleData.receiptHeader;
  const displayFooterNote = storeConfig.receiptFooter || saleData.receiptFooter;

  const wrapperStyle: React.CSSProperties = forPrint
    ? {
        width: `${s.widthMm}mm`,
        maxWidth: '100%',
        margin: '0 auto',
        padding: s.padding,
        background: '#ffffff',
        color: '#000000',
        fontFamily: "'Courier New', Courier, monospace, 'Cairo', sans-serif",
        boxSizing: 'border-box',
      }
    : {
        maxWidth: printFormat === '58mm' ? 280 : printFormat === '80mm' ? 360 : 650,
        margin: '0 auto',
      };

  return (
    <div
      id={forPrint ? 'thermal-receipt-print' : 'thermal-receipt-preview'}
      dir="rtl"
      className={
        forPrint
          ? 'space-y-3'
          : 'bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 font-mono text-xs shadow-2xl space-y-3'
      }
      style={wrapperStyle}
    >
      {/* Header */}
      <div
        className={forPrint ? 'text-center pb-3' : 'text-center space-y-1 pb-3 border-b border-dashed border-slate-700'}
        style={forPrint ? { borderBottom: '1px dashed #000', paddingBottom: 8 } : undefined}
      >
        <h2 style={{ fontSize: s.header, fontWeight: 900, margin: 0, color: forPrint ? '#000' : '#fff' }}>
          {displayStoreName}
        </h2>
        {displayBranchName && (
          <p style={{ fontSize: s.sub, fontWeight: 600, margin: '2px 0 0' }}>{displayBranchName}</p>
        )}
        {(displayAddress || displayPhone) && (
          <p style={{ fontSize: s.itemDetail, margin: '2px 0 0', opacity: forPrint ? 1 : 0.7 }}>
            {[displayAddress, displayPhone].filter(Boolean).join(' • ')}
          </p>
        )}
        {displayHeaderNote && (
          <p
            style={{
              fontSize: s.itemDetail,
              fontWeight: 600,
              margin: '4px 0 0',
              color: forPrint ? '#000' : '#34d399',
            }}
          >
            {displayHeaderNote}
          </p>
        )}
        <div style={{ paddingTop: 4 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: s.itemDetail,
              fontWeight: 700,
              background: forPrint ? '#000' : '#1e293b',
              color: forPrint ? '#fff' : '#e2e8f0',
            }}
          >
            فاتورة مبيعات (Sales Receipt)
          </span>
        </div>
      </div>

      {/* Meta Info */}
      <div
        style={{
          fontSize: s.meta,
          borderBottom: forPrint ? '1px dashed #000' : undefined,
          paddingBottom: 8,
        }}
        className={forPrint ? '' : 'border-b border-dashed border-slate-700'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>رقم الفاتورة:</span>
          <span style={{ fontWeight: 700 }}>
            {saleData.invoiceNumber ? saleData.invoiceNumber.replace(/^INV-0*/i, '') : '1'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>التاريخ والوقت:</span>
          <span>
            {(() => {
              const d = new Date(saleData.createdAt);
              const datePart = d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
              const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              return `${datePart}  ${timePart}`;
            })()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>اسم البائع:</span>
          <span style={{ fontWeight: 700 }}>{saleData.cashierName || 'المالك'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>اسم العميل:</span>
          <span>{saleData.customerName || 'عميل نقدي عام'}</span>
        </div>
      </div>

      {/* Items Table */}
      <div
        style={{ borderBottom: forPrint ? '1px dashed #000' : undefined, paddingBottom: 10 }}
        className={forPrint ? '' : 'border-b border-dashed border-slate-700'}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: s.itemHead,
            fontWeight: 700,
            opacity: forPrint ? 1 : 0.7,
            paddingBottom: 4,
            borderBottom: forPrint ? '1px solid #000' : undefined,
          }}
          className={forPrint ? '' : 'border-b border-slate-800'}
        >
          <span style={{ width: '50%' }}>الصنف</span>
          <span style={{ width: '17%', textAlign: 'center' }}>الكمية</span>
          <span style={{ width: '33%', textAlign: 'left' }}>الإجمالي</span>
        </div>
        {saleData.items.map((item, idx) => (
          <div key={idx} style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.itemBody, fontWeight: 700 }}>
              <span style={{ width: '50%', wordBreak: 'break-word' }}>{item.productNameAr}</span>
              <span style={{ width: '17%', textAlign: 'center' }}>{item.quantity}</span>
              <span style={{ width: '33%', textAlign: 'left' }}>{item.totalPrice.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: s.itemDetail, opacity: forPrint ? 1 : 0.7 }}>
              {item.sizeCode && !['Std', 'N/A', 'غير محدد', 'عام'].includes(item.sizeCode) && (
                <span>مقاس: {item.sizeCode}</span>
              )}
              {item.colorNameAr && !['عام', 'بدون', 'غير محدد', 'أسود/افتراضي'].includes(item.colorNameAr) && (
                <span>لون: {item.colorNameAr}</span>
              )}
              <span>سعر: {item.unitPrice.toFixed(2)}</span>
              {item.discountAmount > 0 && <span>(خصم {item.discountAmount.toFixed(2)})</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div
        style={{ fontSize: s.totals, borderBottom: forPrint ? '1px dashed #000' : undefined, paddingBottom: 10 }}
        className={forPrint ? '' : 'border-b border-dashed border-slate-700'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>المجموع الفرعي (غير شامل الضريبة):</span>
          <span>{saleData.subtotal.toFixed(2)} ج.م</span>
        </div>
        {saleData.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: forPrint ? '#000' : '#fbbf24' }}>
            <span>إجمالي الخصم:</span>
            <span>-{saleData.discountAmount.toFixed(2)} ج.م</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>ضريبة القيمة المضافة ({saleData.taxRate}%):</span>
          <span>{saleData.taxAmount.toFixed(2)} ج.م</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: s.totalsFinal,
            fontWeight: 900,
            paddingTop: 6,
            marginTop: 6,
            borderTop: forPrint ? '1px solid #000' : undefined,
            color: forPrint ? '#000' : '#fff',
          }}
          className={forPrint ? '' : 'border-t border-slate-800'}
        >
          <span>الإجمالي النهائي شامل الضريبة:</span>
          <span style={{ color: forPrint ? '#000' : '#34d399' }}>{saleData.totalAmount.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Payment */}
      <div
        style={{ fontSize: s.meta, borderBottom: forPrint ? '1px dashed #000' : undefined, paddingBottom: 10 }}
        className={forPrint ? '' : 'border-b border-dashed border-slate-700'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>طريقة الدفع:</span>
          <span style={{ fontWeight: 700 }}>
            {saleData.paymentMethod === 'cash'
              ? 'نقداً (Cash)'
              : saleData.paymentMethod === 'card'
              ? 'بطاقة (Card)'
              : 'مجزأ / أخر'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>المبلغ المدفوع:</span>
          <span>{saleData.paidAmount.toFixed(2)} ج.م</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: forPrint ? '#000' : '#fcd34d' }}>
          <span>المبلغ المتبقي / المرجع:</span>
          <span>{saleData.changeAmount.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: 4 }}>
        <p style={{ fontSize: s.footer, whiteSpace: 'pre-line', margin: 0, opacity: forPrint ? 1 : 0.7 }}>
          {displayFooterNote || 'شكراً لتسوقكم معنا!\nيرجى الاحتفاظ بالفاتورة للاستبدال والاسترجاع خلال 14 يوماً.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 1, padding: '6px 0' }}>
          {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3].map((w, i) => (
            <div
              key={i}
              style={{ width: w, height: 32, background: forPrint ? '#000' : '#e2e8f0', display: 'inline-block' }}
            />
          ))}
        </div>
        <span style={{ fontSize: s.barcode, letterSpacing: 2, opacity: forPrint ? 1 : 0.6 }}>
          {saleData.invoiceNumber}
        </span>
      </div>
    </div>
  );
};

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({ isOpen, onClose, saleData }) => {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('80mm');
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({});
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  // بنجهز عنصر منفصل تماماً في body، بعيد عن أي عنصر عنده
  // overflow / max-height / transform جوه المودال ممكن يقص الفاتورة وقت الطباعة
  useEffect(() => {
    const node = document.createElement('div');
    node.id = 'thermal-receipt-print-root';
    document.body.appendChild(node);
    setPortalNode(node);
    return () => {
      document.body.removeChild(node);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBranchSettings();
    }
  }, [isOpen]);

  const loadBranchSettings = async () => {
    try {
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

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="فاتورة ضريبية مبسطة (معاينة وطباعة)" maxWidth="md">
      <div className="space-y-4 font-sans" dir="rtl">
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
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* اخفي كل حاجة في الصفحة، ما عدا الـ portal الخاص بالطباعة */
            body > *:not(#thermal-receipt-print-root) {
              display: none !important;
            }

            #thermal-receipt-print-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
            }

            #thermal-receipt-print {
              position: static !important;
            }
          }

          /* الـ portal ميظهرش خالص على الشاشة، بيتفعل بس وقت الطباعة */
          #thermal-receipt-print-root {
            display: none;
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

        {/* معاينة على الشاشة فقط */}
        <ReceiptBody saleData={saleData} storeConfig={storeConfig} printFormat={printFormat} />

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

      {/* نسخة الطباعة الفعلية — بره المودال تماماً عن طريق Portal */}
      {portalNode &&
        ReactDOM.createPortal(
          <ReceiptBody saleData={saleData} storeConfig={storeConfig} printFormat={printFormat} forPrint />,
          portalNode
        )}
    </Dialog>
  );
};