import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { CartItem, HeldSale, POSCustomer, POSSettings } from '../../types/pos';
import { useBarcodeScanner } from '../../utils/barcodeScanner';
import { CameraScannerModal } from '../../components/pos/CameraScannerModal';
import { HeldSalesModal } from '../../components/pos/HeldSalesModal';
import { ItemDiscountModal } from '../../components/pos/ItemDiscountModal';
import { ReceiptPrintModal } from '../../components/pos/ReceiptPrintModal';
import { KeyboardShortcutsBar } from '../../components/pos/KeyboardShortcutsBar';
import { reconcileShiftTotals } from '../../utils/shiftReconciliation';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  User,
  Tag,
  Camera,
  PauseCircle,
  PlayCircle,
  Edit3,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Unlock,
  Landmark,
  DollarSign,
} from 'lucide-react';

const HELD_SALES_KEY = 'pos_held_sales_v1';

export const POSShell: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  // State: Catalog Data & Indexed Lookup Map
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // State: Cart & Selected Item
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // State: Order Level Discount in Payment Modal
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);

  // State: Customer
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer>({
    id: '',
    name: 'عميل نقدي عام',
    phone: null,
  });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // State: Held Sales
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

  // State: Modals & Payment
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [paidCashAmount, setPaidCashAmount] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  useEffect(() => {
    if (user?.fullName) {
      setSellerName(user.fullName);
    } else {
      const saved = localStorage.getItem('admin_display_name') || 'المالك / البائع';
      setSellerName(saved);
    }
  }, [user]);

  // State: Receipt Printing
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // State: Cashier Shift
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // POS Settings
  const [settings, setSettings] = useState<POSSettings>({
    allowNegativeStock: false,
    taxRate: 15,
    receiptHeader: 'متجر الملابس الأنيقة',
    receiptFooter: 'شكراً لتسوقكم معنا',
    autoPrintReceipt: true,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check Active Shift & Settings on Mount
  useEffect(() => {
    checkActiveShift();
    loadPOSSettings();
  }, []);

  const loadPOSSettings = async () => {
    try {
      // 1. Instant sync from localStorage
      const cached = localStorage.getItem('app_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        const tax = parsed.defaultTaxRate !== undefined ? Number(parsed.defaultTaxRate) : 15;
        setSettings((prev) => ({
          ...prev,
          taxRate: isNaN(tax) ? 15 : tax,
          allowNegativeStock: parsed.allowNegativeStock ?? prev.allowNegativeStock,
          receiptHeader: parsed.receiptHeader || prev.receiptHeader,
          receiptFooter: parsed.receiptFooter || prev.receiptFooter,
        }));
      }

      // 2. Fetch fresh config from Supabase app_config table
      const { data: configData } = await (supabase.from('app_config') as any).select('*');
      if (configData && configData.length > 0) {
        const cfg: Record<string, any> = {};
        configData.forEach((item: { key: string; value: any }) => {
          cfg[item.key] = item.value;
        });

        localStorage.setItem('app_config', JSON.stringify(cfg));

        const tax = cfg.defaultTaxRate !== undefined ? Number(cfg.defaultTaxRate) : 15;
        setSettings((prev) => ({
          ...prev,
          taxRate: isNaN(tax) ? 15 : tax,
          allowNegativeStock: cfg.allowNegativeStock ?? prev.allowNegativeStock,
          receiptHeader: cfg.receiptHeader || prev.receiptHeader,
          receiptFooter: cfg.receiptFooter || prev.receiptFooter,
        }));
      }
    } catch (err) {
      console.error('Error loading settings in POS:', err);
    }
  };

  const checkActiveShift = async () => {
    try {
      const { data: openShifts } = await (supabase.from('cashier_shifts') as any)
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (openShifts && openShifts.length > 0) {
        setActiveShift(openShifts[0]);
      } else {
        setActiveShift(null);
        setIsOpenShiftModalOpen(true);
      }
    } catch (e) {
      console.error('Error checking active shift:', e);
    }
  };

  const handleOpenShiftInPOS = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpeningShift(true);
    try {
      const isValidUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const defaultBranchId = '00000000-0000-0000-0000-000000000001';
      const defaultRegisterId = '00000000-0000-0000-0000-000000000001';
      const defaultCashierId = isValidUuid(user?.id) ? user!.id : '00000000-0000-0000-0000-000000000001';

      const { data: newShift, error } = await (supabase.from('cashier_shifts') as any)
        .insert({
          branch_id: defaultBranchId,
          cash_register_id: defaultRegisterId,
          cashier_id: defaultCashierId,
          opening_balance: parseFloat(openingBalance) || 0,
          status: 'open',
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        showToast('error', 'فشل فتح الوردية', error.message);
      } else {
        showToast('success', 'تم فتح وردية كاشير جديدة بنجاح!');
        setActiveShift(newShift);
        setIsOpenShiftModalOpen(false);
        setOpeningBalance('0');
      }
    } catch (err: any) {
      showToast('error', 'خطأ أثناء فتح الوردية', err.message);
    } finally {
      setIsOpeningShift(false);
    }
  };

  // Load Held Sales from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HELD_SALES_KEY);
      if (saved) {
        setHeldSales(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load held sales:', e);
    }
  }, []);

  // Save Held Sales to LocalStorage
  const saveHeldSalesToStorage = (sales: HeldSale[]) => {
    setHeldSales(sales);
    try {
      localStorage.setItem(HELD_SALES_KEY, JSON.stringify(sales));
    } catch (e) {
      console.error('Failed to save held sales:', e);
    }
  };

  // Load Catalog & Customer Data from Supabase
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      try {
        const [{ data: catData }, { data: prodData }, { data: custData }] = await Promise.all([
          supabase.from('categories').select('*').eq('is_active', true),
          supabase
            .from('product_variants')
            .select(`
              id, sku, barcode, selling_price, cost_price, discount_price, min_selling_price, image_url, deleted_at,
              sizes(id, code, name_ar),
              colors(id, name_ar, hex_code),
              products(id, name_ar, name_en, category_id, image_url, min_selling_price, deleted_at),
              branch_variant_stock(quantity)
            `)
            .eq('is_active', true)
            .is('deleted_at', null),
          supabase.from('customers').select('*'),
        ]);

        setCategories(catData || []);
        const activeVariants = (prodData || []).filter(
          (pv: any) => !pv.deleted_at && pv.products && !pv.products.deleted_at
        );
        setProducts(activeVariants);

        if (custData) {
          setCustomers(
            custData.map((c: any) => ({
              id: c.id,
              name: c.full_name,
              phone: c.phone,
              loyaltyPoints: c.loyalty_points ?? c.total_points ?? 0,
              storeCredit: c.store_credit_balance ?? 0,
            }))
          );
        }
      } catch (e) {
        console.error('Error loading POS catalog:', e);
        showToast('error', 'خطأ في التحميل', 'تعذر تحميل بيانات المنتجات من الخادم');
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Fast Barcode & SKU Lookup Map for O(1) matching
  const barcodeMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((pv) => {
      if (pv.barcode) {
        map.set(pv.barcode.toLowerCase().trim(), pv);
      }
      if (pv.sku) {
        map.set(pv.sku.toLowerCase().trim(), pv);
      }
    });
    return map;
  }, [products]);

  // Filtered Products for Grid display
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim() && selectedCategory === 'all') {
      return products;
    }
    const q = searchQuery.toLowerCase().trim();
    return products.filter((pv) => {
      const nameArMatch = pv.products?.name_ar?.toLowerCase().includes(q);
      const nameEnMatch = pv.products?.name_en?.toLowerCase().includes(q);
      const skuMatch = pv.sku?.toLowerCase().includes(q);
      const barcodeMatch = pv.barcode?.toLowerCase().includes(q);
      const categoryMatch = selectedCategory === 'all' || pv.products?.category_id === selectedCategory;

      return (nameArMatch || nameEnMatch || skuMatch || barcodeMatch) && categoryMatch;
    });
  }, [products, searchQuery, selectedCategory]);

  // Handle Adding Variant to Cart
  const handleAddVariantToCart = (pv: any) => {
    const stock = pv.branch_variant_stock?.[0]?.quantity ?? 0;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.variantId === pv.id);

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (!settings.allowNegativeStock && currentQty >= stock) {
          showToast('warning', 'الكمية غير متاحة', `تم الوصول للحد الأقصى للمخزون المتاح (${stock} قطعة)`);
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        setSelectedCartIndex(existingIndex);
        return updated;
      } else {
        if (!settings.allowNegativeStock && stock <= 0) {
          showToast('warning', 'نفاد المخزون', 'المنتج غير متوفر في مخزون الفرع الحالي');
          return prevCart;
        }
        const minPrice = Number(pv.min_selling_price || pv.products?.min_selling_price || 0);
        const unitPrice = Number(pv.selling_price);
        const newItem: CartItem = {
          variantId: pv.id,
          productId: pv.products?.id,
          productNameAr: pv.products?.name_ar || 'منتج غير معرف',
          productNameEn: pv.products?.name_en,
          sizeId: pv.sizes?.id,
          sizeCode: pv.sizes?.code || 'N/A',
          colorId: pv.colors?.id,
          colorNameAr: pv.colors?.name_ar || 'عام',
          colorHex: pv.colors?.hex_code || '#64748b',
          sku: pv.sku,
          barcode: pv.barcode,
          unitPrice,
          originalPrice: Number(pv.selling_price),
          costPrice: Number(pv.cost_price || 0),
          minSellingPrice: minPrice,
          discountAmount: 0,
          quantity: 1,
          stockQty: stock,
          imageUrl: pv.image_url || pv.products?.image_url,
        };
        setSelectedCartIndex(prevCart.length);
        return [...prevCart, newItem];
      }
    });
  };

  // Hardware Barcode Scan Event Handler
  const handleScanBarcode = (barcode: string) => {
    const matchedVariant = barcodeMap.get(barcode.toLowerCase().trim());
    if (matchedVariant) {
      handleAddVariantToCart(matchedVariant);
      showToast('success', 'تم مسح الباركود', `${matchedVariant.products?.name_ar} (${matchedVariant.sizes?.code})`);
      setSearchQuery('');
    } else {
      showToast('error', 'غير موجود', `لم يتم العثور على منتج بالباركود: ${barcode}`);
    }
  };

  // Attach Hardware USB / Bluetooth Scanner listener
  useBarcodeScanner({
    onScan: handleScanBarcode,
  });

  // Auto-detect typed Barcode / SKU match on input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    // If typed value is exact match for a barcode or SKU, auto-add to cart
    if (val.trim().length >= 4) {
      const match = barcodeMap.get(val.toLowerCase().trim());
      if (match) {
        handleAddVariantToCart(match);
        setSearchQuery('');
        showToast('success', 'إضافة سريعة', `${match.products?.name_ar}`);
      }
    }
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
  const totalItemDiscounts = cart.reduce(
    (acc, item) => acc + (item.originalPrice - item.unitPrice + item.discountAmount) * item.quantity,
    0
  );

  const orderDiscountAmount = useMemo(() => {
    const base = Math.max(0, subtotal - totalItemDiscounts);
    if (orderDiscountType === 'percentage') {
      return (base * Math.min(100, Math.max(0, orderDiscountValue))) / 100;
    }
    return Math.min(base, Math.max(0, orderDiscountValue));
  }, [subtotal, totalItemDiscounts, orderDiscountType, orderDiscountValue]);

  const totalDiscount = totalItemDiscounts + orderDiscountAmount;
  const netSubtotal = Math.max(0, subtotal - totalDiscount);
  const taxAmount = netSubtotal * (settings.taxRate / 100);
  const totalAmount = netSubtotal + taxAmount;
  const changeAmount = Math.max(0, (parseFloat(paidCashAmount) || totalAmount) - totalAmount);

  // Cart Actions
  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.quantity + delta;
            if (newQty > item.stockQty && !settings.allowNegativeStock) {
              showToast('warning', 'حد المخزون', `المخزون المتاح هو ${item.stockQty} فقط`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
    setSelectedCartIndex(null);
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartIndex(null);
    setOrderDiscountValue(0);
  };

  // Hold Current Sale ("تعليق الفاتورة")
  const handleHoldSale = () => {
    if (cart.length === 0) {
      showToast('warning', 'السلة فارغة', 'لا يمكن تعليق فاتورة فارغة');
      return;
    }

    const newHeldSale: HeldSale = {
      id: `HOLD-${Date.now()}`,
      heldAt: new Date().toISOString(),
      items: [...cart],
      customer: selectedCustomer.id ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phone || undefined } : null,
      subtotal,
      taxAmount,
      totalAmount,
      cashierName: user?.email || 'الكاشير',
    };

    saveHeldSalesToStorage([newHeldSale, ...heldSales]);
    clearCart();
    showToast('success', 'تم تعليق الفاتورة', 'تم حفظ الفاتورة في قائمة الفواتير المعلقة');
  };

  // Retrieve Held Sale ("استرجاع الفاتورة")
  const handleRetrieveSale = (sale: HeldSale) => {
    setCart(sale.items);
    if (sale.customer) {
      setSelectedCustomer({
        id: sale.customer.id,
        name: sale.customer.name,
        phone: sale.customer.phone || null,
      });
    }
    const updatedHeld = heldSales.filter((h) => h.id !== sale.id);
    saveHeldSalesToStorage(updatedHeld);
    showToast('success', 'تم استرجاع الفاتورة', `تم تحميل الفاتورة المعلقة #${sale.id.slice(-6)}`);
  };

  const handleDeleteHeldSale = (id: string) => {
    const updatedHeld = heldSales.filter((h) => h.id !== id);
    saveHeldSalesToStorage(updatedHeld);
    showToast('info', 'حذف الفاتورة', 'تم حذف الفاتورة المعلقة');
  };

  // Keyboard Hotkeys Listener (F2, F4, F6, F7, F8, ESC, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys if an editable dialog input is focused (unless F keys)
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          if (window.confirm('هل انت متأكد من بدء فاتورة جديدة وإلغاء الفاتورة الحالية؟')) {
            clearCart();
            showToast('info', 'فاتورة جديدة', 'تم تفريغ السلة لبدء فاتورة جديدة');
          }
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F7') {
        e.preventDefault();
        setIsHeldModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          showToast('warning', 'السلة فارغة', 'قم بإضافة منتجات قبل إتمام عملية الدفع');
        }
      } else if (e.key === 'Escape') {
        setSearchQuery('');
        setIsDiscountModalOpen(false);
        setIsPaymentModalOpen(false);
        setIsHeldModalOpen(false);
        setIsCameraScannerOpen(false);
        setIsCustomerModalOpen(false);
      } else if (e.key === 'Delete') {
        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
          removeFromCart(cart[selectedCartIndex].variantId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCartIndex, heldSales, selectedCustomer]);

  // Finalize Sale & Call Server-Side RPC
  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    if (!sellerName.trim()) {
      showToast('warning', 'اسم البائع مطلوب', 'يرجى إدخال اسم البائع قبل إتمام الشراء');
      return;
    }
    setIsProcessingSale(true);

    try {
      // Validate that no item in cart is below min_selling_price
      for (const item of cart) {
        const netUnitPrice = item.unitPrice - (item.discountAmount / (item.quantity || 1));
        const minPrice = item.minSellingPrice || 0;
        if (minPrice > 0 && netUnitPrice < minPrice) {
          showToast(
            'error',
            'عملية مرفوضة',
            `المنتج "${item.productNameAr}" سعره الصافي (${netUnitPrice.toFixed(2)} ج.م) أقل من الحد الأدنى المسموح به للبيع (${minPrice.toFixed(2)} ج.م)`
          );
          setIsProcessingSale(false);
          return;
        }
      }
      // Dynamic shift ID fallback or open auto shift
      let shiftId = '00000000-0000-0000-0000-000000000001';
      const { data: openShiftData } = await (supabase.from('cashier_shifts') as any)
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (openShiftData && openShiftData.length > 0) {
        shiftId = (openShiftData[0] as any).id;
      } else {
        const isValidUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const defaultBranchId = '00000000-0000-0000-0000-000000000001';
        const defaultRegisterId = '00000000-0000-0000-0000-000000000001';
        const defaultCashierId = isValidUuid(user?.id) ? user!.id : '00000000-0000-0000-0000-000000000001';

        const { data: newShift } = await (supabase.from('cashier_shifts') as any)
          .insert({
            branch_id: defaultBranchId,
            cash_register_id: defaultRegisterId,
            cashier_id: defaultCashierId,
            opening_balance: 0,
            status: 'open',
            opened_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newShift?.id) {
          shiftId = newShift.id;
        }
      }

      const itemsPayload = cart.map((item) => {
        const itemDiscount = (item.discountAmount || 0) + Math.max(0, (item.originalPrice - item.unitPrice) * item.quantity);
        const unitPrice = item.originalPrice || item.unitPrice;
        return {
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: unitPrice,
          cost_price: item.costPrice,
          discount_amount: itemDiscount,
          tax_amount: ((unitPrice * item.quantity) - itemDiscount) * (settings.taxRate / 100),
          total_price: (unitPrice * item.quantity) - itemDiscount,
        };
      });

      const paymentsPayload = [
        {
          payment_method: paymentMethod === 'split' ? 'cash' : paymentMethod,
          amount: totalAmount,
          reference_number: null,
        },
      ];

      const creatorRole = user?.roleCode || 'cashier';
      const saleNotes = orderDiscountAmount > 0
        ? `خصم فاتورة: -${orderDiscountAmount.toFixed(2)} ج.م | seller:${sellerName.trim()} | role:${creatorRole}`
        : `عملية بيع من POS | seller:${sellerName.trim()} | role:${creatorRole}`;

      const { data, error }: { data: any; error: any } = await (supabase.rpc as any)('rpc_create_sale', {
        p_cashier_shift_id: shiftId,
        p_customer_id: selectedCustomer.id || null,
        p_subtotal: subtotal,
        p_discount_amount: totalDiscount,
        p_coupon_id: null,
        p_tax_rate: settings.taxRate,
        p_tax_amount: taxAmount,
        p_total_amount: totalAmount,
        p_paid_amount: parseFloat(paidCashAmount) || totalAmount,
        p_change_amount: changeAmount,
        p_notes: saleNotes,
        p_items: itemsPayload,
        p_payments: paymentsPayload,
        p_idempotency_key: `POS-SALE-${Date.now()}-${Math.floor(Math.random()*10000)}`,
      });

      if (error) {
        showToast('error', 'فشلت عملية البيع', error.message);
      } else {
        showToast('success', 'تمت عملية البيع بنجاح!', `رقم الفاتورة: #${data?.invoice_number || '1'}`);

        // Reconcile shift cash totals immediately
        reconcileShiftTotals(shiftId).catch(console.error);

        // Process Customer Loyalty Points
        if (selectedCustomer.id && totalAmount > 0) {
          const rateEgp = 100;
          const pointsEarned = Math.floor(totalAmount / rateEgp);
          if (pointsEarned > 0) {
            const currentPoints = selectedCustomer.loyaltyPoints || 0;
            const updatedPoints = currentPoints + pointsEarned;
            
            try {
              // 1. Update customer loyalty_points
              await (supabase.from('customers') as any)
                .update({ loyalty_points: updatedPoints })
                .eq('id', selectedCustomer.id);

              // 2. Insert into loyalty_transactions
              await (supabase.from('loyalty_transactions') as any).insert({
                customer_id: selectedCustomer.id,
                sale_id: data?.id || null,
                transaction_type: 'earn',
                points: pointsEarned,
                amount_spent: totalAmount,
                notes: `إضافة ${pointsEarned} نقطة شراء من الفاتورة رقم ${data?.invoice_number || ''}`,
              });

              showToast('info', 'نقاط الولاء', `تم إضافة ${pointsEarned} نقطة ولاء للعميل (إجمالي الرصيد: ${updatedPoints} نقطة)`);
            } catch (errLoyalty) {
              console.error('Loyalty points update error:', errLoyalty);
            }
          }
        }

        // Set up receipt print data
        setCompletedSale({
          invoiceNumber: (data?.invoice_number || '1').replace(/^INV-0*/i, '') || '1',
          createdAt: new Date().toISOString(),
          cashierName: sellerName.trim() || user?.fullName || 'المالك / البائع',
          customerName: selectedCustomer.name,
          items: cart.map((i) => ({
            productNameAr: i.productNameAr,
            sizeCode: i.sizeCode,
            colorNameAr: i.colorNameAr,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountAmount: i.discountAmount,
            totalPrice: i.unitPrice * i.quantity,
          })),
          subtotal: netSubtotal,
          discountAmount: totalItemDiscounts,
          taxRate: settings.taxRate,
          taxAmount,
          totalAmount,
          paidAmount: parseFloat(paidCashAmount) || totalAmount,
          changeAmount,
          paymentMethod,
        });

        clearCart();
        setIsPaymentModalOpen(false);
        setIsReceiptModalOpen(true);
      }
    } catch (e: any) {
      showToast('error', 'خطأ أثناء تنفيذ العملية', e.message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  return (
    <div className="h-[calc(100vh-65px)] flex flex-col bg-slate-950 font-sans select-none overflow-hidden" dir="rtl">
      {/* SHIFT WARNING BANNER */}
      {!activeShift && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 px-4 py-2 text-white text-xs font-bold flex items-center justify-between shadow-lg shrink-0 border-b border-rose-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 animate-bounce text-amber-200" />
            <span>تنبيـه: لا توجد وردية كاشير مفتوحة حالياً! يُرجى فتح وردية للبدء في إجراء عمليات البيع واستلام النقدية.</span>
          </div>
          <Button
            onClick={() => setIsOpenShiftModalOpen(true)}
            size="sm"
            className="bg-white text-slate-950 hover:bg-slate-100 font-extrabold px-3 py-1 text-xs rounded-lg shadow"
          >
            <Unlock className="w-3.5 h-3.5 ml-1" />
            فتح وردية جديدة الآن
          </Button>
        </div>
      )}

      {/* MAIN TOP SECTION: SPLIT SCREEN */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* RIGHT PANE: SEARCH & PRODUCT CATALOG GRID */}
        <div className="flex-1 flex flex-col border-l border-slate-800 bg-slate-900/30 overflow-hidden">
          {/* SEARCH & BARCODE TOOLBAR */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2.5">
            <div className="relative flex-1">
              <Input
                ref={searchInputRef}
                placeholder="امسح الباركود، أو ابحث بالاسم، SKU (F2)..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                icon={<Search className="w-4 h-4 text-indigo-400" />}
              />
            </div>

            {/* Camera Scanner Toggle Button */}
            <Button
              variant="secondary"
              onClick={() => setIsCameraScannerOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 gap-1.5 shrink-0 px-3"
              title="مسح بالكاميرا"
            >
              <Camera className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline text-xs">الكاميرا</span>
            </Button>

            <Badge variant="primary" size="md" className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-indigo-950/80 border border-indigo-800/60 shrink-0">
              <Barcode className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs">الماسح مفعل</span>
            </Badge>
          </div>

          {/* CATEGORY BAR */}
          <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              الكل ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {cat.name_ar}
              </button>
            ))}
          </div>

          {/* PRODUCT GRID */}
          <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="h-32 bg-slate-800/60 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                <Tag className="w-12 h-12 text-slate-700 mb-2 stroke-1" />
                <p className="text-sm font-bold text-slate-300">لم يتم العثور على منتجات مطابقة</p>
                <p className="text-xs text-slate-500 mt-1">جرب البحث بكلمة أخرى أو مسح الباركود مباشرة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {filteredProducts.map((pv) => {
                  const stock = pv.branch_variant_stock?.[0]?.quantity ?? 0;
                  const isOut = stock <= 0;

                  return (
                    <button
                      key={pv.id}
                      onClick={() => handleAddVariantToCart(pv)}
                      disabled={isOut && !settings.allowNegativeStock}
                      className={`bg-slate-900 border text-right transition-all group flex flex-col justify-between h-36 p-3 rounded-2xl relative overflow-hidden shadow-md ${
                        isOut
                          ? 'opacity-60 border-slate-800/40 cursor-not-allowed'
                          : 'border-slate-800 hover:border-indigo-500/60 hover:bg-slate-800/90 hover:shadow-indigo-500/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] text-indigo-400 font-mono font-semibold">{pv.sku}</span>
                          {pv.colors?.hex_code ? (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                              style={{ backgroundColor: pv.colors.hex_code }}
                              title={pv.colors.name_ar}
                            />
                          ) : null}
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                          {pv.products?.name_ar}
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {pv.sizes?.code ? (
                              <>مقاس: <strong className="text-slate-200">{pv.sizes.code}</strong></>
                            ) : (
                              <span className="text-slate-400">منتج قياسي</span>
                            )}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            stock > 5 ? 'bg-slate-800 text-slate-300' : stock > 0 ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            مخزون: {stock}
                          </span>
                        </div>

                        <div className="flex flex-col mt-1">
                          <span className="text-sm font-black text-emerald-400 font-mono">
                            {Number(pv.selling_price).toFixed(2)}{' '}
                            <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                          </span>
                          {Number(pv.min_selling_price || pv.products?.min_selling_price || 0) > 0 && (
                            <span className="text-[10px] text-amber-400 font-medium">
                              أقل سعر: <strong className="font-mono">{Number(pv.min_selling_price || pv.products?.min_selling_price).toFixed(2)}</strong> ج.م
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LEFT PANE: CART & TOTALS */}
        <div className="w-full lg:w-96 bg-slate-900 flex flex-col border-r border-slate-800 shadow-2xl shrink-0">
          {/* CART HEADER */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">سلة الفاتورة الحالية</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="primary" size="sm">{cart.length} أصناف</Badge>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                  title="تفريغ السلة"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CUSTOMER SELECTOR BAR */}
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 truncate">
              <User className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold truncate">العميل: {selectedCustomer.name}</span>
            </div>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-[11px] text-indigo-400 hover:underline font-bold shrink-0"
            >
              تغيير
            </button>
          </div>

          {/* CART ITEMS LIST */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-12">
                <ShoppingCart className="w-12 h-12 text-slate-800 mb-2 stroke-1" />
                <p className="text-xs font-semibold text-slate-400">السلة فارغة حالياً</p>
                <p className="text-[11px] text-slate-600 mt-0.5">انقر على أي منتج أو امسح الباركود لإضافته</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isSelected = selectedCartIndex === idx;
                const lineTotal = item.unitPrice * item.quantity;

                return (
                  <div
                    key={item.variantId}
                    onClick={() => setSelectedCartIndex(idx)}
                    className={`border rounded-2xl p-2.5 transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-slate-950 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-100 truncate">{item.productNameAr}</h5>
                        {(item.sizeCode && !['N/A', 'Std', 'عام', 'غير محدد'].includes(item.sizeCode)) ||
                        (item.colorNameAr && !['عام', 'بدون', 'غير محدد'].includes(item.colorNameAr)) ? (
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            {item.sizeCode && !['N/A', 'Std', 'عام', 'غير محدد'].includes(item.sizeCode) && (
                              <span>المقاس: <strong className="text-slate-200">{item.sizeCode}</strong></span>
                            )}
                            {item.sizeCode && !['N/A', 'Std', 'عام', 'غير محدد'].includes(item.sizeCode) &&
                             item.colorNameAr && !['عام', 'بدون', 'غير محدد'].includes(item.colorNameAr) && (
                              <span>•</span>
                            )}
                            {item.colorNameAr && !['عام', 'بدون', 'غير محدد'].includes(item.colorNameAr) && (
                              <span>اللون: <strong className="text-slate-200">{item.colorNameAr}</strong></span>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Edit item modal trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setIsDiscountModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition-colors"
                        title="تعديل السعر والخصم"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove item button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.variantId);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.variantId, -1);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.variantId, 1);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Pricing */}
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {lineTotal.toFixed(2)} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
                        </span>
                        {item.discountAmount > 0 && (
                          <span className="text-[9px] text-amber-400 block font-medium">
                            (خصم: {item.discountAmount.toFixed(2)})
                          </span>
                        )}
                        {item.minSellingPrice && item.minSellingPrice > 0 ? (
                          <span className="text-[9px] text-amber-300/90 block font-mono">
                            أقل سعر: {item.minSellingPrice.toFixed(2)} ج.م
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* TOTALS & ACTION BUTTONS */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-3">
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between text-slate-400">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{subtotal.toFixed(2)} ج.م</span>
              </div>
              {totalItemDiscounts > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>إجمالي الخصم:</span>
                  <span className="font-mono">-{totalItemDiscounts.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>ضريبة القيمة المضافة ({settings.taxRate}%):</span>
                <span className="font-mono">{taxAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-1.5 border-t border-slate-800">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono text-emerald-400 text-lg">{totalAmount.toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={handleHoldSale}
                disabled={cart.length === 0}
                className="bg-amber-950/60 hover:bg-amber-900 border-amber-800/50 text-amber-300 font-bold gap-1 text-xs py-2.5"
              >
                <PauseCircle className="w-4 h-4" />
                <span>تعليق (F6)</span>
              </Button>

              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={cart.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 shadow-lg shadow-emerald-600/20"
              >
                <span>دفع (F8)</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM KEYBOARD SHORTCUTS BAR */}
      <KeyboardShortcutsBar
        onSearchFocus={() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }}
        onNewSale={clearCart}
        onHoldSale={handleHoldSale}
        onRetrieveSale={() => setIsHeldModalOpen(true)}
        onPayment={() => setIsPaymentModalOpen(true)}
        onClearSearch={() => setSearchQuery('')}
        onRemoveSelectedItem={() => {
          if (selectedCartIndex !== null && cart[selectedCartIndex]) {
            removeFromCart(cart[selectedCartIndex].variantId);
          }
        }}
        hasItems={cart.length > 0}
        heldCount={heldSales.length}
      />

      {/* PAYMENT MODAL */}
      <Dialog
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="إتمام عملية الدفع والإصدار"
        maxWidth="md"
      >
        <div className="space-y-4 font-sans" dir="rtl">
          {/* Seller Name Selection / Input (Defaulted & Editable) */}
          <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl space-y-1.5">
            <label className="block text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-400" />
              <span>اسم البائع / مسؤول الفاتورة * (مكتوب تلقائياً وتستطيع تعديله)</span>
            </label>
            <Input
              type="text"
              placeholder="أدخل اسم البائع..."
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              required
              className="bg-slate-950 border-indigo-500/50 text-white font-bold text-sm"
            />
          </div>

          {/* Invoice Discount Section */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>خصم الفاتورة الإجمالي:</span>
              </label>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setOrderDiscountType('flat')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    orderDiscountType === 'flat'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  مبلغ ثابت (ج.م)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDiscountType('percentage')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    orderDiscountType === 'percentage'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  نسبة مئوية (%)
                </button>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={0}
                step="0.5"
                placeholder="أدخل قيمة الخصم على الفاتورة..."
                value={orderDiscountValue || ''}
                onChange={(e) => setOrderDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                icon={orderDiscountType === 'percentage' ? <Percent className="w-4 h-4 text-slate-400" /> : <DollarSign className="w-4 h-4 text-slate-400" />}
                className="flex-1"
              />
              {orderDiscountAmount > 0 && (
                <span className="text-xs font-mono font-bold text-amber-400 shrink-0 bg-amber-950/60 px-3 py-2 rounded-xl border border-amber-800/40">
                  خصم: -{orderDiscountAmount.toFixed(2)} ج.م
                </span>
              )}
            </div>
          </div>

          {/* Financial Breakdown Summary */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>المجموع الفرعي (قبل الخصم):</span>
              <span className="font-mono">{subtotal.toFixed(2)} ج.م</span>
            </div>
            {totalItemDiscounts > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>خصومات الأصناف:</span>
                <span className="font-mono">-{totalItemDiscounts.toFixed(2)} ج.م</span>
              </div>
            )}
            {orderDiscountAmount > 0 && (
              <div className="flex justify-between text-amber-400 font-bold">
                <span>خصم الفاتورة الإجمالي:</span>
                <span className="font-mono">-{orderDiscountAmount.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>ضريبة القيمة المضافة ({settings.taxRate}%):</span>
              <span className="font-mono">+{taxAmount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-base font-black text-white pt-1.5 border-t border-slate-800">
              <span>الإجمالي النهائي الصافي للدفع:</span>
              <span className="font-mono text-emerald-400 text-xl">{totalAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">اختر طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 shadow-md shadow-emerald-600/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span>نقداً (Cash)</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-indigo-950/80 border-indigo-600 text-indigo-300 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>بطاقة (Card)</span>
              </button>
              <button
                onClick={() => setPaymentMethod('split')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'split'
                    ? 'bg-purple-950/80 border-purple-600 text-purple-300 shadow-md shadow-purple-600/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Tag className="w-5 h-5" />
                <span>دفع مجزأ</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <Input
                label="المبلغ المستلم من العميل (ج.م)"
                type="number"
                placeholder={totalAmount.toFixed(2)}
                value={paidCashAmount}
                onChange={(e) => setPaidCashAmount(e.target.value)}
                autoFocus
              />

              {/* Quick Cash Buttons */}
              <div className="flex gap-2">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPaidCashAmount(amt.toString())}
                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold font-mono text-slate-300 transition-colors"
                  >
                    {amt} ج.م
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-slate-300 flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span>المبلغ المتبقي (المتوجب إرجاعه للعميل):</span>
                <span className="font-mono text-amber-400 font-bold">{changeAmount.toFixed(2)} ج.م</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleFinalizeSale}
            isLoading={isProcessingSale}
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-base shadow-xl"
          >
            تأكيد الدفع وطباعة الفاتورة
          </Button>
        </div>
      </Dialog>

      {/* CUSTOMER SELECTOR MODAL */}
      <Dialog
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="اختيار العميل"
        maxWidth="md"
      >
        <div className="space-y-3 font-sans" dir="rtl">
          <Input
            placeholder="ابحث باسم العميل أو رقم الهاتف..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => {
                setSelectedCustomer({ id: '', name: 'عميل نقدي عام', phone: null });
                setIsCustomerModalOpen(false);
              }}
              className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 flex justify-between items-center text-xs transition-colors"
            >
              <span className="font-bold text-slate-200">عميل نقدي عام (افتراضي)</span>
              <Badge variant="secondary" size="sm">عام</Badge>
            </button>

            {customers
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  c.phone?.includes(customerSearch)
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setIsCustomerModalOpen(false);
                  }}
                  className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 flex justify-between items-center text-xs transition-colors"
                >
                  <div>
                    <span className="font-bold text-slate-100 block">{c.name}</span>
                    <span className="text-[10px] text-slate-400">{c.phone || 'بدون رقم'}</span>
                  </div>
                  {c.loyaltyPoints && c.loyaltyPoints > 0 ? (
                    <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded-md">
                      {c.loyaltyPoints} نقطة
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        </div>
      </Dialog>

      {/* CAMERA SCANNER MODAL */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleScanBarcode}
      />

      {/* HELD SALES MODAL */}
      <HeldSalesModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        heldSales={heldSales}
        onRetrieveSale={handleRetrieveSale}
        onDeleteHeldSale={handleDeleteHeldSale}
        onClearAll={() => saveHeldSalesToStorage([])}
      />

      {/* ITEM DISCOUNT / PRICE EDIT MODAL */}
      <ItemDiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        item={editingItem}
        onSaveItem={(updated) => {
          setCart((prev) =>
            prev.map((i) => (i.variantId === updated.variantId ? updated : i))
          );
        }}
      />

      {/* RECEIPT PRINT MODAL */}
      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={completedSale}
      />

      {/* OPEN NEW SHIFT MODAL IN POS */}
      <Dialog
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        title="فتح وردية كاشير جديدة"
        maxWidth="sm"
      >
        <form onSubmit={handleOpenShiftInPOS} className="space-y-4 font-sans" dir="rtl">
          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>تنبيه فتح الوردية اليومية</span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              يجب إدخال رصيد الافتتاح (العهدة النقدية بالخزنة) لفتح الوردية وحساب المبيعات والفروقات بانتظام.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">المبلغ الابتدائي / عهدة الافتتاح (ج.م) *</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">أدخل قيمة الفكة أو المبلغ النقدي في الخزنة عند بداية الوردية</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsOpenShiftModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={isOpeningShift} variant="primary" className="bg-emerald-600 hover:bg-emerald-500 font-bold">
              تأكيد فتح الوردية
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
