export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          code: string
          address: string | null
          phone: string | null
          tax_number: string | null
          receipt_header: string | null
          receipt_footer: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      roles: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          code: string
          description: string | null
          is_system: boolean
          created_at: string
        }
      }
      permissions: {
        Row: {
          id: string
          code: string
          category: string
          description_ar: string
          description_en: string
          created_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          branch_id: string | null
          role_id: string | null
          full_name: string
          phone: string | null
          pin_code_hash: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      categories: {
        Row: {
          id: string
          parent_id: string | null
          name_ar: string
          name_en: string
          code: string
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      brands: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          logo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      sizes: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          code: string
          sort_order: number
          created_at: string
        }
      }
      colors: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          hex_code: string
          code: string
          created_at: string
        }
      }
      products: {
        Row: {
          id: string
          category_id: string | null
          brand_id: string | null
          name_ar: string
          name_en: string
          description: string | null
          product_code: string | null
          barcode: string | null
          image_url: string | null
          base_price: number
          cost_price: number
          min_selling_price: number | null
          tax_rate: number
          min_stock_alert: number
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          size_id: string
          color_id: string
          sku: string
          barcode: string
          qr_code: string | null
          cost_price: number
          selling_price: number
          discount_price: number | null
          min_selling_price: number | null
          image_url: string | null
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
      }
      branch_variant_stock: {
        Row: {
          id: string
          branch_id: string
          variant_id: string
          quantity: number
          bin_location: string | null
          updated_at: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          branch_id: string
          variant_id: string
          movement_type: 'purchase' | 'sale' | 'return' | 'exchange_in' | 'exchange_out' | 'adjustment' | 'damaged' | 'lost' | 'transfer' | 'opening_stock'
          quantity_delta: number
          quantity_before: number
          quantity_after: number
          reference_type: string | null
          reference_id: string | null
          cost_price: number
          selling_price: number
          performed_by: string | null
          notes: string | null
          created_at: string
        }
      }
      sales: {
        Row: {
          id: string
          invoice_number: string
          branch_id: string
          cashier_shift_id: string
          customer_id: string | null
          subtotal: number
          discount_amount: number
          coupon_id: string | null
          tax_rate: number
          tax_amount: number
          total_amount: number
          paid_amount: number
          change_amount: number
          payment_status: 'paid' | 'partially_paid' | 'refunded' | 'pending'
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          variant_id: string
          quantity: number
          returned_quantity: number
          unit_price: number
          cost_price: number
          discount_amount: number
          tax_amount: number
          total_price: number
        }
      }
      payments: {
        Row: {
          id: string
          sale_id: string
          cashier_shift_id: string | null
          payment_method: 'cash' | 'card' | 'wallet' | 'bank_transfer' | 'store_credit' | 'loyalty_points' | 'other'
          amount: number
          reference_number: string | null
          created_at: string
        }
      }
      cashier_shifts: {
        Row: {
          id: string
          cash_register_id: string
          branch_id: string
          cashier_id: string
          status: 'open' | 'closed'
          opened_at: string
          closed_at: string | null
          opening_balance: number
          closing_balance_counted: number | null
          total_sales_cash: number
          total_sales_card: number
          total_returns_cash: number
          total_expenses: number
          total_cash_in: number
          total_cash_out: number
          expected_closing_balance: number | null
          variance: number | null
          notes: string | null
        }
      }
    }
  }
}
