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
      invoice_counters: {
        Row: {
          last_number: number
          series: string
          year: number
        }
        Insert: {
          last_number: number
          series: string
          year: number
        }
        Update: {
          last_number?: number
          series?: string
          year?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          correction_reason: string | null
          currency: string
          customer_address: string | null
          customer_name: string | null
          customer_tax_id: string | null
          id: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          issued_at: string
          issuer_address: string
          issuer_country: string
          issuer_legal_name: string
          issuer_tax_id: string
          lines: Json
          number: number
          operation_date: string
          order_id: string
          rectifies_invoice_id: string | null
          replaces_invoice_id: string | null
          series: string
          tax_base_total: number
          total: number
          vat_breakdown: Json
          vat_total: number
          year: number
        }
        Insert: {
          correction_reason?: string | null
          currency?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_tax_id?: string | null
          id?: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          issued_at?: string
          issuer_address: string
          issuer_country: string
          issuer_legal_name: string
          issuer_tax_id: string
          lines: Json
          number: number
          operation_date: string
          order_id: string
          rectifies_invoice_id?: string | null
          replaces_invoice_id?: string | null
          series: string
          tax_base_total: number
          total: number
          vat_breakdown: Json
          vat_total: number
          year: number
        }
        Update: {
          correction_reason?: string | null
          currency?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_tax_id?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          issue_date?: string
          issued_at?: string
          issuer_address?: string
          issuer_country?: string
          issuer_legal_name?: string
          issuer_tax_id?: string
          lines?: Json
          number?: number
          operation_date?: string
          order_id?: string
          rectifies_invoice_id?: string | null
          replaces_invoice_id?: string | null
          series?: string
          tax_base_total?: number
          total?: number
          vat_breakdown?: Json
          vat_total?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      label_print_events: {
        Row: {
          id: string
          is_reprint: boolean
          label_snapshot: Json
          printed_at: string
          printed_by: string
          product_label_id: string
          reprint_reason: string | null
          session_id: string
        }
        Insert: {
          id?: string
          is_reprint?: boolean
          label_snapshot: Json
          printed_at?: string
          printed_by: string
          product_label_id: string
          reprint_reason?: string | null
          session_id: string
        }
        Update: {
          id?: string
          is_reprint?: boolean
          label_snapshot?: Json
          printed_at?: string
          printed_by?: string
          product_label_id?: string
          reprint_reason?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_print_events_product_label_id_fkey"
            columns: ["product_label_id"]
            isOneToOne: false
            referencedRelation: "product_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_profiles: {
        Row: {
          blocking_fields: string[]
          created_at: string
          date_type: string
          default_storage_text: string | null
          field_order: string[]
          fixed_texts: Json | null
          id: string
          is_active: boolean
          key: string
          name: string
          preparation_fields: string[]
          required_fields: string[]
          requires_beef_traceability: boolean
          requires_health_mark: boolean
          requires_lot: boolean
          requires_weight: boolean
          suggested_shelf_life_days: number | null
          updated_at: string
          visible_fields: string[]
        }
        Insert: {
          blocking_fields?: string[]
          created_at?: string
          date_type?: string
          default_storage_text?: string | null
          field_order?: string[]
          fixed_texts?: Json | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          preparation_fields?: string[]
          required_fields?: string[]
          requires_beef_traceability?: boolean
          requires_health_mark?: boolean
          requires_lot?: boolean
          requires_weight?: boolean
          suggested_shelf_life_days?: number | null
          updated_at?: string
          visible_fields?: string[]
        }
        Update: {
          blocking_fields?: string[]
          created_at?: string
          date_type?: string
          default_storage_text?: string | null
          field_order?: string[]
          fixed_texts?: Json | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          preparation_fields?: string[]
          required_fields?: string[]
          requires_beef_traceability?: boolean
          requires_health_mark?: boolean
          requires_lot?: boolean
          requires_weight?: boolean
          suggested_shelf_life_days?: number | null
          updated_at?: string
          visible_fields?: string[]
        }
        Relationships: []
      }
      order_box_labels: {
        Row: {
          order_id: string
          draft_id: string
          snapshot: Json
          confirmed_session_id: string
          confirmed_at: string
        }
        Insert: {
          order_id: string
          draft_id: string
          snapshot: Json
          confirmed_session_id: string
          confirmed_at?: string
        }
        Update: { [key: string]: never }
        Relationships: [
          {
            foreignKeyName: "order_box_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          vat_rate: number | null
          tax_base: number | null
          vat_amount: number | null
          allergens_notes_snapshot: string | null
          allergens_snapshot: string[] | null
          cooking_method_snapshot: string | null
          country_of_origin_snapshot: string | null
          id: string
          ingredients_snapshot: string | null
          item_type: string
          label_display_name_snapshot: string | null
          label_profile_id_snapshot: string | null
          label_profile_snapshot: Json | null
          line_total: number
          order_id: string
          prep_instructions_snapshot: string | null
          product_name_snapshot: string
          product_variant_id: string | null
          promotion_id: string | null
          quantity: number
          storage_conditions_snapshot: string | null
          suggested_package_count_snapshot: number | null
          unit_price_snapshot: number
          usual_units_per_package_snapshot: number | null
          variant_name_snapshot: string
        }
        Insert: {
          vat_rate?: number | null
          tax_base?: number | null
          vat_amount?: number | null
          allergens_notes_snapshot?: string | null
          allergens_snapshot?: string[] | null
          cooking_method_snapshot?: string | null
          country_of_origin_snapshot?: string | null
          id?: string
          ingredients_snapshot?: string | null
          item_type?: string
          label_display_name_snapshot?: string | null
          label_profile_id_snapshot?: string | null
          label_profile_snapshot?: Json | null
          line_total: number
          order_id: string
          prep_instructions_snapshot?: string | null
          product_name_snapshot: string
          product_variant_id?: string | null
          promotion_id?: string | null
          quantity: number
          storage_conditions_snapshot?: string | null
          suggested_package_count_snapshot?: number | null
          unit_price_snapshot: number
          usual_units_per_package_snapshot?: number | null
          variant_name_snapshot: string
        }
        Update: {
          vat_rate?: number | null
          tax_base?: number | null
          vat_amount?: number | null
          allergens_notes_snapshot?: string | null
          allergens_snapshot?: string[] | null
          cooking_method_snapshot?: string | null
          country_of_origin_snapshot?: string | null
          id?: string
          ingredients_snapshot?: string | null
          item_type?: string
          label_display_name_snapshot?: string | null
          label_profile_id_snapshot?: string | null
          label_profile_snapshot?: Json | null
          line_total?: number
          order_id?: string
          prep_instructions_snapshot?: string | null
          product_name_snapshot?: string
          product_variant_id?: string | null
          promotion_id?: string | null
          quantity?: number
          storage_conditions_snapshot?: string | null
          suggested_package_count_snapshot?: number | null
          unit_price_snapshot?: number
          usual_units_per_package_snapshot?: number | null
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
          {
            foreignKeyName: "order_items_label_profile_id_snapshot_fkey"
            columns: ["label_profile_id_snapshot"]
            isOneToOne: false
            referencedRelation: "label_profiles"
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
          shipping_vat_rate: number | null
          shipping_tax_base: number | null
          shipping_vat_amount: number | null
          tax_base_total: number | null
          vat_total: number | null
          admin_notes: string | null
          created_at: string
          customer_email: string
          customer_last_name: string
          customer_name: string
          customer_phone: string
          id: string
          labeled_at: string | null
          labeled_by: string | null
          marketing_consent: boolean | null
          marketing_consent_at: string | null
          marketing_consent_version: string | null
          order_number: string
          paid_at: string | null
          payment_reminder_sent_at: string | null
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
          terms_accepted_at: string | null
          terms_version: string | null
          total: number
          updated_at: string
        }
        Insert: {
          shipping_vat_rate?: number | null
          shipping_tax_base?: number | null
          shipping_vat_amount?: number | null
          tax_base_total?: number | null
          vat_total?: number | null
          admin_notes?: string | null
          created_at?: string
          customer_email: string
          customer_last_name: string
          customer_name: string
          customer_phone: string
          id?: string
          labeled_at?: string | null
          labeled_by?: string | null
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          marketing_consent_version?: string | null
          order_number: string
          paid_at?: string | null
          payment_reminder_sent_at?: string | null
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
          terms_accepted_at?: string | null
          terms_version?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          shipping_vat_rate?: number | null
          shipping_tax_base?: number | null
          shipping_vat_amount?: number | null
          tax_base_total?: number | null
          vat_total?: number | null
          admin_notes?: string | null
          created_at?: string
          customer_email?: string
          customer_last_name?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          labeled_at?: string | null
          labeled_by?: string | null
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          marketing_consent_version?: string | null
          order_number?: string
          paid_at?: string | null
          payment_reminder_sent_at?: string | null
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
          terms_accepted_at?: string | null
          terms_version?: string | null
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
          beef_traceability_info: string | null
          best_before_date: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          cooking_method: string | null
          country_of_origin: string | null
          created_at: string
          created_by: string | null
          elaboration_date: string | null
          expiry_date: string | null
          id: string
          ingredients: string | null
          label_profile_id: string | null
          lote: string
          order_item_id: string | null
          package_count_for_line: number
          package_sequence: number
          packaging_date: string | null
          prep_instructions: string | null
          product_id: string
          product_name: string
          status: string
          storage_conditions: string | null
          units_in_package: number
          updated_at: string
          updated_by: string | null
          variant_name: string | null
          weight_grams: number | null
        }
        Insert: {
          allergens?: string[] | null
          allergens_notes?: string | null
          beef_traceability_info?: string | null
          best_before_date?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          cooking_method?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          elaboration_date?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          label_profile_id?: string | null
          lote?: string
          order_item_id?: string | null
          package_count_for_line?: number
          package_sequence?: number
          packaging_date?: string | null
          prep_instructions?: string | null
          product_id: string
          product_name?: string
          status?: string
          storage_conditions?: string | null
          units_in_package?: number
          updated_at?: string
          updated_by?: string | null
          variant_name?: string | null
          weight_grams?: number | null
        }
        Update: {
          allergens?: string[] | null
          allergens_notes?: string | null
          beef_traceability_info?: string | null
          best_before_date?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          cooking_method?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          elaboration_date?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          label_profile_id?: string | null
          lote?: string
          order_item_id?: string | null
          package_count_for_line?: number
          package_sequence?: number
          packaging_date?: string | null
          prep_instructions?: string | null
          product_id?: string
          product_name?: string
          status?: string
          storage_conditions?: string | null
          units_in_package?: number
          updated_at?: string
          updated_by?: string | null
          variant_name?: string | null
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
          {
            foreignKeyName: "product_labels_label_profile_id_fkey"
            columns: ["label_profile_id"]
            isOneToOne: false
            referencedRelation: "label_profiles"
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
          vat_rate: number
          allergens: string[] | null
          allergens_notes: string | null
          category_id: string
          cooking_method: string | null
          country_of_origin: string | null
          created_at: string
          description: string | null
          id: string
          ingredients: string | null
          is_active: boolean
          label_display_name: string | null
          label_profile_id: string | null
          name: string
          prep_instructions: string | null
          slug: string
          sort_order: number
          storage_conditions: string | null
          suggested_package_count: number
          updated_at: string
          usual_units_per_package: number
        }
        Insert: {
          vat_rate?: number
          allergens?: string[] | null
          allergens_notes?: string | null
          category_id: string
          cooking_method?: string | null
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredients?: string | null
          is_active?: boolean
          label_display_name?: string | null
          label_profile_id?: string | null
          name: string
          prep_instructions?: string | null
          slug: string
          sort_order?: number
          storage_conditions?: string | null
          suggested_package_count?: number
          updated_at?: string
          usual_units_per_package?: number
        }
        Update: {
          vat_rate?: number
          allergens?: string[] | null
          allergens_notes?: string | null
          category_id?: string
          cooking_method?: string | null
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredients?: string | null
          is_active?: boolean
          label_display_name?: string | null
          label_profile_id?: string | null
          name?: string
          prep_instructions?: string | null
          slug?: string
          sort_order?: number
          storage_conditions?: string | null
          suggested_package_count?: number
          updated_at?: string
          usual_units_per_package?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_label_profile_id_fkey"
            columns: ["label_profile_id"]
            isOneToOne: false
            referencedRelation: "label_profiles"
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
          shipping_vat_rate: number
          accepting_orders: boolean
          checkout_disabled_message: string | null
          id: string
          notice_message: string | null
          operator_address: string | null
          operator_country: string
          operator_health_registry_code: string | null
          operator_identification_mark: string | null
          operator_legal_name: string | null
          operator_tax_id: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          shipping_vat_rate?: number
          accepting_orders?: boolean
          checkout_disabled_message?: string | null
          id?: string
          notice_message?: string | null
          operator_address?: string | null
          operator_country?: string
          operator_health_registry_code?: string | null
          operator_identification_mark?: string | null
          operator_legal_name?: string | null
          operator_tax_id?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          shipping_vat_rate?: number
          accepting_orders?: boolean
          checkout_disabled_message?: string | null
          id?: string
          notice_message?: string | null
          operator_address?: string | null
          operator_country?: string
          operator_health_registry_code?: string | null
          operator_identification_mark?: string | null
          operator_legal_name?: string | null
          operator_tax_id?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoices_with_status: {
        Row: {
          correction_reason: string | null
          currency: string | null
          customer_address: string | null
          customer_name: string | null
          customer_tax_id: string | null
          id: string | null
          invoice_number: string | null
          invoice_type: string | null
          issue_date: string | null
          issued_at: string | null
          issuer_address: string | null
          issuer_country: string | null
          issuer_legal_name: string | null
          issuer_tax_id: string | null
          lines: Json | null
          number: number | null
          operation_date: string | null
          order_id: string | null
          rectifies_invoice_id: string | null
          replaces_invoice_id: string | null
          series: string | null
          status: string | null
          tax_base_total: number | null
          total: number | null
          vat_breakdown: Json | null
          vat_total: number | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrement_stock_and_confirm_order: {
        Args: {
          p_amount: number
          p_redsys_ds_order: string
          p_redsys_ds_response: string
          p_redsys_authorization: string | null
          p_line_items: Json
          p_order_id: string
          p_promotion_id?: string
        }
        Returns: Json
      }
      generate_order_number: { Args: never; Returns: string }
      generate_redsys_ds_order: { Args: never; Returns: string }
      issue_simplified_invoice: { Args: { p_order_id: string }; Returns: Json }
      madrid_date: { Args: { p_ts: string }; Returns: string }
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
