import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any | null; // Single product with variants
  allProducts?: any[]; // Batch mode
}

type LabelFormat = '50x30' | '50x25' | 'a4';

// ==============================================================================
// Official International Code 128 B Standard Encoder
// Guaranteed 100% scannable by physical USB/Bluetooth handheld barcode scanners
// ==============================================================================
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '222121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=StartB, 106=Stop)
];

function generateCode128Bars(text: string): { width: number; isBar: boolean }[] {
  const clean = (text || '628100000000').trim();
  const symbolIndices: number[] = [104]; // Start Code B
  let checksumSum = 104;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    let symIdx = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    symbolIndices.push(symIdx);
    checksumSum += (i + 1) * symIdx;
  }

  const checksumIdx = checksumSum % 103;
  symbolIndices.push(checksumIdx);
  symbolIndices.push(106); // Stop symbol

  const bars: { width: number; isBar: boolean }[] = [];
  bars.push({ width: 10, isBar: false });

  for (const symIdx of symbolIndices) {
    const patternStr = CODE128_PATTERNS[symIdx] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let p = 0; p < patternStr.length; p++) {
      const width = parseInt(patternStr[p], 10);
      bars.push({ width, isBar });
      isBar = !isBar;
    }
  }

  bars.push({ width: 10, isBar: false });
  return bars;
}

// نسخة الباركود بتاعة المعاينة على الشاشة (React SVG عادي)
const BarcodeSVG: React.FC<{ code: string }> = ({ code }) => {
  const bars = generateCode128Bars(code);
  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);

  return (
    <div className="flex flex-col items-center select-none w-full">
      <svg
        viewBox={`0 0 ${totalWidth} 45`}
        className="w-full h-9"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {bars.map((bar, idx) => {
          const currentX = bars.slice(0, idx).reduce((acc, b) => acc + b.width, 0);
          return bar.isBar ? (
            <rect key={idx} x={currentX} y="0" width={bar.width} height="45" fill="black" shapeRendering="crispEdges" />
          ) : null;
        })}
      </svg>
      <span className="text-[10px] font-mono tracking-wider font-bold text-black mt-0.5 leading-none">
        {code || '628100000000'}
      </span>
    </div>
  );
};

// نسخة الباركود كـ SVG خام (نص) — تُستخدم في مستند الطباعة المستقل
function buildBarcodeSvgMarkup(code: string): string {
  const bars = generateCode128Bars(code);
  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);
  let x = 0;
  let rects = '';
  for (const bar of bars) {
    if (bar.isBar) {
      rects += `<rect x="${x}" y="0" width="${bar.width}" height="45" fill="black"/>`;
    }
    x += bar.width;
  }
  return `<svg viewBox="0 0 ${totalWidth} 45" style="width:100%;height:34px;display:block" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface LabelItem {
  key: string;
  prodName: string;
  price: string;
  barcodeCode: string;
  sku: string;
  specLabel: string;
}

function buildLabelItems(targets: any[], product: any, copiesPerVariant: number, useStockQty: boolean): LabelItem[] {
  const items: LabelItem[] = [];
  targets.forEach((v: any, vIdx: number) => {
    const count = useStockQty ? Math.max(1, v.branch_variant_stock?.[0]?.quantity || 1) : copiesPerVariant;
    const prodName = product?.name_ar || v.products?.name_ar || 'منتج';
    const price = Number(v.selling_price || product?.base_price || 0).toFixed(2);
    const barcodeCode = v.barcode || v.sku || '628100000000';
    const sizeLabel = v.sizes?.code && !['N/A', 'Std'].includes(v.sizes.code) ? v.sizes.code : null;
    const colorLabel = v.colors?.name_ar && !['عام', 'بدون'].includes(v.colors.name_ar) ? v.colors.name_ar : null;
    const specLabel = [colorLabel, sizeLabel].filter(Boolean).join(' / ');

    for (let cIdx = 0; cIdx < count; cIdx++) {
      items.push({ key: `${vIdx}-${cIdx}`, prodName, price, barcodeCode, sku: v.sku, specLabel });
    }
  });
  return items;
}

// ستيكر واحد للمعاينة على الشاشة فقط
const StickerLabel: React.FC<{ item: LabelItem; labelFormat: LabelFormat }> = ({ item, labelFormat }) => (
  <div
    style={{ width: '50mm', height: labelFormat === '50x25' ? '25mm' : '30mm' }}
    className="barcode-sticker border-2 border-black p-1 bg-white flex flex-col justify-between items-center text-center shadow-md rounded overflow-hidden select-none"
  >
    <div className="w-full flex items-center justify-between border-b border-black/40 pb-0.5 text-[8px] font-black text-black leading-none">
      <span className="truncate max-w-[30mm]">Poker</span>
      {/* {item.specLabel ? (
        <span className="bg-black text-white px-1 py-0.2 rounded text-[7px] font-bold truncate">{item.specLabel}</span>
      ) : (
        <span className="text-[7px]">قياسي</span>
      )} */}
    </div>
    <h5 className="text-[10px] font-black text-black leading-tight truncate w-full px-0.5 my-0.5">{item.prodName}</h5>
    <BarcodeSVG code={item.barcodeCode} />
    <div className="w-full flex items-center justify-between border-t border-black/40 pt-0.5 text-[9px] font-black text-black leading-none">
      <span className="font-mono text-[7.5px] truncate max-w-[25mm]">SKU: {item.sku}</span>
      <span className="font-mono font-bold bg-black text-white px-1 py-0.2 rounded text-[8.5px]">{item.price} ج.م</span>
    </div>
  </div>
);

// بناء ستيكر واحد كـ HTML خام لمستند الطباعة
function buildStickerHtml(item: LabelItem, labelFormat: LabelFormat): string {
  return `
    <div class="sticker">
      <div class="row header">
        <span class="store-name">متجر الملابس</span>
        ${
          item.specLabel
            ? `<span class="spec-badge">${escapeHtml(item.specLabel)}</span>`
            : `<span class="spec-generic">قياسي</span>`
        }
      </div>
      <h5 class="prod-name">${escapeHtml(item.prodName)}</h5>
      <div class="barcode-wrap">
        ${buildBarcodeSvgMarkup(item.barcodeCode)}
        <span class="barcode-text">${escapeHtml(item.barcodeCode)}</span>
      </div>
      <div class="row footer">
        <span class="sku">SKU: ${escapeHtml(item.sku)}</span>
        <span class="price">${escapeHtml(item.price)} ج.م</span>
      </div>
    </div>`;
}

// بناء مستند HTML كامل ومستقل تماماً عن CSS التطبيق، عشان نضمن إنه يطبع
// صح 100% من غير أي تعارض مع استايلات الصفحة الأصلية
function buildPrintDocument(items: LabelItem[], labelFormat: LabelFormat): string {
  const heightMm = labelFormat === '50x25' ? 25 : 30;
  const pageSize = labelFormat === '50x25' ? '50mm 25mm' : labelFormat === '50x30' ? '50mm 30mm' : 'A4';
  const sheetCss =
    labelFormat === 'a4'
      ? `display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;padding:10mm;`
      : `display:flex;flex-direction:column;align-items:center;`;
  const stickerPageBreak =
    labelFormat === 'a4'
      ? ''
      : `.sticker{page-break-after:always;break-after:page;} .sticker:last-child{page-break-after:auto;break-after:auto;}`;

  const stickersHtml = items.map((item) => buildStickerHtml(item, labelFormat)).join('\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>طباعة الباركود</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: 'Courier New', Courier, monospace, Cairo, sans-serif; color: #000000; }
  .sheet { ${sheetCss} }
  .sticker {
    width: 50mm;
    height: ${heightMm}mm;
    border: 1px solid #000;
    padding: 1mm;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  ${stickerPageBreak}
  .row { width: 100%; display: flex; justify-content: space-between; align-items: center; line-height: 1; }
  .header { font-size: 8px; font-weight: 900; border-bottom: 1px solid rgba(0,0,0,.4); padding-bottom: 1px; margin-bottom: 1px; }
  .footer { font-size: 9px; font-weight: 900; border-top: 1px solid rgba(0,0,0,.4); padding-top: 1px; margin-top: 1px; }
  .store-name { max-width: 30mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spec-badge { background: #000; color: #fff; padding: 0 3px; border-radius: 2px; font-size: 7px; font-weight: 700; }
  .spec-generic { font-size: 7px; }
  .prod-name { font-size: 10px; font-weight: 900; margin: 1px 0; width: 100%; padding: 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .barcode-wrap { display: flex; flex-direction: column; align-items: center; width: 100%; }
  .barcode-text { font-size: 9px; font-family: monospace; font-weight: 700; letter-spacing: 1px; margin-top: 1px; }
  .sku { font-family: monospace; font-size: 7.5px; max-width: 25mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .price { font-family: monospace; font-weight: 700; background: #000; color: #fff; padding: 0 3px; border-radius: 2px; font-size: 8.5px; }
  @page { size: ${pageSize}; margin: 0; }
</style>
</head>
<body>
  <div class="sheet">
    ${stickersHtml}
  </div>
</body>
</html>`;
}

// الطباعة الفعلية: iframe مخفي معزول تماماً عن باقي الصفحة، بمستند HTML مستقل
function printViaIframe(html: string) {
  const oldFrame = document.getElementById('barcode-print-iframe');
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'barcode-print-iframe';
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
  // بعض المتصفحات محتاجة وقت بسيط عشان الـ SVG والخطوط تترسم قبل الطباعة
  setTimeout(triggerPrint, 250);

  // تنضيف احتياطي لو حدث afterprint متطلعش
  setTimeout(() => {
    if (document.getElementById('barcode-print-iframe')) {
      iframe.remove();
    }
  }, 60000);
}

const LabelsGrid: React.FC<{ items: LabelItem[]; labelFormat: LabelFormat }> = ({ items, labelFormat }) => (
  <div
    className={
      labelFormat === 'a4'
        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
        : 'flex flex-wrap gap-3 justify-center'
    }
  >
    {items.map((item) => (
      <StickerLabel key={item.key} item={item} labelFormat={labelFormat} />
    ))}
  </div>
);

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({ isOpen, onClose, product, allProducts = [] }) => {
  const [copiesPerVariant, setCopiesPerVariant] = useState<number>(1);
  const [useStockQty, setUseStockQty] = useState<boolean>(false);
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('50x30');

  const targets = product ? product.product_variants || [] : allProducts.flatMap((p) => p.product_variants || []);
  const items = buildLabelItems(targets, product, copiesPerVariant, useStockQty);

  const handlePrint = () => {
    if (items.length === 0) return;
    const html = buildPrintDocument(items, labelFormat);
    printViaIframe(html);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="طباعة ملصقات الباركود (Barcode Thermal Labels)" maxWidth="lg">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Controls Toolbar */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">مقاس ملصق الباركود (الاستيكر):</label>
            <Select
              options={[
                { value: '50x30', label: '5سم × 3سم (50mm × 30mm) - استيكر عريض' },
                { value: '50x25', label: '5سم × 2.5سم (50mm × 25mm) - استيكر رفيع' },
                { value: 'a4', label: 'ورق عادي A4 (شبكة ملصقات)' },
              ]}
              value={labelFormat}
              onChange={(e) => setLabelFormat(e.target.value as any)}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">عدد الملصقات لكل صنف:</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copiesPerVariant}
              disabled={useStockQty}
              onChange={(e) => setCopiesPerVariant(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full text-center"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-4">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={useStockQty}
                onChange={(e) => setUseStockQty(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>طبع حسب الكمية</span>
            </label>

            <Button variant="success" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              طباعة الآن
            </Button>
          </div>
        </div>

        {/* Informational banner */}
        <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarcodeIcon className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>
              باركود قياسي <strong>Code 128 قياسي ومقروء 100%</strong> بواسطة جميع أجهزة ومقارئ الباركود اليدوية والكاميرا.
            </span>
          </div>
          <span className="bg-indigo-900/80 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold">Code 128 Standard</span>
        </div>

        {/* معاينة على الشاشة فقط — الطباعة بتحصل من مستند منفصل تماماً، مش من هنا */}
        <div className="p-4 bg-slate-100 rounded-xl text-black max-h-[60vh] overflow-y-auto border border-slate-300 shadow-inner">
          {items.length > 0 ? (
            <LabelsGrid items={items} labelFormat={labelFormat} />
          ) : (
            <p className="text-center text-slate-500 py-6 text-sm">لا يوجد أصناف/متغيرات لطباعة ملصقاتها.</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button variant="primary" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
            طباعة الاستيكرات
          </Button>
        </div>
      </div>
    </Dialog>
  );
};