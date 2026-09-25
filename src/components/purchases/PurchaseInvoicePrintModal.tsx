import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Printer, ShoppingBag, Truck, CheckCircle2, UserCheck, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface PurchaseInvoiceData {
  id: string;
  purchase_number: string;
  created_at: string;
  supplier_name?: string;
  supplier_phone?: string;
  supplier_company?: string;
  handler_name?: string;
  notes?: string | null;
  total_amount: number;
  paid_amount?: number;
  status: string;
  items: Array<{
    variant_id?: string;
    product_name: string;
    sku: string;
    size_code?: string;
    color_name?: string;
    quantity: number;
    unit_cost_price: number;
    selling_price?: number;
    min_selling_price?: number;
    total_cost: number;
  }>;
}

interface PurchaseInvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseData: PurchaseInvoiceData | null;
}

type PrintFormat = '80mm' | '58mm' | 'a4';

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

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPurchaseInvoiceHtml(
  po: PurchaseInvoiceData,
  storeConfig: { storeName?: string; branchName?: string },
  printFormat: PrintFormat
): string {
  const s = SIZES[printFormat];
  const storeName = storeConfig.storeName || 'متجر الملابس';
  const branchName = storeConfig.branchName || 'الفرع الرئيسي';

  const d = new Date(po.created_at || Date.now());
  const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const itemsHtml = po.items
    .map((item) => {
      const detailBits = [
        item.sku ? `كود: ${escapeHtml(item.sku)}` : '',
        item.size_code && !['Std', 'N/A', 'غير محدد'].includes(item.size_code) ? `مقاس: ${escapeHtml(item.size_code)}` : '',
        item.selling_price ? `بيع: ${item.selling_price.toFixed(2)} ج.م` : '',
        item.min_selling_price ? `أقل بيع: ${item.min_selling_price.toFixed(2)} ج.م` : '',
      ].filter(Boolean);

      return `
        <div class="item-row">
          <div class="item-main">
            <span class="item-name">${escapeHtml(item.product_name)}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-cost">${item.unit_cost_price.toFixed(2)}</span>
            <span class="item-total">${item.total_cost.toFixed(2)}</span>
          </div>
          <div class="item-detail">${detailBits.join(' &nbsp;•&nbsp; ')}</div>
        </div>`;
    })
    .join('');

  const pageSize = printFormat === '58mm' ? '58mm auto' : printFormat === '80mm' ? '80mm auto' : 'A4';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>فاتورة أمر شراء ${escapeHtml(po.purchase_number)}</title>
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
  .dashed { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
  .solid { border-bottom: 1.5px solid #000; }

  .kv { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: nowrap; gap: 6px; }
  .kv > span:first-child { flex: 1 1 auto; min-width: 0; }
  .kv > span:last-child { flex: 0 0 auto; white-space: nowrap; font-weight: 700; }

  h2.store-name { font-size: ${s.header}px; font-weight: 900; margin: 0; }
  .branch-name { font-size: ${s.sub}px; font-weight: 700; margin: 1px 0 0; }
  .badge { display: inline-block; padding: 3px 10px; border: 1.5px solid #000; border-radius: 4px; font-size: ${s.itemDetail}px; font-weight: 900; margin-top: 4px; background: #f8fafc; }

  .meta-block { font-size: ${s.meta}px; font-weight: 600; }
  .meta-block .kv { margin-bottom: 3px; }

  .items-head { font-size: ${s.itemHead}px; font-weight: 900; padding-bottom: 4px; margin-bottom: 4px; }
  .item-row { margin-bottom: 4px; border-bottom: 1px dotted #ccc; padding-bottom: 3px; }
  .item-main { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: nowrap; font-size: ${s.itemBody}px; font-weight: 800; }
  .item-detail { font-size: ${s.itemDetail}px; font-weight: 600; opacity: 0.85; margin-top: 1px; }
  
  .item-name { width: 40%; word-break: break-word; }
  .item-qty { width: 15%; text-align: center; flex-shrink: 0; }
  .item-cost { width: 22%; text-align: center; flex-shrink: 0; }
  .item-total { width: 23%; text-align: left; flex-shrink: 0; }

  .totals { font-size: ${s.totals}px; font-weight: 700; }
  .totals-final { font-size: ${s.totalsFinal}px; font-weight: 900; padding-top: 4px; margin-top: 4px; }

  .footer-note { font-size: ${s.footer}px; font-weight: 600; margin: 6px 0 0; }

  @page { size: ${pageSize}; margin: ${printFormat === 'a4' ? '10mm' : '0mm'}; }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="center dashed">
    <h2 class="store-name">${escapeHtml(storeName)}</h2>
    <p class="branch-name">${escapeHtml(branchName)}</p>
    <div style="margin-top: 4px;">
      <span class="badge">فاتورة توريد / أمر شراء (Purchase Order)</span>
    </div>
  </div>

  <div class="meta-block dashed">
    <div class="kv"><span>رقم أمر الشراء:</span><span>#${escapeHtml(po.purchase_number)}</span></div>
    <div class="kv"><span>تاريخ التوريد:</span><span>${datePart} &nbsp; ${timePart}</span></div>
    <div class="kv"><span>اسم المورد:</span><span>${escapeHtml(po.supplier_name || 'عام / بدون اسم')}</span></div>
    ${po.supplier_company ? `<div class="kv"><span>الشركة المصنعة:</span><span>${escapeHtml(po.supplier_company)}</span></div>` : ''}
    <div class="kv"><span>مسؤول الاستلام:</span><span>${escapeHtml(po.handler_name || 'الكاشير')}</span></div>
  </div>

  <div class="dashed">
    <div class="row items-head solid">
      <span class="item-name">الصنف</span>
      <span class="item-qty">الكمية</span>
      <span class="item-cost">الجملة</span>
      <span class="item-total">الإجمالي</span>
    </div>
    ${itemsHtml}
  </div>

  <div class="totals dashed">
    <div class="kv"><span>إجمالي عدد الأصناف:</span><span>${po.items.length} صنف</span></div>
    <div class="kv"><span>إجمالي عدد القطع:</span><span>${po.items.reduce((acc, i) => acc + i.quantity, 0)} قطعة</span></div>
    <div class="kv totals-final solid"><span>صافي الفاتورة الإجمالي:</span><span>${Number(po.total_amount).toFixed(2)} ج.م</span></div>
  </div>

  <div class="center">
    <p class="footer-note">تم استلام وتحديث أرصدة المخزون بنجاح</p>
    <span style="font-size: 10px; font-weight: 700; opacity: 0.6;">#${escapeHtml(po.purchase_number)}</span>
  </div>
</body>
</html>`;
}

function printViaIframe(html: string) {
  const oldFrame = document.getElementById('po-print-iframe');
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'po-print-iframe';
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
}

export const PurchaseInvoicePrintModal: React.FC<PurchaseInvoicePrintModalProps> = ({
  isOpen,
  onClose,
  purchaseData,
}) => {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('80mm');

  if (!purchaseData) return null;

  const handlePrint = () => {
    const html = buildPurchaseInvoiceHtml(
      purchaseData,
      { storeName: 'متجر الملابس', branchName: 'الفرع الرئيسي' },
      printFormat
    );
    printViaIframe(html);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="فاتورة أمر الشراء والتوريد (معاينة وطباعة)" maxWidth="md">
      <div className="space-y-4 font-sans text-xs" dir="rtl">
        {/* Paper format selector */}
        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 font-semibold">قياس ورق الطباعة:</span>
          <div className="flex gap-1.5 font-bold">
            <button
              onClick={() => setPrintFormat('80mm')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === '80mm' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              80mm (طابعة حرارية)
            </button>
            <button
              onClick={() => setPrintFormat('a4')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === 'a4' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              A4 (فاتورة كاملة)
            </button>
            <button
              onClick={() => setPrintFormat('58mm')}
              className={`px-3 py-1 rounded-lg transition-all ${
                printFormat === '58mm' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              58mm (حراري صغير)
            </button>
          </div>
        </div>

        {/* Screen Preview */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Invoice Header */}
          <div className="border-b border-dashed border-slate-800 pb-3 text-center space-y-1">
            <div className="inline-flex items-center gap-2 bg-indigo-950/80 px-3 py-1 rounded-xl border border-indigo-700/60 text-indigo-300 font-bold mb-1">
              <ShoppingBag className="w-4 h-4" />
              <span>فاتورة أمر شراء بضاعة / توريد</span>
            </div>
            <h3 className="text-base font-black text-white"># {purchaseData.purchase_number}</h3>
            <div className="flex justify-center items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {new Date(purchaseData.created_at).toLocaleDateString('ar-EG')}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                المورد: <strong className="text-slate-200">{purchaseData.supplier_name || 'عام'}</strong>
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-slate-400 block">مسؤول الشراء / المستلم:</span>
              <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                {purchaseData.handler_name || 'الكاشير'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">حالة التوريد:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> تم الإضافة للمخزون
              </span>
            </div>
          </div>

          {/* Line items table */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 text-xs flex justify-between items-center border-b border-slate-800 pb-1.5">
              <span>الأصناف والمنتجات الواردة</span>
              <span className="text-slate-500 font-mono">({purchaseData.items.length} صنف)</span>
            </h4>

            <div className="space-y-1.5">
              {purchaseData.items.map((item, idx) => (
                <div key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center font-bold text-slate-100">
                    <span>{item.product_name}</span>
                    <span className="text-emerald-400 font-mono">{(item.total_cost).toFixed(2)} ج.م</span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>الكود: <strong className="font-mono text-slate-200">{item.sku}</strong></span>
                    <span>الكمية: <strong className="font-mono text-indigo-400">{item.quantity} قطعة</strong></span>
                    <span>جملة القطعة: <strong className="font-mono text-slate-200">{item.unit_cost_price.toFixed(2)} ج.م</strong></span>
                    {item.selling_price ? <span>سعر البيع: <strong className="font-mono text-slate-300">{item.selling_price.toFixed(2)} ج.م</strong></span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total */}
          <div className="bg-gradient-to-r from-emerald-950 to-indigo-950 p-4 rounded-xl border border-emerald-500/30 flex justify-between items-center font-bold">
            <span className="text-slate-200 text-xs">إجمالي فاتورة أمر الشراء:</span>
            <span className="text-lg font-mono font-black text-emerald-400">
              {Number(purchaseData.total_amount).toFixed(2)} ج.م
            </span>
          </div>
        </div>

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
