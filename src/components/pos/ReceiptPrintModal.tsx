import React, { useState, useEffect } from 'react';
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

// أحجام خط أوضح وأثقل تناسب الطباعة الحرارية (الخط الرفيع بيطلع باهت على الطابعات الحرارية)
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
  }
> = {
  '58mm': {
    widthMm: 54,
    padding: '2mm 1.5mm',
    header: 14,
    sub: 11,
    meta: 10.5,
    itemHead: 9.5,
    itemBody: 10.5,
    itemDetail: 9,
    totals: 10.5,
    totalsFinal: 12.5,
    footer: 9.5,
  },
  '80mm': {
    widthMm: 76,
    padding: '3mm 2mm',
    header: 17,
    sub: 12.5,
    meta: 12,
    itemHead: 11,
    itemBody: 12,
    itemDetail: 10,
    totals: 12,
    totalsFinal: 15,
    footer: 11,
  },
  a4: {
    widthMm: 190,
    padding: '10mm',
    header: 22,
    sub: 14,
    meta: 14,
    itemHead: 12.5,
    itemBody: 14,
    itemDetail: 11.5,
    totals: 14,
    totalsFinal: 18,
    footer: 12,
  },
};

const FONT_STACK = "'Tahoma', 'Segoe UI', 'Cairo', Arial, sans-serif";

interface StoreConfig {
  storeName?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  taxNumber?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==================== معاينة على الشاشة (React) ====================
const ReceiptPreview: React.FC<{
  saleData: NonNullable<ReceiptPrintModalProps['saleData']>;
  storeConfig: StoreConfig;
  printFormat: PrintFormat;
}> = ({ saleData, storeConfig, printFormat }) => {
  const s = SIZES[printFormat];

  const displayStoreName = storeConfig.storeName || saleData.storeName || 'متجر الملابس';
  const displayBranchName = storeConfig.branchName || saleData.branchName || 'الفرع الرئيسي';
  const displayAddress = storeConfig.branchAddress || saleData.branchAddress;
  const displayPhone = storeConfig.branchPhone || saleData.branchPhone;
  const displayHeaderNote = storeConfig.receiptHeader || saleData.receiptHeader;
  const displayFooterNote = storeConfig.receiptFooter || saleData.receiptFooter;

  return (
    <div
      dir="rtl"
      className="bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-2 mx-auto"
      style={{ maxWidth: printFormat === '58mm' ? 280 : printFormat === '80mm' ? 360 : 650, fontFamily: FONT_STACK }}
    >
      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-slate-700">
        <h2 style={{ fontSize: s.header, fontWeight: 900, margin: 0, color: '#fff' }}>{displayStoreName}</h2>
        {displayBranchName && <p style={{ fontSize: s.sub, fontWeight: 700, margin: '1px 0 0' }}>{displayBranchName}</p>}
        {(displayAddress || displayPhone) && (
          <p style={{ fontSize: s.itemDetail, margin: '1px 0 0', opacity: 0.75, fontWeight: 600 }}>
            {[displayAddress, displayPhone].filter(Boolean).join(' • ')}
          </p>
        )}
        {displayHeaderNote && (
          <p style={{ fontSize: s.itemDetail, fontWeight: 700, margin: '2px 0 0', color: '#34d399' }}>{displayHeaderNote}</p>
        )}
        <div style={{ paddingTop: 3 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: s.itemDetail,
              fontWeight: 700,
              background: '#1e293b',
              color: '#e2e8f0',
            }}
          >
            فاتورة مبيعات (Sales Receipt)
          </span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: s.meta, fontWeight: 600 }} className="border-b border-dashed border-slate-700 pb-2">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span style={{ fontWeight: 900 }}>{saleData.invoiceNumber ? saleData.invoiceNumber.replace(/^INV-0*/i, '') : '1'}</span>
        </div>
        <div className="flex justify-between">
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
        <div className="flex justify-between">
          <span>اسم البائع:</span>
          <span style={{ fontWeight: 900 }}>{saleData.cashierName || 'المالك'}</span>
        </div>
        <div className="flex justify-between">
          <span>اسم العميل:</span>
          <span>{saleData.customerName || 'عميل نقدي عام'}</span>
        </div>
      </div>

      {/* Items */}
      <div className="border-b border-dashed border-slate-700 pb-2">
        <div
          style={{ fontSize: s.itemHead, fontWeight: 700, opacity: 0.7 }}
          className="flex justify-between pb-1 border-b border-slate-800"
        >
          <span style={{ width: '50%' }}>الصنف</span>
          <span style={{ width: '17%', textAlign: 'center' }}>الكمية</span>
          <span style={{ width: '33%', textAlign: 'left' }}>الإجمالي</span>
        </div>
        {saleData.items.map((item, idx) => (
          <div key={idx} style={{ marginTop: 4 }}>
            <div style={{ fontSize: s.itemBody, fontWeight: 800 }} className="flex justify-between">
              <span style={{ width: '50%', wordBreak: 'break-word' }}>{item.productNameAr}</span>
              <span style={{ width: '17%', textAlign: 'center' }}>{item.quantity}</span>
              <span style={{ width: '33%', textAlign: 'left' }}>{item.totalPrice.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: s.itemDetail, opacity: 0.75, fontWeight: 600 }}>
              {item.sizeCode && !['Std', 'N/A', 'غير محدد', 'عام'].includes(item.sizeCode) && <span>مقاس: {item.sizeCode}</span>}
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
      <div style={{ fontSize: s.totals, fontWeight: 700 }} className="border-b border-dashed border-slate-700 pb-2">
        <div className="flex justify-between gap-2">
          <span>المجموع الفرعي:</span>
          <span className="shrink-0 whitespace-nowrap">{saleData.subtotal.toFixed(2)} ج.م</span>
        </div>
        {saleData.discountAmount > 0 && (
          <div className="flex justify-between" style={{ color: '#fbbf24' }}>
            <span>إجمالي الخصم:</span>
            <span>-{saleData.discountAmount.toFixed(2)} ج.م</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span>الضريبة ({saleData.taxRate}%):</span>
          <span className="shrink-0 whitespace-nowrap">{saleData.taxAmount.toFixed(2)} ج.م</span>
        </div>
        <div
          style={{ fontSize: s.totalsFinal, fontWeight: 900, paddingTop: 4, marginTop: 4, color: '#fff' }}
          className="flex justify-between border-t border-slate-800"
        >
          <span>الإجمالي شامل الضريبة:</span>
          <span style={{ color: '#34d399' }}>{saleData.totalAmount.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Payment */}
      <div style={{ fontSize: s.meta, fontWeight: 600 }} className="border-b border-dashed border-slate-700 pb-2">
        <div className="flex justify-between">
          <span>طريقة الدفع:</span>
          <span style={{ fontWeight: 900 }}>
            {saleData.paymentMethod === 'cash' ? 'نقداً (Cash)' : saleData.paymentMethod === 'card' ? 'بطاقة (Card)' : 'مجزأ / أخر'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>المبلغ المدفوع:</span>
          <span>{saleData.paidAmount.toFixed(2)} ج.م</span>
        </div>
        <div className="flex justify-between gap-2" style={{ color: '#fcd34d' }}>
          <span>المتبقي / الباقي:</span>
          <span className="shrink-0 whitespace-nowrap">{saleData.changeAmount.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: s.footer, whiteSpace: 'pre-line', margin: 0, opacity: 0.8, fontWeight: 600 }}>
          {displayFooterNote || 'شكراً لتسوقكم معنا!\nيرجى الاحتفاظ بالفاتورة للاستبدال والاسترجاع خلال 14 يوماً.'}
        </p>
        <span style={{ fontSize: s.footer, fontWeight: 700, opacity: 0.55 }}>#{saleData.invoiceNumber}</span>
      </div>
    </div>
  );
};

// ==================== مستند الطباعة (HTML خام مستقل) ====================
function buildReceiptHtml(
  saleData: NonNullable<ReceiptPrintModalProps['saleData']>,
  storeConfig: StoreConfig,
  printFormat: PrintFormat
): string {
  const s = SIZES[printFormat];

  const displayStoreName = storeConfig.storeName || saleData.storeName || 'متجر الملابس';
  const displayBranchName = storeConfig.branchName || saleData.branchName || 'الفرع الرئيسي';
  const displayAddress = storeConfig.branchAddress || saleData.branchAddress;
  const displayPhone = storeConfig.branchPhone || saleData.branchPhone;
  const displayHeaderNote = storeConfig.receiptHeader || saleData.receiptHeader;
  const displayFooterNote =
    storeConfig.receiptFooter || saleData.receiptFooter || 'شكراً لتسوقكم معنا!\nيرجى الاحتفاظ بالفاتورة للاستبدال والاسترجاع خلال 14 يوماً.';

  const d = new Date(saleData.createdAt);
  const datePart = d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const itemsHtml = saleData.items
    .map((item) => {
      const detailBits = [
        item.sizeCode && !['Std', 'N/A', 'غير محدد', 'عام'].includes(item.sizeCode) ? `مقاس: ${escapeHtml(item.sizeCode)}` : '',
        item.colorNameAr && !['عام', 'بدون', 'غير محدد', 'أسود/افتراضي'].includes(item.colorNameAr)
          ? `لون: ${escapeHtml(item.colorNameAr)}`
          : '',
        `سعر: ${item.unitPrice.toFixed(2)}`,
        item.discountAmount > 0 ? `(خصم ${item.discountAmount.toFixed(2)})` : '',
      ].filter(Boolean);

      return `
        <div class="item-row">
          <div class="item-main">
            <span class="item-name">${escapeHtml(item.productNameAr)}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-total">${item.totalPrice.toFixed(2)}</span>
          </div>
          <div class="item-detail">${detailBits.join(' &nbsp; ')}</div>
        </div>`;
    })
    .join('');

  const pageSize = printFormat === '58mm' ? '58mm auto' : printFormat === '80mm' ? '80mm auto' : 'A4';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>فاتورة ${escapeHtml(saleData.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    font-family: ${FONT_STACK};
    color: #000000;
    width: ${s.widthMm}mm;
    max-width: 100%;
    margin: 0 auto;
    padding: ${s.padding};
  }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: nowrap; }
  .dashed { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
  .solid { border-bottom: 1px solid #000; }

  /* صف تسمية/قيمة (رقم الفاتورة، الإجماليات، ...) — القيمة تفضل سطر واحد ثابت
     دايماً، والتسمية تاخد المساحة المتبقية وتتقلص أو تلف هي لوحدها لو طالت،
     عشان القيمة ميتقسمش هي كمان على سطرين زي ما كان بيحصل */
  .kv { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: nowrap; gap: 6px; }
  .kv > span:first-child { flex: 1 1 auto; min-width: 0; }
  .kv > span:last-child { flex: 0 0 auto; white-space: nowrap; }

  h2.store-name { font-size: ${s.header}px; font-weight: 900; margin: 0; }
  .branch-name { font-size: ${s.sub}px; font-weight: 700; margin: 1px 0 0; }
  .branch-meta { font-size: ${s.itemDetail}px; font-weight: 600; margin: 1px 0 0; }
  .header-note { font-size: ${s.itemDetail}px; font-weight: 700; margin: 2px 0 0; }
  .badge { display: inline-block; padding: 2px 10px; border: 1px solid #000; border-radius: 3px; font-size: ${s.itemDetail}px; font-weight: 700; margin-top: 3px; }

  .meta-block { font-size: ${s.meta}px; font-weight: 600; }
  .meta-block .kv { margin-bottom: 2px; }
  .meta-block .kv span:last-child { font-weight: 900; }

  .items-head { font-size: ${s.itemHead}px; font-weight: 700; padding-bottom: 3px; margin-bottom: 3px; }
  .item-row { margin-bottom: 3px; }
  .item-main { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: nowrap; font-size: ${s.itemBody}px; font-weight: 800; }
  .item-detail { font-size: ${s.itemDetail}px; font-weight: 600; opacity: 0.85; }
  .item-name { width: 50%; word-break: break-word; }
  .item-qty { width: 17%; text-align: center; flex-shrink: 0; }
  .item-total { width: 33%; text-align: left; flex-shrink: 0; }

  .totals { font-size: ${s.totals}px; font-weight: 700; }
  .totals .kv { margin-bottom: 2px; }
  .totals-final { font-size: ${s.totalsFinal}px; font-weight: 900; padding-top: 4px; margin-top: 4px; }

  .footer-note { font-size: ${s.footer}px; font-weight: 600; white-space: pre-line; margin: 0 0 4px; }
  .invoice-tag { font-size: ${s.footer}px; font-weight: 700; opacity: 0.7; }

  @page { size: ${pageSize}; margin: ${printFormat === 'a4' ? '10mm' : '0mm'}; }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="center dashed">
    <h2 class="store-name">${escapeHtml(displayStoreName)}</h2>
    ${displayBranchName ? `<p class="branch-name">${escapeHtml(displayBranchName)}</p>` : ''}
    ${
      displayAddress || displayPhone
        ? `<p class="branch-meta">${escapeHtml([displayAddress, displayPhone].filter(Boolean).join(' • '))}</p>`
        : ''
    }
    ${displayHeaderNote ? `<p class="header-note">${escapeHtml(displayHeaderNote)}</p>` : ''}
    <span class="badge">فاتورة مبيعات (Sales Receipt)</span>
  </div>

  <div class="meta-block dashed">
    <div class="kv"><span>رقم الفاتورة:</span><span>${escapeHtml(
      saleData.invoiceNumber ? saleData.invoiceNumber.replace(/^INV-0*/i, '') : '1'
    )}</span></div>
    <div class="kv"><span>التاريخ والوقت:</span><span style="font-weight:600">${datePart} &nbsp; ${timePart}</span></div>
    <div class="kv"><span>اسم البائع:</span><span>${escapeHtml(saleData.cashierName || 'المالك')}</span></div>
    <div class="kv"><span>اسم العميل:</span><span style="font-weight:600">${escapeHtml(saleData.customerName || 'عميل نقدي عام')}</span></div>
  </div>

  <div class="dashed">
    <div class="row items-head solid">
      <span class="item-name">الصنف</span>
      <span class="item-qty">الكمية</span>
      <span class="item-total">الإجمالي</span>
    </div>
    ${itemsHtml}
  </div>

  <div class="totals dashed">
    <div class="kv"><span>المجموع الفرعي:</span><span>${saleData.subtotal.toFixed(2)} ج.م</span></div>
    ${
      saleData.discountAmount > 0
        ? `<div class="kv"><span>إجمالي الخصم:</span><span>-${saleData.discountAmount.toFixed(2)} ج.م</span></div>`
        : ''
    }
    <div class="kv"><span>الضريبة (${saleData.taxRate}%):</span><span>${saleData.taxAmount.toFixed(2)} ج.م</span></div>
    <div class="kv totals-final solid"><span>الإجمالي شامل الضريبة:</span><span>${saleData.totalAmount.toFixed(2)} ج.م</span></div>
  </div>

  <div class="meta-block dashed">
    <div class="kv"><span>طريقة الدفع:</span><span>${
      saleData.paymentMethod === 'cash' ? 'نقداً (Cash)' : saleData.paymentMethod === 'card' ? 'بطاقة (Card)' : 'مجزأ / أخر'
    }</span></div>
    <div class="kv"><span>المبلغ المدفوع:</span><span style="font-weight:600">${saleData.paidAmount.toFixed(2)} ج.م</span></div>
    <div class="kv"><span>المتبقي / الباقي:</span><span style="font-weight:600">${saleData.changeAmount.toFixed(2)} ج.م</span></div>
  </div>

  <div class="center">
    <p class="footer-note">${escapeHtml(displayFooterNote)}</p>
    <span class="invoice-tag">#${escapeHtml(saleData.invoiceNumber)}</span>
  </div>
</body>
</html>`;
}

// الطباعة الفعلية: iframe مخفي معزول تماماً عن باقي الصفحة، بمستند HTML مستقل
function printViaIframe(html: string) {
  const oldFrame = document.getElementById('receipt-print-iframe');
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'receipt-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print error:', e);
    }
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => {
      iframe.remove();
    };
  }
  setTimeout(triggerPrint, 250);
  setTimeout(() => {
    if (document.getElementById('receipt-print-iframe')) iframe.remove();
  }, 60000);
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({ isOpen, onClose, saleData }) => {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('80mm');
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({});

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
    const html = buildReceiptHtml(saleData, storeConfig, printFormat);
    printViaIframe(html);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="فاتورة ضريبية مبسطة (معاينة وطباعة)" maxWidth="md">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* PRINT FORMAT SELECTOR */}
        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
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

        {/* معاينة على الشاشة فقط — الطباعة بتحصل من مستند منفصل تماماً */}
        <ReceiptPreview saleData={saleData} storeConfig={storeConfig} printFormat={printFormat} />

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
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