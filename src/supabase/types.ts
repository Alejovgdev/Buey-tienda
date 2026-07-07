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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          allergens_notes_snapshot: string | null
          allergens_snapshot: string[] | null
          id: string
          item_type: string
          line_total: number
          order_id: string
          product_name_snapshot: string
          product_variant_id: string | null
          promotion_id: string | null
          quantity: number
          unit_price_snapshot: number
          variant_name_snapshot: string
        }
        Insert: {
          allergens_notes_snapshot?: string | null
          allergens_snapshot?: string[] | null
          id?: string
          item_type?: string
          line_total: number
          order_id: string
          product_name_snapshot: string
          product_variant_id?: string | null
          promotion_id?: string | null
          quantity: number
          unit_price_snapshot: number
          variant_name_snapshot: string
        }
        Update: {
          allergens_notes_snapshot?: string | null
          allergens_snapshot?: string[] | null
          id?: string
          item_type?: string
          line_total?: number
          order_id?: string
          product_name_snapshot?: string
          product_variant_id?: string | null
          promotion_id?: string | null
          quantity?: number
          unit_price_snapshot?: number
          variant_name_snapshot?: string
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
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          notes: string | null
          order_id: string
          previous_status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          order_id: string
          previous_status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_email: string
          customer_last_name: string
          customer_name: string
          customer_phone: string
          id: string
          order_number: string
          paid_at: string | null
          redsys_ds_order: string | null
          shipping_city: string
          shipping_cost: number
          shipping_country: string
          shipping_notes: string | null
          shipping_postal_code: string
          shipping_province: string
          shipping_street: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_email: string
          customer_last_name: string
          customer_name: string
          customer_phone: string
          id?: string
          order_number: string
          paid_at?: string | null
          redsys_ds_order?: string | null
          shipping_city: string
          shipping_cost?: number
          shipping_country?: string
          shipping_notes?: string | null
          shipping_postal_code: string
          shipping_province: string
          shipping_street: string
          status: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_email?: string
          customer_last_name?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          redsys_ds_order?: string | null
          shipping_city?: string
          shipping_cost?: number
          shipping_country?: string
          shipping_notes?: string | null
          shipping_postal_code?: string
          shipping_province?: string
          shipping_street?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          paid_at: string | null
          redsys_authorization: string | null
          redsys_ds_order: string
          redsys_ds_response: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          paid_at?: string | null
          redsys_authorization?: string | null
          redsys_ds_order: string
          redsys_ds_response?: string | null
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          redsys_authorization?: string | null
          redsys_ds_order?: string
          redsys_ds_response?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          id: string
          is_main: boolean
          product_id: string
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          id?: string
          is_main?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          alt_text?: string | null
          id?: string
          is_main?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_labels: {
        Row: {
          allergens: string[] | null
          allergens_notes: string | null
          cooking_method: string | null
          created_at: string
          elaboration_date: string | null
          expiry_date: string | null
          id: string
          ingredients: string | null
          lote: string
          order_item_id: string | null
          prep_instructions: string | null
          product_id: string
          product_name: string
          storage_conditions: string | null
          weight_grams: number | null
        }
        Insert: {
          allergens?: string[] | null
          allergens_notes?: string | null
          cooking_method?: string | null
          created_at?: string
          elaboration_date?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          lote?: string
          order_item_id?: string | null
          prep_instructions?: string | null
          product_id: string
          product_name?: string
          storage_conditions?: string | null
          weight_grams?: number | null
        }
        Update: {
          allergens?: string[] | null
          allergens_notes?: string | null
          cooking_method?: string | null
          created_at?: string
          elaboration_date?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          lote?: string
          order_item_id?: string | null
          prep_instructions?: string | null
          product_id?: string
          product_name?: string
          storage_conditions?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_labels_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          is_active: boolean
          name: string
          price: number
          product_id: string
          sort_order: number
          stock: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          price: number
          product_id: string
          sort_order?: number
          stock?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_id?: string
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[] | null
          allergens_notes: string | null
          category_id: string
          cooking_method: string | null
          created_at: string
          description: string | null
          id: string
          ingredients: string | null
          is_active: boolean
          name: string
          prep_instructions: string | null
          slug: string
          sort_order: number
          storage_conditions: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          allergens_notes?: string | null
          category_id: string
          cooking_method?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredients?: string | null
          is_active?: boolean
          name: string
          prep_instructions?: string | null
          slug: string
          sort_order?: number
          storage_conditions?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          allergens_notes?: string | null
          category_id?: string
          cooking_method?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredients?: string | null
          is_active?: boolean
          name?: string
          prep_instructions?: string | null
          slug?: string
          sort_order?: number
          storage_conditions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          current_redemptions: number
          ends_at: string | null
          gift_variant_id: string
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_subtotal: number | null
          name: string
          starts_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_redemptions?: number
          ends_at?: string | null
          gift_variant_id: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal?: number | null
          name: string
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_redemptions?: number
          ends_at?: string | null
          gift_variant_id?: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal?: number | null
          name?: string
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_gift_variant_id_fkey"
            columns: ["gift_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          accepting_orders: boolean
          checkout_disabled_message: string | null
          id: string
          notice_message: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          checkout_disabled_message?: string | null
          id?: string
          notice_message?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          checkout_disabled_message?: string | null
          id?: string
          notice_message?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock_and_confirm_order: {
        Args: {
          p_line_items: Json
          p_order_id: string
          p_promotion_id?: string
        }
        Returns: Json
      }
      generate_order_number: { Args: never; Returns: string }
      generate_redsys_ds_order: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
