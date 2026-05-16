export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      delivery_slot_zones: {
        Row: {
          slot_id: string
          zone_id: string
        }
        Insert: {
          slot_id: string
          zone_id: string
        }
        Update: {
          slot_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_slot_zones_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_slot_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          current_orders: number
          cut_off_override: string | null
          delivery_date: string
          id: string
          is_open: boolean
          max_orders: number
          slot_type: string
        }
        Insert: {
          current_orders?: number
          cut_off_override?: string | null
          delivery_date: string
          id?: string
          is_open?: boolean
          max_orders?: number
          slot_type: string
        }
        Update: {
          current_orders?: number
          cut_off_override?: string | null
          delivery_date?: string
          id?: string
          is_open?: boolean
          max_orders?: number
          slot_type?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string | null
          id: string
          name: string
          radius_km: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string | null
          id?: string
          name: string
          radius_km?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          id?: string
          name?: string
          radius_km?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          quantity: number
          sku_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          quantity: number
          sku_id: string
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          quantity?: number
          sku_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          read_at: string | null
          sender: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          read_at?: string | null
          sender: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          read_at?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_address: string | null
          delivery_date: string
          guest_info: Json | null
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
          slot_type: string
          status: string
          subtotal: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_date: string
          guest_info?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          slot_type: string
          status?: string
          subtotal: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_date?: string
          guest_info?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          slot_type?: string
          status?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          address?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
        }
        Update: {
          address?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          bundle_components: Json | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_bundle: boolean
          is_promo: boolean
          metadata: Json | null
          min_qty: number
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          bundle_components?: Json | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_bundle?: boolean
          is_promo?: boolean
          metadata?: Json | null
          min_qty?: number
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          bundle_components?: Json | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_bundle?: boolean
          is_promo?: boolean
          metadata?: Json | null
          min_qty?: number
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "skus_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_overrides: {
        Row: {
          custom_data: Json | null
          delivery_date: string
          id: string
          override_type: string
          slot_type: string
        }
        Insert: {
          custom_data?: Json | null
          delivery_date: string
          id?: string
          override_type: string
          slot_type: string
        }
        Update: {
          custom_data?: Json | null
          delivery_date?: string
          id?: string
          override_type?: string
          slot_type?: string
        }
        Relationships: []
      }
      slot_waitlist: {
        Row: {
          created_at: string | null
          delivery_date: string
          email: string
          id: string
          name: string
          phone: string
          slot_type: string
        }
        Insert: {
          created_at?: string | null
          delivery_date: string
          email: string
          id?: string
          name: string
          phone: string
          slot_type: string
        }
        Update: {
          created_at?: string | null
          delivery_date?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          slot_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_slot_orders: {
        Args: { p_delivery_date: string; p_slot_type: string }
        Returns: undefined
      }
      get_slot_cutoff: {
        Args: {
          p_cut_off_override?: string
          p_delivery_date: string
          p_slot_type: string
        }
        Returns: string
      }
      increment_slot_orders: {
        Args: { p_delivery_date: string; p_slot_type: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
