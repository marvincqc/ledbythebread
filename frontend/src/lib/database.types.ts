// Auto-generated type stubs for Supabase tables.
// For full generation run: supabase gen types typescript --project-id <id>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string | null;
          phone: string | null;
          address: string | null;
        };
        Insert: {
          id: string;
          role?: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
        };
        Update: {
          id?: string;
          role?: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
        };
      };
      categories: {
        Row: { id: string; name: string; sort_order: number };
        Insert: { id?: string; name: string; sort_order?: number };
        Update: { id?: string; name?: string; sort_order?: number };
      };
      skus: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          price: number;
          category_id: string | null;
          is_bundle: boolean;
          bundle_components: Json | null;
          is_active: boolean;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          price: number;
          category_id?: string | null;
          is_bundle?: boolean;
          bundle_components?: Json | null;
          is_active?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          category_id?: string | null;
          is_bundle?: boolean;
          bundle_components?: Json | null;
          is_active?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      delivery_slots: {
        Row: {
          id: string;
          delivery_date: string;
          slot_type: string;
          max_orders: number;
          current_orders: number;
          is_open: boolean;
          cut_off_override: string | null;
        };
        Insert: {
          id?: string;
          delivery_date: string;
          slot_type: string;
          max_orders?: number;
          current_orders?: number;
          is_open?: boolean;
          cut_off_override?: string | null;
        };
        Update: {
          id?: string;
          delivery_date?: string;
          slot_type?: string;
          max_orders?: number;
          current_orders?: number;
          is_open?: boolean;
          cut_off_override?: string | null;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string | null;
          guest_info: Json | null;
          delivery_address: string;
          lat: number | null;
          lng: number | null;
          delivery_date: string;
          slot_type: string;
          subtotal: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          guest_info?: Json | null;
          delivery_address: string;
          lat?: number | null;
          lng?: number | null;
          delivery_date: string;
          slot_type: string;
          subtotal: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          guest_info?: Json | null;
          delivery_address?: string;
          lat?: number | null;
          lng?: number | null;
          delivery_date?: string;
          slot_type?: string;
          subtotal?: number;
          status?: string;
          created_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          sku_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          sku_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          sku_id?: string;
          quantity?: number;
          unit_price?: number;
        };
      };
      admin_settings: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: { key?: string; value?: string };
      };
      slot_overrides: {
        Row: {
          id: string;
          delivery_date: string;
          slot_type: string;
          override_type: string;
          custom_data: Json | null;
        };
        Insert: {
          id?: string;
          delivery_date: string;
          slot_type: string;
          override_type: string;
          custom_data?: Json | null;
        };
        Update: {
          id?: string;
          delivery_date?: string;
          slot_type?: string;
          override_type?: string;
          custom_data?: Json | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_slot_cutoff: {
        Args: {
          p_delivery_date: string;
          p_slot_type: string;
          p_cut_off_override?: string | null;
        };
        Returns: string;
      };
      increment_slot_orders: {
        Args: { p_delivery_date: string; p_slot_type: string };
        Returns: void;
      };
      decrement_slot_orders: {
        Args: { p_delivery_date: string; p_slot_type: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}
