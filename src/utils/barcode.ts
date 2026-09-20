export function generateBarcode(): string {
  // Generates 12-digit barcode with prefix 6281 (Saudi EAN standard format)
  const prefix = '6281';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
}

export function generateSKU(productCode: string, colorCode: string, sizeCode: string): string {
  const cleanCode = (productCode || 'PROD').replace(/\s+/g, '-').toUpperCase();
  const cleanColor = (colorCode || 'CLR').toUpperCase();
  const cleanSize = (sizeCode || 'SZ').toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  
  return `${cleanCode}-${cleanColor}-${cleanSize}-${randomSuffix}`;
}
