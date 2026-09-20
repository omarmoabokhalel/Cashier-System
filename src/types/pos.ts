export interface CartItem {
  variantId: string;
  productId: string;
  productNameAr: string;
  productNameEn?: string;
  sizeId?: string;
  sizeCode: string;
  sizeNameAr?: string;
  colorId?: string;
  colorNameAr: string;
  colorHex: string;
  sku: string;
  barcode: string;
  unitPrice: number;
  originalPrice: number;
  costPrice: number;
  discountAmount: number; // Flat discount per item
  quantity: number;
  stockQty: number;
  imageUrl?: string | null;
  taxRate?: number;
}

export interface HeldSale {
  id: string;
  heldAt: string;
  items: CartItem[];
  customer?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  note?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  cashierName?: string;
}

export interface POSCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints?: number;
  storeCredit?: number;
}

export interface POSSettings {
  allowNegativeStock: boolean;
  taxRate: number; // e.g. 15 for 15%
  receiptHeader: string;
  receiptFooter: string;
  autoPrintReceipt: boolean;
}
