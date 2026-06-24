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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_section_access: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          label: string
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          label: string
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          label?: string
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          category: string
          created_at: string
          generated_at: string
          id: string
          message: string
          organization_id: string
          payload: Json
          product_id: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          generated_at?: string
          id?: string
          message: string
          organization_id: string
          payload?: Json
          product_id?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          generated_at?: string
          id?: string
          message?: string
          organization_id?: string
          payload?: Json
          product_id?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          organization_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          organization_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          organization_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      appointments: {
        Row: {
          channel: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          ends_at: string
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          price: number | null
          resource_id: string | null
          service_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          ends_at: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          price?: number | null
          resource_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          ends_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          price?: number | null
          resource_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "service_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_break_glass_requests: {
        Row: {
          approver1_at: string | null
          approver1_email: string | null
          approver2_at: string | null
          approver2_email: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          requester_email: string
          token_hash: string
        }
        Insert: {
          approver1_at?: string | null
          approver1_email?: string | null
          approver2_at?: string | null
          approver2_email?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          requester_email: string
          token_hash: string
        }
        Update: {
          approver1_at?: string | null
          approver1_email?: string | null
          approver2_at?: string | null
          approver2_email?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          requester_email?: string
          token_hash?: string
        }
        Relationships: []
      }
      auth_factors: {
        Row: {
          created_at: string
          factor_type: string
          id: string
          last_used_at: string | null
          metadata: Json
          secret_encrypted: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          factor_type: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          secret_encrypted?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          factor_type?: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          secret_encrypted?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      auth_login_events: {
        Row: {
          created_at: string
          details: Json
          email: string | null
          id: string
          ip: unknown
          method: string
          risk_score: number
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          ip?: unknown
          method: string
          risk_score?: number
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          ip?: unknown
          method?: string
          risk_score?: number
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_settings: {
        Row: {
          break_glass_approvers: Json
          break_glass_method: string
          enforce_2fa_grace_days: number
          id: boolean
          idle_timeout_minutes: Json
          methods_enabled: Json
          rate_limit_per_15min: number
          reauth_window_minutes: number
          require_2fa_roles: Json
          superadmin_ip_allowlist: Json
          superadmin_requires_passkey: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          break_glass_approvers?: Json
          break_glass_method?: string
          enforce_2fa_grace_days?: number
          id?: boolean
          idle_timeout_minutes?: Json
          methods_enabled?: Json
          rate_limit_per_15min?: number
          reauth_window_minutes?: number
          require_2fa_roles?: Json
          superadmin_ip_allowlist?: Json
          superadmin_requires_passkey?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          break_glass_approvers?: Json
          break_glass_method?: string
          enforce_2fa_grace_days?: number
          id?: boolean
          idle_timeout_minutes?: Json
          methods_enabled?: Json
          rate_limit_per_15min?: number
          reauth_window_minutes?: number
          require_2fa_roles?: Json
          superadmin_ip_allowlist?: Json
          superadmin_requires_passkey?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      auth_superadmin_allowlist: {
        Row: {
          created_at: string
          email: string
          enforced_ip_cidr: string | null
          id: string
          requires_passkey: boolean
        }
        Insert: {
          created_at?: string
          email: string
          enforced_ip_cidr?: string | null
          id?: string
          requires_passkey?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          enforced_ip_cidr?: string | null
          id?: string
          requires_passkey?: boolean
        }
        Relationships: []
      }
      auth_webauthn_credentials: {
        Row: {
          aaguid: string | null
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: Json
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: Json
          user_id: string
        }
        Update: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: Json
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          organization_id: string
          sort_order: number | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          organization_id: string
          sort_order?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          organization_id?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "banners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          organization_id: string
          slug: string | null
          sort_order: number | null
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          organization_id: string
          slug?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          organization_id?: string
          slug?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      broadcast_logs: {
        Row: {
          created_at: string
          errors: Json | null
          failed: number
          id: string
          message: string
          organization_id: string | null
          scheduled_at: string | null
          segment: string
          sent: number
          sent_at: string | null
          sent_by: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          failed?: number
          id?: string
          message: string
          organization_id?: string | null
          scheduled_at?: string | null
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          errors?: Json | null
          failed?: number
          id?: string
          message?: string
          organization_id?: string | null
          scheduled_at?: string | null
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      cash_denominations: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          kind: string
          sort_order: number
          value: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind?: string
          sort_order?: number
          value: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind?: string
          sort_order?: number
          value?: number
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string
          concept: string
          created_at: string
          created_by: string
          id: string
          movement_type: string
          organization_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          cash_session_id: string
          concept: string
          created_at?: string
          created_by: string
          id?: string
          movement_type: string
          organization_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string
          concept?: string
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: string
          organization_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          organization_id: string
          printer_config: Json
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          organization_id: string
          printer_config?: Json
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          printer_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session_counts: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          denomination_id: string
          id: string
          kind: string
          organization_id: string | null
          quantity: number
          session_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          denomination_id: string
          id?: string
          kind?: string
          organization_id?: string | null
          quantity?: number
          session_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          denomination_id?: string
          id?: string
          kind?: string
          organization_id?: string | null
          quantity?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_counts_denomination_id_fkey"
            columns: ["denomination_id"]
            isOneToOne: false
            referencedRelation: "cash_denominations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          balances: Json
          cash_register_id: string
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number
          id: string
          location_id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          organization_id: string
          status: string
          ticket_count: number
          total_card: number
          total_cash: number
          total_other: number
          total_sales: number
          total_transfer: number
          updated_at: string
        }
        Insert: {
          balances?: Json
          cash_register_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number
          id?: string
          location_id: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          organization_id: string
          status?: string
          ticket_count?: number
          total_card?: number
          total_cash?: number
          total_other?: number
          total_sales?: number
          total_transfer?: number
          updated_at?: string
        }
        Update: {
          balances?: Json
          cash_register_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number
          id?: string
          location_id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          organization_id?: string
          status?: string
          ticket_count?: number
          total_card?: number
          total_cash?: number
          total_other?: number
          total_sales?: number
          total_transfer?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_template_applications: {
        Row: {
          applied_at: string
          applied_by: string | null
          id: string
          items_created: number
          items_skipped: number
          items_updated: number
          mode: string
          notes: string | null
          organization_id: string
          template_id: string
          template_version: number
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          id?: string
          items_created?: number
          items_skipped?: number
          items_updated?: number
          mode?: string
          notes?: string | null
          organization_id: string
          template_id: string
          template_version: number
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          id?: string
          items_created?: number
          items_skipped?: number
          items_updated?: number
          mode?: string
          notes?: string | null
          organization_id?: string
          template_id?: string
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_template_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_template_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "catalog_template_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "catalog_template_applications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "catalog_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_template_items: {
        Row: {
          brand: string | null
          category_slug: string | null
          created_at: string
          description: string | null
          gtin: string | null
          id: string
          image_url: string | null
          name: string
          sku: string | null
          sort_order: number | null
          suggested_cost: number | null
          suggested_price: number | null
          suggested_wholesale: number | null
          tags: string[] | null
          template_id: string
          unit: string | null
        }
        Insert: {
          brand?: string | null
          category_slug?: string | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          name: string
          sku?: string | null
          sort_order?: number | null
          suggested_cost?: number | null
          suggested_price?: number | null
          suggested_wholesale?: number | null
          tags?: string[] | null
          template_id: string
          unit?: string | null
        }
        Update: {
          brand?: string | null
          category_slug?: string | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sku?: string | null
          sort_order?: number | null
          suggested_cost?: number | null
          suggested_price?: number | null
          suggested_wholesale?: number | null
          tags?: string[] | null
          template_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "catalog_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_templates: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean
          name: string
          niche_key: string
          total_items: number
          updated_at: string
          version: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          niche_key: string
          total_items?: number
          updated_at?: string
          version?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          niche_key?: string
          total_items?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          kitchen_station_id: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          organization_id: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          kitchen_station_id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          organization_id: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          kitchen_station_id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          organization_id?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_downloads: {
        Row: {
          category: string
          created_at: string
          description: string | null
          download_url: string
          file_type: string
          icon: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          download_url: string
          file_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          download_url?: string
          file_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_tickets: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          attachments: Json
          category: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          module: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
          video_url: string | null
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          attachments?: Json
          category?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          module?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          attachments?: Json
          category?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          module?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          pdf_url: string | null
          signed_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          signed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          pdf_url?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      critical_action_types: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          expires_minutes: number
          is_active: boolean
          label: string
          requires_cosign: boolean
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          expires_minutes?: number
          is_active?: boolean
          label: string
          requires_cosign?: boolean
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          expires_minutes?: number
          is_active?: boolean
          label?: string
          requires_cosign?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      critical_actions: {
        Row: {
          action_type: string
          cancelled_reason: string | null
          cosign_decision: string | null
          cosign_reason: string | null
          cosigned_at: string | null
          cosigned_by: string | null
          cosigned_by_email: string | null
          created_at: string
          executed_at: string | null
          execution_result: Json | null
          expires_at: string
          id: string
          justification: string
          payload: Json
          requested_by: string
          requested_by_email: string | null
          status: string
          target_org_id: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          cancelled_reason?: string | null
          cosign_decision?: string | null
          cosign_reason?: string | null
          cosigned_at?: string | null
          cosigned_by?: string | null
          cosigned_by_email?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          expires_at: string
          id?: string
          justification: string
          payload?: Json
          requested_by: string
          requested_by_email?: string | null
          status?: string
          target_org_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          cancelled_reason?: string | null
          cosign_decision?: string | null
          cosign_reason?: string | null
          cosigned_at?: string | null
          cosigned_by?: string | null
          cosigned_by_email?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          expires_at?: string
          id?: string
          justification?: string
          payload?: Json
          requested_by?: string
          requested_by_email?: string | null
          status?: string
          target_org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "critical_actions_action_type_fkey"
            columns: ["action_type"]
            isOneToOne: false
            referencedRelation: "critical_action_types"
            referencedColumns: ["action_type"]
          },
          {
            foreignKeyName: "critical_actions_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critical_actions_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "critical_actions_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          message: string | null
          modules_interest: string[] | null
          notes: string | null
          organization_id: string
          phone: string | null
          plan_interest: string | null
          source: string
          source_page: string | null
          status: string
          updated_at: string
          utm: Json
        }
        Insert: {
          assigned_to?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          message?: string | null
          modules_interest?: string[] | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          plan_interest?: string | null
          source?: string
          source_page?: string | null
          status?: string
          updated_at?: string
          utm?: Json
        }
        Update: {
          assigned_to?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          message?: string | null
          modules_interest?: string[] | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          plan_interest?: string | null
          source?: string
          source_page?: string | null
          status?: string
          updated_at?: string
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      csp_violations: {
        Row: {
          blocked_uri: string | null
          column_number: number | null
          created_at: string
          disposition: string | null
          document_uri: string | null
          effective_directive: string | null
          id: string
          line_number: number | null
          organization_id: string | null
          raw: Json | null
          source_file: string | null
          status_code: number | null
          user_agent: string | null
          violated_directive: string | null
        }
        Insert: {
          blocked_uri?: string | null
          column_number?: number | null
          created_at?: string
          disposition?: string | null
          document_uri?: string | null
          effective_directive?: string | null
          id?: string
          line_number?: number | null
          organization_id?: string | null
          raw?: Json | null
          source_file?: string | null
          status_code?: number | null
          user_agent?: string | null
          violated_directive?: string | null
        }
        Update: {
          blocked_uri?: string | null
          column_number?: number | null
          created_at?: string
          disposition?: string | null
          document_uri?: string | null
          effective_directive?: string | null
          id?: string
          line_number?: number | null
          organization_id?: string | null
          raw?: Json | null
          source_file?: string | null
          status_code?: number | null
          user_agent?: string | null
          violated_directive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csp_violations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csp_violations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "csp_violations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      custom_scripts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: string
          script_content: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: string
          script_content: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: string
          script_content?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "custom_scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      customer_reviews: {
        Row: {
          admin_response: string | null
          comment: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          order_id: string | null
          organization_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          comment: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          order_id?: string | null
          organization_id: string
          rating?: number
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          comment?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          order_id?: string | null
          organization_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "customer_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      daily_checklist: {
        Row: {
          created_at: string
          day: string
          done: boolean
          id: string
          item_key: string
          notes: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          done?: boolean
          id?: string
          item_key: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          item_key?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "daily_checklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      desktop_releases: {
        Row: {
          channel: string
          created_by: string | null
          download_url: string
          id: string
          is_current: boolean
          platform: string
          published_at: string
          release_notes: string | null
          sha256: string | null
          size_bytes: number | null
          version: string
        }
        Insert: {
          channel?: string
          created_by?: string | null
          download_url: string
          id?: string
          is_current?: boolean
          platform: string
          published_at?: string
          release_notes?: string | null
          sha256?: string | null
          size_bytes?: number | null
          version: string
        }
        Update: {
          channel?: string
          created_by?: string | null
          download_url?: string
          id?: string
          is_current?: boolean
          platform?: string
          published_at?: string
          release_notes?: string | null
          sha256?: string | null
          size_bytes?: number | null
          version?: string
        }
        Relationships: []
      }
      dining_areas: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          capacity: number
          created_at: string
          dining_area_id: string | null
          height: number
          id: string
          is_active: boolean
          label: string
          location_id: string
          organization_id: string
          pos_x: number
          pos_y: number
          shape: string
          status: string
          updated_at: string
          width: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          dining_area_id?: string | null
          height?: number
          id?: string
          is_active?: boolean
          label: string
          location_id: string
          organization_id: string
          pos_x?: number
          pos_y?: number
          shape?: string
          status?: string
          updated_at?: string
          width?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          dining_area_id?: string | null
          height?: number
          id?: string
          is_active?: boolean
          label?: string
          location_id?: string
          organization_id?: string
          pos_x?: number
          pos_y?: number
          shape?: string
          status?: string
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_dining_area_id_fkey"
            columns: ["dining_area_id"]
            isOneToOne: false
            referencedRelation: "dining_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          applies_to_modules: string[]
          code: string
          created_at: string
          default_for_business_types: string[] | null
          description: string | null
          dian_code: string | null
          family: string
          goes_to_dian: boolean
          id: string
          is_active: boolean
          label: string
          requires_customer_id: boolean
          requires_resolution: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to_modules?: string[]
          code: string
          created_at?: string
          default_for_business_types?: string[] | null
          description?: string | null
          dian_code?: string | null
          family: string
          goes_to_dian?: boolean
          id?: string
          is_active?: boolean
          label: string
          requires_customer_id?: boolean
          requires_resolution?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to_modules?: string[]
          code?: string
          created_at?: string
          default_for_business_types?: string[] | null
          description?: string | null
          dian_code?: string | null
          family?: string
          goes_to_dian?: boolean
          id?: string
          is_active?: boolean
          label?: string
          requires_customer_id?: boolean
          requires_resolution?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dunning_events: {
        Row: {
          attempt: number
          created_at: string
          id: string
          invoice_id: string | null
          next_retry_at: string | null
          organization_id: string
          reason: string | null
          resolved_at: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          next_retry_at?: string | null
          organization_id: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          attempt?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          next_retry_at?: string | null
          organization_id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "dunning_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "dunning_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_configs: {
        Row: {
          api_key: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contingency_range: Json | null
          created_at: string
          default_doc_type_consumer_final: string
          default_doc_type_fx_operation: string
          default_doc_type_with_nit: string
          dian_health_status: string
          dv: string | null
          environment: string
          extra: Json
          hard_block_when_dian_down: boolean
          id: string
          is_active: boolean
          nit: string
          organization_id: string
          pos_behavior: Json
          razon_social: string | null
          resolution_current: number | null
          resolution_from: number | null
          resolution_number: string | null
          resolution_prefix: string | null
          resolution_to: number | null
          resolution_valid_from: string | null
          resolution_valid_until: string | null
          technical_key: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contingency_range?: Json | null
          created_at?: string
          default_doc_type_consumer_final?: string
          default_doc_type_fx_operation?: string
          default_doc_type_with_nit?: string
          dian_health_status?: string
          dv?: string | null
          environment?: string
          extra?: Json
          hard_block_when_dian_down?: boolean
          id?: string
          is_active?: boolean
          nit: string
          organization_id: string
          pos_behavior?: Json
          razon_social?: string | null
          resolution_current?: number | null
          resolution_from?: number | null
          resolution_number?: string | null
          resolution_prefix?: string | null
          resolution_to?: number | null
          resolution_valid_from?: string | null
          resolution_valid_until?: string | null
          technical_key?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contingency_range?: Json | null
          created_at?: string
          default_doc_type_consumer_final?: string
          default_doc_type_fx_operation?: string
          default_doc_type_with_nit?: string
          dian_health_status?: string
          dv?: string | null
          environment?: string
          extra?: Json
          hard_block_when_dian_down?: boolean
          id?: string
          is_active?: boolean
          nit?: string
          organization_id?: string
          pos_behavior?: Json
          razon_social?: string | null
          resolution_current?: number | null
          resolution_from?: number | null
          resolution_number?: string | null
          resolution_prefix?: string | null
          resolution_to?: number | null
          resolution_valid_from?: string | null
          resolution_valid_until?: string | null
          technical_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "einvoice_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      einvoice_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          invoice_id: string | null
          message: string | null
          organization_id: string
          payload: Json | null
          performed_by: string | null
          response: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          organization_id: string
          payload?: Json | null
          performed_by?: string | null
          response?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          organization_id?: string
          payload?: Json | null
          performed_by?: string | null
          response?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "electronic_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "einvoice_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      electronic_invoices: {
        Row: {
          contingency_emitted_at: string | null
          created_at: string
          created_by: string | null
          cufe: string | null
          currency: string
          customer_email: string | null
          customer_identification: string | null
          customer_name: string | null
          dian_response: Json | null
          document_type: string
          environment: string
          full_number: string | null
          id: string
          is_contingency: boolean
          issue_date: string
          last_error: string | null
          location_id: string | null
          next_retry_at: string | null
          note_concept_code: string | null
          note_concept_text: string | null
          number: number | null
          order_id: string | null
          organization_id: string
          outbox_id: string | null
          pdf_url: string | null
          pos_order_id: string | null
          prefix: string | null
          qr_url: string | null
          reference_cufe: string | null
          reference_full_number: string | null
          reference_invoice_id: string | null
          reference_issue_date: string | null
          request_payload: Json | null
          retry_count: number
          status: string
          subtotal: number
          tax_total: number
          total: number
          track_id: string | null
          transmitted_at: string | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          contingency_emitted_at?: string | null
          created_at?: string
          created_by?: string | null
          cufe?: string | null
          currency?: string
          customer_email?: string | null
          customer_identification?: string | null
          customer_name?: string | null
          dian_response?: Json | null
          document_type?: string
          environment?: string
          full_number?: string | null
          id?: string
          is_contingency?: boolean
          issue_date?: string
          last_error?: string | null
          location_id?: string | null
          next_retry_at?: string | null
          note_concept_code?: string | null
          note_concept_text?: string | null
          number?: number | null
          order_id?: string | null
          organization_id: string
          outbox_id?: string | null
          pdf_url?: string | null
          pos_order_id?: string | null
          prefix?: string | null
          qr_url?: string | null
          reference_cufe?: string | null
          reference_full_number?: string | null
          reference_invoice_id?: string | null
          reference_issue_date?: string | null
          request_payload?: Json | null
          retry_count?: number
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          track_id?: string | null
          transmitted_at?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          contingency_emitted_at?: string | null
          created_at?: string
          created_by?: string | null
          cufe?: string | null
          currency?: string
          customer_email?: string | null
          customer_identification?: string | null
          customer_name?: string | null
          dian_response?: Json | null
          document_type?: string
          environment?: string
          full_number?: string | null
          id?: string
          is_contingency?: boolean
          issue_date?: string
          last_error?: string | null
          location_id?: string | null
          next_retry_at?: string | null
          note_concept_code?: string | null
          note_concept_text?: string | null
          number?: number | null
          order_id?: string | null
          organization_id?: string
          outbox_id?: string | null
          pdf_url?: string | null
          pos_order_id?: string | null
          prefix?: string | null
          qr_url?: string | null
          reference_cufe?: string | null
          reference_full_number?: string | null
          reference_invoice_id?: string | null
          reference_issue_date?: string | null
          request_payload?: Json | null
          retry_count?: number
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          track_id?: string | null
          transmitted_at?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electronic_invoices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "electronic_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "electronic_invoices_pos_order_id_fkey"
            columns: ["pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_reference_invoice_id_fkey"
            columns: ["reference_invoice_id"]
            isOneToOne: false
            referencedRelation: "electronic_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          tenant_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          tenant_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          tenant_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      featured_sections: {
        Row: {
          created_at: string
          emoji: string | null
          filter_type: string
          filter_value: string | null
          id: string
          is_active: boolean
          label: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          filter_type?: string
          filter_value?: string | null
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          filter_type?: string
          filter_value?: string | null
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "featured_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      fx_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          transaction_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          transaction_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "fx_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          symbol: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          symbol?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_currencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_currencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_currencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      fx_fraud_alerts: {
        Row: {
          created_at: string
          details: Json
          id: string
          organization_id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_code: string
          rule_id: string | null
          severity: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          organization_id: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_code: string
          rule_id?: string | null
          severity?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          organization_id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_code?: string
          rule_id?: string | null
          severity?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_fraud_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_fraud_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_fraud_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_fraud_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "fx_fraud_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_fraud_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "fx_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_fraud_rules: {
        Row: {
          auto_mark_suspicious: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          params: Json
          rule_code: string
          severity: string
          updated_at: string
        }
        Insert: {
          auto_mark_suspicious?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          params?: Json
          rule_code: string
          severity?: string
          updated_at?: string
        }
        Update: {
          auto_mark_suspicious?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          params?: Json
          rule_code?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_fraud_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_fraud_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_fraud_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      fx_fraud_watchlist: {
        Row: {
          added_by: string | null
          created_at: string
          doc_number: string
          doc_type: string | null
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          doc_number: string
          doc_type?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          doc_number?: string
          doc_type?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_fraud_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_fraud_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_fraud_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      fx_pairs: {
        Row: {
          base_currency_id: string
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          quote_currency_id: string
          updated_at: string
        }
        Insert: {
          base_currency_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          quote_currency_id: string
          updated_at?: string
        }
        Update: {
          base_currency_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          quote_currency_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_pairs_base_currency_id_fkey"
            columns: ["base_currency_id"]
            isOneToOne: false
            referencedRelation: "fx_currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_pairs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_pairs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_pairs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_pairs_quote_currency_id_fkey"
            columns: ["quote_currency_id"]
            isOneToOne: false
            referencedRelation: "fx_currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_pricing_rules: {
        Row: {
          auto_publish: boolean
          base_source: string
          created_at: string
          id: string
          is_active: boolean
          max_buy: number | null
          max_sell: number | null
          min_buy: number | null
          min_sell: number | null
          organization_id: string
          pair_id: string
          spread_buy_pct: number
          spread_sell_pct: number
          updated_at: string
        }
        Insert: {
          auto_publish?: boolean
          base_source?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_buy?: number | null
          max_sell?: number | null
          min_buy?: number | null
          min_sell?: number | null
          organization_id: string
          pair_id: string
          spread_buy_pct?: number
          spread_sell_pct?: number
          updated_at?: string
        }
        Update: {
          auto_publish?: boolean
          base_source?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_buy?: number | null
          max_sell?: number | null
          min_buy?: number | null
          min_sell?: number | null
          organization_id?: string
          pair_id?: string
          spread_buy_pct?: number
          spread_sell_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_pricing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_pricing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_pricing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_pricing_rules_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "fx_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_rate: number | null
          buy_rate: number
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_published: boolean
          organization_id: string
          pair_id: string
          published_at: string | null
          published_by: string | null
          sell_rate: number
          source: string
        }
        Insert: {
          base_rate?: number | null
          buy_rate: number
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_published?: boolean
          organization_id: string
          pair_id: string
          published_at?: string | null
          published_by?: string | null
          sell_rate: number
          source?: string
        }
        Update: {
          base_rate?: number | null
          buy_rate?: number
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_published?: boolean
          organization_id?: string
          pair_id?: string
          published_at?: string | null
          published_by?: string | null
          sell_rate?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_rates_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "fx_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_transactions: {
        Row: {
          cash_session_id: string | null
          cashier_id: string | null
          commission_amount: number | null
          commission_currency_id: string | null
          commission_invoice_status: string
          created_at: string
          customer_address: string | null
          customer_doc_number: string | null
          customer_doc_type: string | null
          customer_name: string | null
          customer_occupation: string | null
          electronic_invoice_id: string | null
          from_amount: number
          from_currency_id: string
          funds_origin: string | null
          id: string
          is_above_threshold: boolean
          is_suspicious: boolean
          location_id: string | null
          mid_rate: number | null
          notes: string | null
          operation: string
          organization_id: string
          pair_id: string
          rate_applied: number
          receipt_number: string | null
          ros_reason: string | null
          to_amount: number
          to_currency_id: string
        }
        Insert: {
          cash_session_id?: string | null
          cashier_id?: string | null
          commission_amount?: number | null
          commission_currency_id?: string | null
          commission_invoice_status?: string
          created_at?: string
          customer_address?: string | null
          customer_doc_number?: string | null
          customer_doc_type?: string | null
          customer_name?: string | null
          customer_occupation?: string | null
          electronic_invoice_id?: string | null
          from_amount: number
          from_currency_id: string
          funds_origin?: string | null
          id?: string
          is_above_threshold?: boolean
          is_suspicious?: boolean
          location_id?: string | null
          mid_rate?: number | null
          notes?: string | null
          operation: string
          organization_id: string
          pair_id: string
          rate_applied: number
          receipt_number?: string | null
          ros_reason?: string | null
          to_amount: number
          to_currency_id: string
        }
        Update: {
          cash_session_id?: string | null
          cashier_id?: string | null
          commission_amount?: number | null
          commission_currency_id?: string | null
          commission_invoice_status?: string
          created_at?: string
          customer_address?: string | null
          customer_doc_number?: string | null
          customer_doc_type?: string | null
          customer_name?: string | null
          customer_occupation?: string | null
          electronic_invoice_id?: string | null
          from_amount?: number
          from_currency_id?: string
          funds_origin?: string | null
          id?: string
          is_above_threshold?: boolean
          is_suspicious?: boolean
          location_id?: string | null
          mid_rate?: number | null
          notes?: string | null
          operation?: string
          organization_id?: string
          pair_id?: string
          rate_applied?: number
          receipt_number?: string | null
          ros_reason?: string | null
          to_amount?: number
          to_currency_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_transactions_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_commission_currency_id_fkey"
            columns: ["commission_currency_id"]
            isOneToOne: false
            referencedRelation: "fx_currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_electronic_invoice_id_fkey"
            columns: ["electronic_invoice_id"]
            isOneToOne: false
            referencedRelation: "electronic_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_from_currency_id_fkey"
            columns: ["from_currency_id"]
            isOneToOne: false
            referencedRelation: "fx_currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fx_transactions_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "fx_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_transactions_to_currency_id_fkey"
            columns: ["to_currency_id"]
            isOneToOne: false
            referencedRelation: "fx_currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string
          is_active: boolean | null
          organization_id: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean | null
          organization_id: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean | null
          organization_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "gallery_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      google_reviews: {
        Row: {
          author_name: string
          created_at: string
          id: string
          is_active: boolean
          organization_id: string | null
          profile_photo_url: string | null
          rating: number
          review_date: string | null
          review_text: string | null
          sort_order: number
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          profile_photo_url?: string | null
          rating?: number
          review_date?: string | null
          review_text?: string | null
          sort_order?: number
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          profile_photo_url?: string | null
          rating?: number
          review_date?: string | null
          review_text?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "google_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      health_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          id: string
          latency_ms: number | null
          message: string | null
          metadata: Json
          organization_id: string | null
          prev_status: string | null
          source: string
          status: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json
          organization_id?: string | null
          prev_status?: string | null
          source: string
          status: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json
          organization_id?: string | null
          prev_status?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "health_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          city: string | null
          created_at: string
          cta_link: string | null
          cta_text: string | null
          id: string
          image_mobile_url: string | null
          image_url: string | null
          is_active: boolean | null
          organization_id: string
          sort_order: number | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_mobile_url?: string | null
          image_url?: string | null
          is_active?: boolean | null
          organization_id: string
          sort_order?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_mobile_url?: string | null
          image_url?: string | null
          is_active?: boolean | null
          organization_id?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_slides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "hero_slides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      invoice_scan_items: {
        Row: {
          applied: boolean
          created_at: string
          description: string
          gtin: string | null
          id: string
          line_no: number | null
          matched_presentation_id: string | null
          matched_product_id: string | null
          quantity: number
          scan_id: string
          supplier_sku: string | null
          total: number | null
          unit: string | null
          unit_cost: number
        }
        Insert: {
          applied?: boolean
          created_at?: string
          description: string
          gtin?: string | null
          id?: string
          line_no?: number | null
          matched_presentation_id?: string | null
          matched_product_id?: string | null
          quantity?: number
          scan_id: string
          supplier_sku?: string | null
          total?: number | null
          unit?: string | null
          unit_cost?: number
        }
        Update: {
          applied?: boolean
          created_at?: string
          description?: string
          gtin?: string | null
          id?: string
          line_no?: number | null
          matched_presentation_id?: string | null
          matched_product_id?: string | null
          quantity?: number
          scan_id?: string
          supplier_sku?: string | null
          total?: number | null
          unit?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_scan_items_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "invoice_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_scans: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          image_url: string | null
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          organization_id: string
          raw_ocr: Json | null
          status: string
          subtotal: number | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_nit: string | null
          tax: number | null
          total: number | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id: string
          raw_ocr?: Json | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_nit?: string | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string
          raw_ocr?: Json | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_nit?: string | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_scans_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_tickets: {
        Row: {
          bumped_by: string | null
          created_at: string
          dining_table_label: string | null
          id: string
          items: Json
          kitchen_station_id: string | null
          location_id: string
          notes: string | null
          organization_id: string
          priority: number
          ready_at: string | null
          sent_at: string
          served_at: string | null
          started_at: string | null
          status: string
          table_order_id: string | null
          updated_at: string
        }
        Insert: {
          bumped_by?: string | null
          created_at?: string
          dining_table_label?: string | null
          id?: string
          items?: Json
          kitchen_station_id?: string | null
          location_id: string
          notes?: string | null
          organization_id: string
          priority?: number
          ready_at?: string | null
          sent_at?: string
          served_at?: string | null
          started_at?: string | null
          status?: string
          table_order_id?: string | null
          updated_at?: string
        }
        Update: {
          bumped_by?: string | null
          created_at?: string
          dining_table_label?: string | null
          id?: string
          items?: Json
          kitchen_station_id?: string | null
          location_id?: string
          notes?: string | null
          organization_id?: string
          priority?: number
          ready_at?: string | null
          sent_at?: string
          served_at?: string | null
          started_at?: string | null
          status?: string
          table_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kds_tickets_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_tickets_table_order_id_fkey"
            columns: ["table_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_stations: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          organization_id: string
          printer_id: string | null
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          organization_id: string
          printer_id?: string | null
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          organization_id?: string
          printer_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_stations_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_products: {
        Row: {
          created_at: string
          id: string
          landing_page_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          landing_page_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          landing_page_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_products_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          body_html: string | null
          canonical_url: string | null
          city: string | null
          created_at: string
          faq: Json
          heading: string | null
          hero: Json
          id: string
          image_url: string | null
          is_active: boolean
          json_ld: Json
          locale: string
          meta_description: string | null
          meta_title: string | null
          noindex: boolean
          og_image_url: string | null
          organization_id: string
          page_type: string
          site_scope: string
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          canonical_url?: string | null
          city?: string | null
          created_at?: string
          faq?: Json
          heading?: string | null
          hero?: Json
          id?: string
          image_url?: string | null
          is_active?: boolean
          json_ld?: Json
          locale?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          organization_id: string
          page_type?: string
          site_scope?: string
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          canonical_url?: string | null
          city?: string | null
          created_at?: string
          faq?: Json
          heading?: string | null
          hero?: Json
          id?: string
          image_url?: string | null
          is_active?: boolean
          json_ld?: Json
          locale?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          organization_id?: string
          page_type?: string
          site_scope?: string
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      landing_sections: {
        Row: {
          block_type: string
          created_at: string
          data: Json
          id: string
          is_active: boolean
          landing_page_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_type: string
          created_at?: string
          data?: Json
          id?: string
          is_active?: boolean
          landing_page_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_type?: string
          created_at?: string
          data?: Json
          id?: string
          is_active?: boolean
          landing_page_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_sections_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_trials: {
        Row: {
          business_name: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          is_active: boolean
          password_hash: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      license_activations: {
        Row: {
          activated_at: string
          app_version: string | null
          hostname: string | null
          id: string
          last_heartbeat_at: string
          license_id: string
          machine_fingerprint: string
          metadata: Json
          platform: string | null
          revoke_reason: string | null
          revoked_at: string | null
        }
        Insert: {
          activated_at?: string
          app_version?: string | null
          hostname?: string | null
          id?: string
          last_heartbeat_at?: string
          license_id: string
          machine_fingerprint: string
          metadata?: Json
          platform?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Update: {
          activated_at?: string
          app_version?: string | null
          hostname?: string | null
          id?: string
          last_heartbeat_at?: string
          license_id?: string
          machine_fingerprint?: string
          metadata?: Json
          platform?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_activations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      license_audit: {
        Row: {
          activation_id: string | null
          created_at: string
          event: string
          id: number
          ip: unknown
          license_id: string | null
          payload: Json
          user_agent: string | null
        }
        Insert: {
          activation_id?: string | null
          created_at?: string
          event: string
          id?: number
          ip?: unknown
          license_id?: string | null
          payload?: Json
          user_agent?: string | null
        }
        Update: {
          activation_id?: string | null
          created_at?: string
          event?: string
          id?: number
          ip?: unknown
          license_id?: string | null
          payload?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_audit_activation_id_fkey"
            columns: ["activation_id"]
            isOneToOne: false
            referencedRelation: "license_activations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_audit_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          business_name: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          issued_at: string
          license_key: string
          max_terminals: number
          metadata: Json
          notes: string | null
          organization_id: string
          payment_reference: string | null
          plan: string
          plan_type: string | null
          public_key: string
          signing_key_id: string
          start_date: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key?: string
          max_terminals?: number
          metadata?: Json
          notes?: string | null
          organization_id: string
          payment_reference?: string | null
          plan?: string
          plan_type?: string | null
          public_key: string
          signing_key_id: string
          start_date?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key?: string
          max_terminals?: number
          metadata?: Json
          notes?: string | null
          organization_id?: string
          payment_reference?: string | null
          plan?: string
          plan_type?: string | null
          public_key?: string
          signing_key_id?: string
          start_date?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "licenses_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          organization_id: string
          phone: string | null
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          organization_id: string
          phone?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      modifier_groups: {
        Row: {
          created_at: string
          display_label: string
          id: string
          is_active: boolean
          is_required: boolean
          max_selections: number
          min_selections: number
          name: string
          organization_id: string
          pricing_mode: string
          product_id: string
          selection_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_label: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          organization_id: string
          pricing_mode?: string
          product_id: string
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_label?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          organization_id?: string
          pricing_mode?: string
          product_id?: string
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "modifier_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          linked_product_id: string | null
          max_quantity: number
          modifier_group_id: string
          organization_id: string
          price_adjustment: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          linked_product_id?: string | null
          max_quantity?: number
          modifier_group_id: string
          organization_id: string
          price_adjustment?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          linked_product_id?: string | null
          max_quantity?: number
          modifier_group_id?: string
          organization_id?: string
          price_adjustment?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_options_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_options_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "modifier_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      municipality_settings: {
        Row: {
          city: string
          created_at: string
          free_shipping_enabled: boolean
          free_shipping_threshold: number
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          min_order_amount: number
          og_image_url: string | null
          organization_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          free_shipping_enabled?: boolean
          free_shipping_threshold?: number
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          min_order_amount?: number
          og_image_url?: string | null
          organization_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          free_shipping_enabled?: boolean
          free_shipping_threshold?: number
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          min_order_amount?: number
          og_image_url?: string | null
          organization_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipality_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipality_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "municipality_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      notification_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          notify_fresh: boolean | null
          notify_new_products: boolean | null
          notify_offers: boolean | null
          organization_id: string | null
          phone: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notify_fresh?: boolean | null
          notify_new_products?: boolean | null
          notify_offers?: boolean | null
          organization_id?: string | null
          phone: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notify_fresh?: boolean | null
          notify_new_products?: boolean | null
          notify_offers?: boolean | null
          organization_id?: string | null
          phone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notification_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          catalog_done: boolean
          company_done: boolean
          completed_at: string | null
          einvoice_done: boolean
          id: string
          location_done: boolean
          modules_done: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          catalog_done?: boolean
          company_done?: boolean
          completed_at?: string | null
          einvoice_done?: boolean
          id?: string
          location_done?: boolean
          modules_done?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          catalog_done?: boolean
          company_done?: boolean
          completed_at?: string | null
          einvoice_done?: boolean
          id?: string
          location_done?: boolean
          modules_done?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          organization_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          organization_id?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          organization_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
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
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_id: string | null
          amount_paid: number
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_profile_id: string | null
          delivery_price: number
          delivery_zone_id: string | null
          external_sync_sent_at: string | null
          external_sync_status: string
          id: string
          location_id: string | null
          notes: string | null
          order_number: number
          organization_id: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_recorded_at: string | null
          payment_status: string
          preferred_delivery_date: string | null
          preferred_time_slot: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          whatsapp_ref: string | null
        }
        Insert: {
          agent_id?: string | null
          amount_paid?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_profile_id?: string | null
          delivery_price?: number
          delivery_zone_id?: string | null
          external_sync_sent_at?: string | null
          external_sync_status?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_number?: number
          organization_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_recorded_at?: string | null
          payment_status?: string
          preferred_delivery_date?: string | null
          preferred_time_slot?: string | null
          status?: string
          subtotal?: number
          total: number
          updated_at?: string
          user_id?: string | null
          whatsapp_ref?: string | null
        }
        Update: {
          agent_id?: string | null
          amount_paid?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_profile_id?: string | null
          delivery_price?: number
          delivery_zone_id?: string | null
          external_sync_sent_at?: string | null
          external_sync_status?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_number?: number
          organization_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_recorded_at?: string | null
          payment_status?: string
          preferred_delivery_date?: string | null
          preferred_time_slot?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_signup_requests: {
        Row: {
          amount_cop: number | null
          business_name: string
          business_slug: string | null
          created_at: string
          email: string
          fulfilled_at: string | null
          fulfilled_license_id: string | null
          fulfilled_organization_id: string | null
          full_name: string
          id: string
          lead_id: string | null
          max_terminals: number
          modules: string[]
          nit: string | null
          payment_provider: string | null
          payment_reference: string | null
          phone: string | null
          plan: string
          raw_payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          amount_cop?: number | null
          business_name: string
          business_slug?: string | null
          created_at?: string
          email: string
          fulfilled_at?: string | null
          fulfilled_license_id?: string | null
          fulfilled_organization_id?: string | null
          full_name: string
          id?: string
          lead_id?: string | null
          max_terminals?: number
          modules?: string[]
          nit?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          phone?: string | null
          plan: string
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cop?: number | null
          business_name?: string
          business_slug?: string | null
          created_at?: string
          email?: string
          fulfilled_at?: string | null
          fulfilled_license_id?: string | null
          fulfilled_organization_id?: string | null
          full_name?: string
          id?: string
          lead_id?: string | null
          max_terminals?: number
          modules?: string[]
          nit?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          phone?: string | null
          plan?: string
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_signup_requests_fulfilled_license_id_fkey"
            columns: ["fulfilled_license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_signup_requests_fulfilled_organization_id_fkey"
            columns: ["fulfilled_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_signup_requests_fulfilled_organization_id_fkey"
            columns: ["fulfilled_organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_signup_requests_fulfilled_organization_id_fkey"
            columns: ["fulfilled_organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_signup_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_document_types: {
        Row: {
          created_at: string
          document_type_id: string
          id: string
          is_default: boolean
          is_enabled: boolean
          numbering_current: number | null
          numbering_from: number | null
          numbering_prefix: string | null
          numbering_to: number | null
          organization_id: string
          resolution_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type_id: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          numbering_current?: number | null
          numbering_from?: number | null
          numbering_prefix?: string | null
          numbering_to?: number | null
          organization_id: string
          resolution_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type_id?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          numbering_current?: number | null
          numbering_from?: number | null
          numbering_prefix?: string | null
          numbering_to?: number | null
          organization_id?: string
          resolution_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_document_types_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          location_ids: string[] | null
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          location_ids?: string[] | null
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          location_ids?: string[] | null
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          expires_at: string | null
          id: string
          module_key: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          module_key: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          module_key?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "organization_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          archived_payload: Json | null
          business_type: string
          city: string | null
          country: string
          created_at: string
          currency: string
          default_locale: string
          deleted_at: string | null
          deleted_by: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          lifecycle_state: Database["public"]["Enums"]["tenant_lifecycle_state"]
          logo_url: string | null
          name: string
          pos_default_mode: string
          pos_enabled_modes: string[]
          primary_color: string | null
          region: string | null
          settings: Json
          signing_key_created_at: string | null
          signing_key_id: string | null
          signing_private_key_encrypted: string | null
          signing_public_key: string | null
          slug: string
          support_email: string | null
          tagline: string | null
          tax_id: string | null
          timezone: string
          uiaf_threshold_amount: number | null
          uiaf_threshold_currency: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          accent_color?: string | null
          archived_payload?: Json | null
          business_type?: string
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          default_locale?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          lifecycle_state?: Database["public"]["Enums"]["tenant_lifecycle_state"]
          logo_url?: string | null
          name: string
          pos_default_mode?: string
          pos_enabled_modes?: string[]
          primary_color?: string | null
          region?: string | null
          settings?: Json
          signing_key_created_at?: string | null
          signing_key_id?: string | null
          signing_private_key_encrypted?: string | null
          signing_public_key?: string | null
          slug: string
          support_email?: string | null
          tagline?: string | null
          tax_id?: string | null
          timezone?: string
          uiaf_threshold_amount?: number | null
          uiaf_threshold_currency?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          accent_color?: string | null
          archived_payload?: Json | null
          business_type?: string
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          default_locale?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          lifecycle_state?: Database["public"]["Enums"]["tenant_lifecycle_state"]
          logo_url?: string | null
          name?: string
          pos_default_mode?: string
          pos_enabled_modes?: string[]
          primary_color?: string | null
          region?: string | null
          settings?: Json
          signing_key_created_at?: string | null
          signing_key_id?: string | null
          signing_private_key_encrypted?: string | null
          signing_public_key?: string | null
          slug?: string
          support_email?: string | null
          tagline?: string | null
          tax_id?: string | null
          timezone?: string
          uiaf_threshold_amount?: number | null
          uiaf_threshold_currency?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      parked_tickets: {
        Row: {
          cash_session_id: string | null
          cashier_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          items: Json
          label: string | null
          location_id: string | null
          notes: string | null
          organization_id: string
          subtotal: number
          total: number
        }
        Insert: {
          cash_session_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          label?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id: string
          subtotal?: number
          total?: number
        }
        Update: {
          cash_session_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          label?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "parked_tickets_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parked_tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parked_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parked_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "parked_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          license_id: string | null
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          license_id?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          license_id?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      persistent_carts: {
        Row: {
          cart_token: string
          channel: string
          created_at: string
          expires_at: string
          id: string
          items: Json
          last_activity_at: string
          metadata: Json
          organization_id: string | null
          phone: string | null
          status: string
          subtotal: number
          total_items: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cart_token?: string
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          last_activity_at?: string
          metadata?: Json
          organization_id?: string | null
          phone?: string | null
          status?: string
          subtotal?: number
          total_items?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cart_token?: string
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          last_activity_at?: string
          metadata?: Json
          organization_id?: string | null
          phone?: string | null
          status?: string
          subtotal?: number
          total_items?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persistent_carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persistent_carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "persistent_carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          created_at: string
          id: string
          limit_key: string
          plan_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          limit_key: string
          plan_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          limit_key?: string
          plan_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_modules: {
        Row: {
          created_at: string
          id: string
          included: boolean
          module_key: string
          plan_id: string
          quota_limit: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          included?: boolean
          module_key: string
          plan_id: string
          quota_limit?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          included?: boolean
          module_key?: string
          plan_id?: string
          quota_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          modifiers: Json
          notes: string | null
          organization_id: string
          pos_order_id: string
          presentation_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          tax_amount: number
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          modifiers?: Json
          notes?: string | null
          organization_id: string
          pos_order_id: string
          presentation_id?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          tax_amount?: number
          tax_rate?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          modifiers?: Json
          notes?: string | null
          organization_id?: string
          pos_order_id?: string
          presentation_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          tax_amount?: number
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_pos_order_id_fkey"
            columns: ["pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          amount_paid: number
          cash_session_id: string
          cashier_id: string
          change_due: number
          client_uuid: string | null
          created_at: string
          customer_document: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          discount: number
          einvoice_doc_type: string | null
          id: string
          location_id: string
          metadata: Json
          notes: string | null
          organization_id: string
          paid_at: string | null
          sale_mode: string
          status: string
          subtotal: number
          tax: number
          ticket_number: number
          tip: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          cash_session_id: string
          cashier_id: string
          change_due?: number
          client_uuid?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          discount?: number
          einvoice_doc_type?: string | null
          id?: string
          location_id: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          sale_mode?: string
          status?: string
          subtotal?: number
          tax?: number
          ticket_number?: number
          tip?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          cash_session_id?: string
          cashier_id?: string
          change_due?: number
          client_uuid?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          discount?: number
          einvoice_doc_type?: string | null
          id?: string
          location_id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          sale_mode?: string
          status?: string
          subtotal?: number
          tax?: number
          ticket_number?: number
          tip?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          amount: number
          cash_session_id: string
          created_at: string
          id: string
          metadata: Json
          method: string
          organization_id: string
          pos_order_id: string
          received_by: string
          reference: string | null
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string
          id?: string
          metadata?: Json
          method: string
          organization_id: string
          pos_order_id: string
          received_by: string
          reference?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          method?: string
          organization_id?: string
          pos_order_id?: string
          received_by?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_pos_order_id_fkey"
            columns: ["pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_quotes: {
        Row: {
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          location_id: string | null
          notes: string | null
          organization_id: string
          quote_number: number
          status: string
          subtotal: number
          total: number
          valid_until: string | null
        }
        Insert: {
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          location_id?: string | null
          notes?: string | null
          organization_id: string
          quote_number?: number
          status?: string
          subtotal?: number
          total?: number
          valid_until?: string | null
        }
        Update: {
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          quote_number?: number
          status?: string
          subtotal?: number
          total?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_quotes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pos_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          attempts: number
          client_uuid: string | null
          copies: number
          created_at: string
          created_by: string | null
          escpos_b64: string | null
          id: string
          kind: string
          last_error: string | null
          organization_id: string
          payload: Json
          pos_order_id: string | null
          printer_id: string | null
          processed_at: string | null
          status: string
          terminal_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_uuid?: string | null
          copies?: number
          created_at?: string
          created_by?: string | null
          escpos_b64?: string | null
          id?: string
          kind: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          pos_order_id?: string | null
          printer_id?: string | null
          processed_at?: string | null
          status?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_uuid?: string | null
          copies?: number
          created_at?: string
          created_by?: string | null
          escpos_b64?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          pos_order_id?: string | null
          printer_id?: string | null
          processed_at?: string | null
          status?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "print_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "print_jobs_pos_order_id_fkey"
            columns: ["pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "printer_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_routing_rules: {
        Row: {
          category_id: string | null
          copies: number
          created_at: string
          id: string
          is_active: boolean
          kitchen_station_id: string | null
          organization_id: string
          printer_id: string
          prints_on: string
          priority: number
          product_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          copies?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kitchen_station_id?: string | null
          organization_id: string
          printer_id: string
          prints_on?: string
          priority?: number
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          copies?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kitchen_station_id?: string | null
          organization_id?: string
          printer_id?: string
          prints_on?: string
          priority?: number
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_routing_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_rules_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "printer_routing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "printer_routing_rules_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_terminals: {
        Row: {
          acts_as_server: boolean
          capabilities: Json
          created_at: string
          fingerprint: string
          id: string
          last_seen_at: string | null
          name: string
          organization_id: string
          printer_ids: string[]
          updated_at: string
        }
        Insert: {
          acts_as_server?: boolean
          capabilities?: Json
          created_at?: string
          fingerprint: string
          id?: string
          last_seen_at?: string | null
          name: string
          organization_id: string
          printer_ids?: string[]
          updated_at?: string
        }
        Update: {
          acts_as_server?: boolean
          capabilities?: Json
          created_at?: string
          fingerprint?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          organization_id?: string
          printer_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_terminals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_terminals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "printer_terminals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      printers: {
        Row: {
          bluetooth_address: string | null
          characters_per_line: number
          codepage: string
          config: Json
          connection: string
          created_at: string
          cuts_paper: boolean
          id: string
          ip_address: string | null
          is_active: boolean
          is_default: boolean
          last_seen_at: string | null
          location_id: string | null
          model: string | null
          name: string
          opens_drawer: boolean
          organization_id: string
          os_printer_name: string | null
          paper_width_mm: number
          port: number | null
          product_id: string | null
          role: string
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          bluetooth_address?: string | null
          characters_per_line?: number
          codepage?: string
          config?: Json
          connection: string
          created_at?: string
          cuts_paper?: boolean
          id?: string
          ip_address?: string | null
          is_active?: boolean
          is_default?: boolean
          last_seen_at?: string | null
          location_id?: string | null
          model?: string | null
          name: string
          opens_drawer?: boolean
          organization_id: string
          os_printer_name?: string | null
          paper_width_mm?: number
          port?: number | null
          product_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          bluetooth_address?: string | null
          characters_per_line?: number
          codepage?: string
          config?: Json
          connection?: string
          created_at?: string
          cuts_paper?: boolean
          id?: string
          ip_address?: string | null
          is_active?: boolean
          is_default?: boolean
          last_seen_at?: string | null
          location_id?: string | null
          model?: string | null
          name?: string
          opens_drawer?: boolean
          organization_id?: string
          os_printer_name?: string | null
          paper_width_mm?: number
          port?: number | null
          product_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "printers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          organization_id: string | null
          product_id: string
          sort_order: number
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          organization_id?: string | null
          product_id: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          organization_id?: string | null
          product_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_presentations: {
        Row: {
          conversion_factor: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          price: number
          product_id: string
          sort_order: number
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          price: number
          product_id: string
          sort_order?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          price?: number
          product_id?: string
          sort_order?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_presentations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_presentations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_presentations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          avg_cost: number
          created_at: string
          id: string
          last_movement_at: string | null
          max_stock: number | null
          min_stock: number
          organization_id: string
          presentation_id: string | null
          product_id: string
          quantity: number
          reorder_point: number | null
          reserved_quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          avg_cost?: number
          created_at?: string
          id?: string
          last_movement_at?: string | null
          max_stock?: number | null
          min_stock?: number
          organization_id: string
          presentation_id?: string | null
          product_id: string
          quantity?: number
          reorder_point?: number | null
          reserved_quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          avg_cost?: number
          created_at?: string
          id?: string
          last_movement_at?: string | null
          max_stock?: number | null
          min_stock?: number
          organization_id?: string
          presentation_id?: string | null
          product_id?: string
          quantity?: number
          reorder_point?: number | null
          reserved_quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          availability: string | null
          available_days: number[] | null
          available_from: string | null
          available_time_end: string | null
          available_time_start: string | null
          available_until: string | null
          base_unit: string | null
          brand: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          gtin: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_fresh: boolean | null
          is_wholesale: boolean | null
          kitchen_station_id: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          net_weight_grams: number | null
          organization_id: string
          original_price: number | null
          price: number
          price_distributor: number | null
          price_wholesale: number | null
          sku: string | null
          slug: string | null
          stock: number
          tags: string[] | null
          unit: string | null
          unit_measure: string | null
          unit_quantity: number | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          availability?: string | null
          available_days?: number[] | null
          available_from?: string | null
          available_time_end?: string | null
          available_time_start?: string | null
          available_until?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_fresh?: boolean | null
          is_wholesale?: boolean | null
          kitchen_station_id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          net_weight_grams?: number | null
          organization_id: string
          original_price?: number | null
          price: number
          price_distributor?: number | null
          price_wholesale?: number | null
          sku?: string | null
          slug?: string | null
          stock?: number
          tags?: string[] | null
          unit?: string | null
          unit_measure?: string | null
          unit_quantity?: number | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          availability?: string | null
          available_days?: number[] | null
          available_from?: string | null
          available_time_end?: string | null
          available_time_start?: string | null
          available_until?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_fresh?: boolean | null
          is_wholesale?: boolean | null
          kitchen_station_id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          net_weight_grams?: number | null
          organization_id?: string
          original_price?: number | null
          price?: number
          price_distributor?: number | null
          price_wholesale?: number | null
          sku?: string | null
          slug?: string | null
          stock?: number
          tags?: string[] | null
          unit?: string | null
          unit_measure?: string | null
          unit_quantity?: number | null
          updated_at?: string
          weight?: string | null
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
            foreignKeyName: "products_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_name: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          created_at: string
          customer_code: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          created_at?: string
          customer_code?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          created_at?: string
          customer_code?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          applied: boolean
          created_at: string
          description: string | null
          id: string
          line_total: number
          organization_id: string
          presentation_id: string | null
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          supplier_sku: string | null
          unit_cost: number
        }
        Insert: {
          applied?: boolean
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          organization_id: string
          presentation_id?: string | null
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          supplier_sku?: string | null
          unit_cost?: number
        }
        Update: {
          applied?: boolean
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          organization_id?: string
          presentation_id?: string | null
          product_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          supplier_sku?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          expected_at: string | null
          id: string
          invoice_scan_id: string | null
          notes: string | null
          order_date: string
          organization_id: string
          po_code: string | null
          po_number: number
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_at?: string | null
          id?: string
          invoice_scan_id?: string | null
          notes?: string | null
          order_date?: string
          organization_id: string
          po_code?: string | null
          po_number?: number
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_at?: string | null
          id?: string
          invoice_scan_id?: string | null
          notes?: string | null
          order_date?: string
          organization_id?: string
          po_code?: string | null
          po_number?: number
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_invoice_scan_id_fkey"
            columns: ["invoice_scan_id"]
            isOneToOne: false
            referencedRelation: "invoice_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      push_broadcast_logs: {
        Row: {
          body: string
          created_at: string
          errors: Json | null
          failed: number
          icon: string | null
          id: string
          organization_id: string | null
          segment: string
          sent: number
          sent_at: string | null
          sent_by: string | null
          status: string
          title: string
          total: number
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          errors?: Json | null
          failed?: number
          icon?: string | null
          id?: string
          organization_id?: string | null
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title: string
          total?: number
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          errors?: Json | null
          failed?: number
          icon?: string | null
          id?: string
          organization_id?: string | null
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title?: string
          total?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "push_broadcast_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          notify_news: boolean
          notify_offers: boolean
          notify_order_updates: boolean
          organization_id: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          notify_news?: boolean
          notify_offers?: boolean
          notify_order_updates?: boolean
          organization_id?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          notify_news?: boolean
          notify_offers?: boolean
          notify_order_updates?: boolean
          organization_id?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          is_public: boolean
          key: string
          limits: Json
          modules: Json
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_public?: boolean
          key: string
          limits?: Json
          modules?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_public?: boolean
          key?: string
          limits?: Json
          modules?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      seo_content: {
        Row: {
          body_html: string | null
          city_scope: string | null
          created_at: string
          entity_slug: string
          entity_type: string
          faqs: Json
          heading: string | null
          id: string
          is_active: boolean
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          city_scope?: string | null
          created_at?: string
          entity_slug: string
          entity_type: string
          faqs?: Json
          heading?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          city_scope?: string | null
          created_at?: string
          entity_slug?: string
          entity_type?: string
          faqs?: Json
          heading?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_content_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "seo_content_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          allowed_resource_ids: string[] | null
          buffer_minutes: number
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          organization_id: string
          price: number
          requires_resource_kind: string | null
          slug: string | null
          sort_order: number
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          allowed_resource_ids?: string[] | null
          buffer_minutes?: number
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          price?: number
          requires_resource_kind?: string | null
          slug?: string | null
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          allowed_resource_ids?: string[] | null
          buffer_minutes?: number
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          price?: number
          requires_resource_kind?: string | null
          slug?: string | null
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      service_resources: {
        Row: {
          capacity: number
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          organization_id: string
          professional_user_id: string | null
          schedule: Json
          updated_at: string
        }
        Insert: {
          capacity?: number
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          organization_id: string
          professional_user_id?: string | null
          schedule?: Json
          updated_at?: string
        }
        Update: {
          capacity?: number
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          organization_id?: string
          professional_user_id?: string | null
          schedule?: Json
          updated_at?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          organization_id: string
          requires_table: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          organization_id: string
          requires_table?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          organization_id?: string
          requires_table?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          city: string
          created_at: string
          delivery_price: number
          id: string
          is_active: boolean | null
          neighborhood: string
          organization_id: string
        }
        Insert: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood: string
          organization_id: string
        }
        Update: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "shipping_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      sso_handoff_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          issuer_ip: string | null
          issuer_ua: string | null
          nonce: string
          refresh_token: string
          target_tenant: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          issuer_ip?: string | null
          issuer_ua?: string | null
          nonce?: string
          refresh_token: string
          target_tenant?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          issuer_ip?: string | null
          issuer_ua?: string | null
          nonce?: string
          refresh_token?: string
          target_tenant?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          balance_after: number | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          organization_id: string
          presentation_id: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          presentation_id?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number
          warehouse_id: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          presentation_id?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: []
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          presentation_id: string | null
          product_id: string
          quantity_received: number | null
          quantity_sent: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          presentation_id?: string | null
          product_id: string
          quantity_received?: number | null
          quantity_sent: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          presentation_id?: string | null
          product_id?: string
          quantity_received?: number | null
          quantity_sent?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          organization_id: string
          received_at: string | null
          received_by: string | null
          sent_at: string | null
          status: string
          to_warehouse_id: string
          transfer_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          organization_id: string
          received_at?: string | null
          received_by?: string | null
          sent_at?: string | null
          status?: string
          to_warehouse_id: string
          transfer_number?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          received_at?: string | null
          received_by?: string | null
          sent_at?: string | null
          status?: string
          to_warehouse_id?: string
          transfer_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string
          external_id: string | null
          id: string
          organization_id: string
          paid_at: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          status: string
          subscription_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date: string
          external_id?: string | null
          id?: string
          organization_id: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string
          external_id?: string | null
          id?: string
          organization_id?: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscription_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          metadata: Json
          organization_id: string
          plan: string
          plan_id: string | null
          provider: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          plan?: string
          plan_id?: string | null
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          plan?: string
          plan_id?: string | null
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          is_preferred: boolean
          last_purchased_at: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          notes: string | null
          organization_id: string
          pack_size: number | null
          product_id: string
          supplier_id: string
          supplier_name_ref: string | null
          supplier_sku: string
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          is_preferred?: boolean
          last_purchased_at?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          organization_id: string
          pack_size?: number | null
          product_id: string
          supplier_id: string
          supplier_name_ref?: string | null
          supplier_sku: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          is_preferred?: boolean
          last_purchased_at?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          organization_id?: string
          pack_size?: number | null
          product_id?: string
          supplier_id?: string
          supplier_name_ref?: string | null
          supplier_sku?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          plan: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          attempts: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          last_run_at: string
          organization_id: string | null
          payload: Json | null
          service_name: string
          started_at: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          last_run_at?: string
          organization_id?: string | null
          payload?: Json | null
          service_name: string
          started_at?: string
          status: string
        }
        Update: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          last_run_at?: string
          organization_id?: string | null
          payload?: Json | null
          service_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sync_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string | null
          payload: Json
          status: string
          succeeded_at: string | null
          target: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id?: string | null
          payload?: Json
          status?: string
          succeeded_at?: string | null
          target: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id?: string | null
          payload?: Json
          status?: string
          succeeded_at?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_order_items: {
        Row: {
          course: number
          created_at: string
          created_by: string | null
          discount: number
          id: string
          kitchen_station_id: string | null
          modifiers: Json
          notes: string | null
          organization_id: string
          presentation_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          ready_at: string | null
          sent_at: string | null
          served_at: string | null
          sku: string | null
          status: string
          table_order_id: string
          total: number
          unit_price: number
        }
        Insert: {
          course?: number
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          kitchen_station_id?: string | null
          modifiers?: Json
          notes?: string | null
          organization_id: string
          presentation_id?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          ready_at?: string | null
          sent_at?: string | null
          served_at?: string | null
          sku?: string | null
          status?: string
          table_order_id: string
          total: number
          unit_price: number
        }
        Update: {
          course?: number
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          kitchen_station_id?: string | null
          modifiers?: Json
          notes?: string | null
          organization_id?: string
          presentation_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          ready_at?: string | null
          sent_at?: string | null
          served_at?: string | null
          sku?: string | null
          status?: string
          table_order_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_order_items_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_order_items_table_order_id_fkey"
            columns: ["table_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      table_orders: {
        Row: {
          billed_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          dining_table_id: string | null
          discount: number
          guest_count: number
          id: string
          location_id: string
          metadata: Json
          notes: string | null
          opened_at: string
          order_number: number
          organization_id: string
          paid_at: string | null
          pos_order_id: string | null
          service_type_key: string
          status: string
          subtotal: number
          tip: number
          total: number
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          billed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dining_table_id?: string | null
          discount?: number
          guest_count?: number
          id?: string
          location_id: string
          metadata?: Json
          notes?: string | null
          opened_at?: string
          order_number?: number
          organization_id: string
          paid_at?: string | null
          pos_order_id?: string | null
          service_type_key?: string
          status?: string
          subtotal?: number
          tip?: number
          total?: number
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          billed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dining_table_id?: string | null
          discount?: number
          guest_count?: number
          id?: string
          location_id?: string
          metadata?: Json
          notes?: string | null
          opened_at?: string
          order_number?: number
          organization_id?: string
          paid_at?: string | null
          pos_order_id?: string | null
          service_type_key?: string
          status?: string
          subtotal?: number
          tip?: number
          total?: number
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_orders_dining_table_id_fkey"
            columns: ["dining_table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          organization_id: string | null
          organization_slug: string | null
          payload: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          organization_slug?: string | null
          payload?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          organization_slug?: string | null
          payload?: Json
        }
        Relationships: []
      }
      tenant_cloudflare_accounts: {
        Row: {
          api_token_encrypted: string
          cf_account_id: string
          cf_zone_id: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_token_encrypted: string
          cf_account_id: string
          cf_zone_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_token_encrypted?: string
          cf_account_id?: string
          cf_zone_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_domains: {
        Row: {
          cf_account_id: string | null
          cf_dcv_method: string | null
          cf_hostname_id: string | null
          cf_ownership_verification: Json | null
          cf_ssl_status: string | null
          cf_ssl_validation_records: Json | null
          cf_status: string | null
          cf_zone_id: string | null
          cname_target: string | null
          created_at: string
          dns_mode: string
          hostname: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          notes: string | null
          organization_id: string
          site_id: string
          ssl_status: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          cf_account_id?: string | null
          cf_dcv_method?: string | null
          cf_hostname_id?: string | null
          cf_ownership_verification?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation_records?: Json | null
          cf_status?: string | null
          cf_zone_id?: string | null
          cname_target?: string | null
          created_at?: string
          dns_mode?: string
          hostname: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          notes?: string | null
          organization_id: string
          site_id: string
          ssl_status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          cf_account_id?: string | null
          cf_dcv_method?: string | null
          cf_hostname_id?: string | null
          cf_ownership_verification?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation_records?: Json | null
          cf_status?: string | null
          cf_zone_id?: string | null
          cname_target?: string | null
          created_at?: string
          dns_mode?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          notes?: string | null
          organization_id?: string
          site_id?: string
          ssl_status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "tenant_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_limit_overrides: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          limit_key: string
          organization_id: string
          reason: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          limit_key: string
          organization_id: string
          reason?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          limit_key?: string
          organization_id?: string
          reason?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_limit_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_limit_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tenant_limit_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tenant_module_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          expires_at: string | null
          granted_by: string | null
          id: string
          module_key: string
          organization_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          module_key: string
          organization_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          module_key?: string
          organization_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_module_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "tenant_module_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_module_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tenant_module_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tenant_sites: {
        Row: {
          accent_color: string | null
          created_at: string
          default_locale: string | null
          description: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          name: string
          organization_id: string
          primary_color: string | null
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          default_locale?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name: string
          organization_id: string
          primary_color?: string | null
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          default_locale?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_sync_log: {
        Row: {
          created_at: string
          error: string | null
          failed: number | null
          id: string
          kind: string
          organization_id: string
          payload: Json | null
          site_id: string
          status: string
          succeeded: number | null
          total: number | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed?: number | null
          id?: string
          kind: string
          organization_id: string
          payload?: Json | null
          site_id: string
          status?: string
          succeeded?: number | null
          total?: number | null
        }
        Update: {
          created_at?: string
          error?: string | null
          failed?: number | null
          id?: string
          kind?: string
          organization_id?: string
          payload?: Json | null
          site_id?: string
          status?: string
          succeeded?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sync_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "tenant_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_counters: {
        Row: {
          id: string
          limit_key: string
          organization_id: string
          period_key: string
          updated_at: string
          used: number
        }
        Insert: {
          id?: string
          limit_key: string
          organization_id: string
          period_key?: string
          updated_at?: string
          used?: number
        }
        Update: {
          id?: string
          limit_key?: string
          organization_id?: string
          period_key?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tenant_usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tenant_wp_config: {
        Row: {
          created_at: string
          default_post_type: string | null
          id: string
          last_sync_at: string | null
          organization_id: string
          plugin_token: string | null
          product_cpt: string | null
          revalidate_token: string | null
          revalidate_url: string | null
          site_id: string
          taxonomies: Json | null
          updated_at: string
          webhook_secret: string | null
          wp_app_password: string | null
          wp_app_user: string | null
          wp_base_url: string
          wp_username: string | null
        }
        Insert: {
          created_at?: string
          default_post_type?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          plugin_token?: string | null
          product_cpt?: string | null
          revalidate_token?: string | null
          revalidate_url?: string | null
          site_id: string
          taxonomies?: Json | null
          updated_at?: string
          webhook_secret?: string | null
          wp_app_password?: string | null
          wp_app_user?: string | null
          wp_base_url: string
          wp_username?: string | null
        }
        Update: {
          created_at?: string
          default_post_type?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          plugin_token?: string | null
          product_cpt?: string | null
          revalidate_token?: string | null
          revalidate_url?: string | null
          site_id?: string
          taxonomies?: Json | null
          updated_at?: string
          webhook_secret?: string | null
          wp_app_password?: string | null
          wp_app_user?: string | null
          wp_base_url?: string
          wp_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wp_config_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "tenant_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          content: string
          created_at: string
          customer_city: string | null
          customer_name: string
          id: string
          is_active: boolean | null
          rating: number | null
          sort_order: number | null
        }
        Insert: {
          content: string
          created_at?: string
          customer_city?: string | null
          customer_name: string
          id?: string
          is_active?: boolean | null
          rating?: number | null
          sort_order?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          customer_city?: string | null
          customer_name?: string
          id?: string
          is_active?: boolean | null
          rating?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "client_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          metric: string
          module_key: string
          organization_id: string
          quantity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          metric: string
          module_key: string
          organization_id: string
          quantity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          metric?: string
          module_key?: string
          organization_id?: string
          quantity?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_limits"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_entitlements_modules"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          is_sellable: boolean
          location_id: string
          name: string
          organization_id: string
          updated_at: string
          warehouse_type: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_sellable?: boolean
          location_id: string
          name: string
          organization_id: string
          updated_at?: string
          warehouse_type?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_sellable?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          warehouse_type?: string
        }
        Relationships: []
      }
      whatsapp_message_events: {
        Row: {
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          payload: Json | null
          status: string
          whatsapp_ref: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          status: string
          whatsapp_ref?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          status?: string
          whatsapp_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_public: {
        Row: {
          availability: string | null
          base_unit: string | null
          brand: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          gtin: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_fresh: boolean | null
          is_wholesale: boolean | null
          meta_description: string | null
          meta_title: string | null
          name: string | null
          net_weight_grams: number | null
          original_price: number | null
          price: number | null
          sku: string | null
          slug: string | null
          stock: number | null
          tags: string[] | null
          unit: string | null
          unit_measure: string | null
          unit_quantity: number | null
          updated_at: string | null
          weight: string | null
        }
        Insert: {
          availability?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          gtin?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_fresh?: boolean | null
          is_wholesale?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string | null
          net_weight_grams?: number | null
          original_price?: number | null
          price?: number | null
          sku?: string | null
          slug?: string | null
          stock?: number | null
          tags?: string[] | null
          unit?: string | null
          unit_measure?: string | null
          unit_quantity?: number | null
          updated_at?: string | null
          weight?: string | null
        }
        Update: {
          availability?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          gtin?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_fresh?: boolean | null
          is_wholesale?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string | null
          net_weight_grams?: number | null
          original_price?: number | null
          price?: number | null
          sku?: string | null
          slug?: string | null
          stock?: number | null
          tags?: string[] | null
          unit?: string | null
          unit_measure?: string | null
          unit_quantity?: number | null
          updated_at?: string | null
          weight?: string | null
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
      v_tenant_entitlements_limits: {
        Row: {
          effective_value: number | null
          limit_key: string | null
          organization_id: string | null
          override_value: number | null
          plan_value: number | null
          source: string | null
        }
        Relationships: []
      }
      v_tenant_entitlements_modules: {
        Row: {
          category: string | null
          enabled: boolean | null
          module_key: string | null
          module_name: string | null
          organization_id: string | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _attach_tenant_writable_guard: {
        Args: { _table: unknown }
        Returns: undefined
      }
      _require_superadmin: { Args: never; Returns: undefined }
      _tenant_log: {
        Args: { _action: string; _org: string; _payload: Json }
        Returns: undefined
      }
      admin_list_customer_reviews: {
        Args: never
        Returns: {
          admin_response: string | null
          comment: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          order_id: string | null
          organization_id: string
          rating: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customer_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      app_current_role: { Args: never; Returns: string }
      apply_catalog_template: {
        Args: { _mode?: string; _org_id: string; _template_id: string }
        Returns: Json
      }
      apply_invoice_scan: {
        Args: { _scan_id: string; _warehouse_id: string }
        Returns: Json
      }
      apply_stock_movement: {
        Args: {
          _movement_type: string
          _notes?: string
          _org_id: string
          _presentation_id: string
          _product_id: string
          _quantity: number
          _reference_id?: string
          _reference_type?: string
          _unit_cost?: number
          _warehouse_id: string
        }
        Returns: string
      }
      archive_tenant: {
        Args: { _org_id: string; _reason?: string }
        Returns: Json
      }
      assert_org_writable: { Args: { _org_id: string }; Returns: undefined }
      auto_renew_subscriptions: {
        Args: never
        Returns: {
          new_period_end: string
          organization_id: string
          subscription_id: string
        }[]
      }
      can_access_section: { Args: { _section: string }; Returns: boolean }
      can_write_org: { Args: { _org_id: string }; Returns: boolean }
      cancel_critical_action: {
        Args: { _action_id: string; _reason?: string }
        Returns: Json
      }
      cleanup_sso_tokens: { Args: never; Returns: number }
      close_cash_session_multi_currency: {
        Args: { _counts: Json; _notes?: string; _session_id: string }
        Returns: Json
      }
      close_cash_session_with_counts: {
        Args: { _counts: Json; _session_id: string }
        Returns: Json
      }
      complete_persistent_cart: {
        Args: { _cart_token: string }
        Returns: boolean
      }
      consume_limit: {
        Args: {
          _delta?: number
          _limit_key: string
          _org_id: string
          _period?: string
        }
        Returns: Json
      }
      cosign_critical_action: {
        Args: { _action_id: string; _decision: string; _reason?: string }
        Returns: Json
      }
      count_active_terminals: { Args: { _license_id: string }; Returns: number }
      create_license: {
        Args: {
          _expires_at?: string
          _max_terminals: number
          _notes?: string
          _org_id: string
          _plan: string
          _public_key: string
          _signing_key_id: string
        }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      default_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      einvoice_apply_business_type_defaults: {
        Args: { _org_id?: string }
        Returns: number
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_print_job: {
        Args: { _kind?: string; _order_id: string }
        Returns: string[]
      }
      expire_overdue_subscriptions: {
        Args: never
        Returns: {
          organization_id: string
          subscription_id: string
        }[]
      }
      export_tenant_snapshot: { Args: { _org_id: string }; Returns: Json }
      fx_apply_pricing_rule: {
        Args: {
          _base: number
          _rule: Database["public"]["Tables"]["fx_pricing_rules"]["Row"]
        }
        Returns: {
          buy_rate: number
          sell_rate: number
        }[]
      }
      fx_apply_session_balance: {
        Args: { _currency_code: string; _delta: number; _session_id: string }
        Returns: undefined
      }
      fx_convert_to_currency: {
        Args: {
          p_amount: number
          p_at?: string
          p_from_currency_id: string
          p_organization_id: string
          p_to_currency_code: string
        }
        Returns: number
      }
      fx_customer_monthly_accumulated: {
        Args: {
          p_doc_number: string
          p_month_start?: string
          p_organization_id: string
        }
        Returns: {
          accumulated: number
          cross_count: number
          currency: string
          exceeds: boolean
          missing_rate_count: number
          tx_count: number
        }[]
      }
      fx_publish_rate: {
        Args: {
          _base_rate?: number
          _buy_rate: number
          _pair_id: string
          _sell_rate: number
          _source?: string
        }
        Returns: string
      }
      get_admin_products_secure:
        | {
            Args: never
            Returns: {
              availability: string
              available_days: number[]
              available_from: string
              available_time_end: string
              available_time_start: string
              available_until: string
              base_unit: string
              brand: string
              category_id: string
              category_name: string
              cost_price: number
              created_at: string
              description: string
              gtin: string
              id: string
              image_url: string
              is_active: boolean
              is_fresh: boolean
              is_wholesale: boolean
              kitchen_station_id: string
              meta_description: string
              meta_title: string
              name: string
              net_weight_grams: number
              organization_id: string
              original_price: number
              price: number
              price_distributor: number
              price_wholesale: number
              sku: string
              slug: string
              stock: number
              tags: string[]
              unit: string
              unit_measure: string
              unit_quantity: number
              updated_at: string
              weight: string
            }[]
          }
        | {
            Args: {
              _cursor_created_at?: string
              _cursor_id?: string
              _limit?: number
              _search?: string
            }
            Returns: {
              availability: string
              available_days: number[]
              available_from: string
              available_time_end: string
              available_time_start: string
              available_until: string
              base_unit: string
              brand: string
              category_id: string
              category_name: string
              cost_price: number
              created_at: string
              description: string
              gtin: string
              id: string
              image_url: string
              is_active: boolean
              is_fresh: boolean
              is_wholesale: boolean
              kitchen_station_id: string
              meta_description: string
              meta_title: string
              name: string
              net_weight_grams: number
              organization_id: string
              original_price: number
              price: number
              price_distributor: number
              price_wholesale: number
              sku: string
              slug: string
              stock: number
              tags: string[]
              unit: string
              unit_measure: string
              unit_quantity: number
              updated_at: string
              weight: string
            }[]
          }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_landing_by_slug: {
        Args: { _scope: string; _slug: string }
        Returns: Json
      }
      get_persistent_cart: {
        Args: { _cart_token: string }
        Returns: {
          cart_token: string
          channel: string
          items: Json
          phone: string
          status: string
          subtotal: number
          total_items: number
          updated_at: string
          user_id: string
        }[]
      }
      get_recent_sync_logs: {
        Args: { _limit?: number; _services?: string[] }
        Returns: {
          attempts: number
          duration_ms: number
          error_message: string
          id: string
          last_run_at: string
          organization_id: string
          payload: Json
          service_name: string
          status: string
        }[]
      }
      get_resource_availability: {
        Args: {
          _day: string
          _org_id: string
          _resource_id: string
          _slot_minutes?: number
        }
        Returns: {
          is_free: boolean
          slot_end: string
          slot_start: string
        }[]
      }
      get_upgrade_target_plan: {
        Args: { _module_key: string }
        Returns: string
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_module: {
        Args: { _module_key: string; _org_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_activation: {
        Args: { _fingerprint: string; _license_key: string }
        Returns: Json
      }
      import_tenant_snapshot: {
        Args: { _overwrite?: boolean; _payload: Json }
        Returns: Json
      }
      is_feature_enabled: {
        Args: { _key: string; _tenant_id?: string }
        Returns: boolean
      }
      is_master_superadmin: { Args: { _user_id?: string }; Returns: boolean }
      is_member_of: { Args: { _org_id: string }; Returns: boolean }
      is_tenant_readable: { Args: { _org_id: string }; Returns: boolean }
      is_tenant_writable: { Args: { _org_id: string }; Returns: boolean }
      log_sync_event:
        | {
            Args: {
              _attempts?: number
              _duration_ms?: number
              _error_message?: string
              _log_id: string
              _organization_id: string
              _payload?: Json
              _service_name: string
              _status: string
            }
            Returns: string
          }
        | {
            Args: {
              p_error?: string
              p_org_id: string
              p_payload?: Json
              p_service: string
              p_status: string
            }
            Returns: string
          }
      log_usage: {
        Args: {
          _meta?: Json
          _metric: string
          _module: string
          _org_id: string
          _qty?: number
        }
        Returns: string
      }
      mark_critical_action_executed: {
        Args: { _action_id: string; _result?: Json }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_role: { Args: { _org_id: string }; Returns: string }
      peek_limit: {
        Args: { _limit_key: string; _org_id: string; _period?: string }
        Returns: Json
      }
      provision_organization: {
        Args: {
          _business_type?: string
          _expires_at?: string
          _full_name?: string
          _max_terminals?: number
          _metadata?: Json
          _modules?: string[]
          _org_name: string
          _org_slug: string
          _owner_email: string
          _owner_user_id: string
          _payment_reference?: string
          _phone?: string
          _plan?: string
          _public_key?: string
          _signing_key_id?: string
        }
        Returns: Json
      }
      purge_tenant_hard: { Args: { _org_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      receive_purchase_order: {
        Args: { _po_id: string; _warehouse_id: string }
        Returns: Json
      }
      redeem_coupon: { Args: { _coupon_id: string }; Returns: boolean }
      register_activation: {
        Args: {
          _app_version: string
          _fingerprint: string
          _hostname: string
          _license_key: string
          _platform: string
        }
        Returns: Json
      }
      rematch_invoice_scan: { Args: { _scan_id: string }; Returns: Json }
      request_critical_action: {
        Args: {
          _action_type: string
          _justification: string
          _payload: Json
          _target_org: string
        }
        Returns: Json
      }
      resolve_limit: {
        Args: { _limit_key: string; _org_id: string }
        Returns: number
      }
      resolve_tenant_by_host: { Args: { _host: string }; Returns: Json }
      restore_tenant: { Args: { _org_id: string }; Returns: Json }
      revoke_activation: {
        Args: { _activation_id: string; _reason?: string }
        Returns: boolean
      }
      set_primary_tenant_domain: {
        Args: { p_domain_id: string }
        Returns: undefined
      }
      superadmin_purge_obsolete_overrides: {
        Args: { _organization_id: string }
        Returns: {
          purged_module_key: string
          reason: string
        }[]
      }
      transition_tenant_lifecycle: {
        Args: {
          _new_state: Database["public"]["Enums"]["tenant_lifecycle_state"]
          _org_id: string
          _reason?: string
        }
        Returns: Json
      }
      upsert_persistent_cart: {
        Args: {
          _cart_token: string
          _channel?: string
          _items: Json
          _metadata?: Json
          _phone?: string
          _subtotal: number
          _total_items: number
          _user_id?: string
        }
        Returns: string
      }
      user_orgs: {
        Args: { _user_id: string }
        Returns: {
          name: string
          organization_id: string
          role: string
          slug: string
        }[]
      }
      validate_coupon: {
        Args: { _code: string; _order_total: number }
        Returns: {
          code: string
          discount_amount: number
          discount_type: string
          discount_value: number
          id: string
          min_order_amount: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "superadmin"
        | "editor"
        | "agente"
        | "cashier"
      business_type:
        | "detal"
        | "horeca"
        | "minimercado"
        | "distribuidor"
        | "casa"
        | "casa_cambio"
      tenant_lifecycle_state:
        | "pending"
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "archived"
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
    Enums: {
      app_role: ["admin", "user", "superadmin", "editor", "agente", "cashier"],
      business_type: [
        "detal",
        "horeca",
        "minimercado",
        "distribuidor",
        "casa",
        "casa_cambio",
      ],
      tenant_lifecycle_state: [
        "pending",
        "trial",
        "active",
        "past_due",
        "suspended",
        "archived",
      ],
    },
  },
} as const
