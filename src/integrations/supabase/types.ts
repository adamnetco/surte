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
        ]
      }
      banners: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        ]
      }
      broadcast_logs: {
        Row: {
          created_at: string
          errors: Json | null
          failed: number
          id: string
          message: string
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
          scheduled_at?: string | null
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total?: number
          updated_at?: string
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
      cash_sessions: {
        Row: {
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
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          organization_id: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          organization_id?: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          organization_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        ]
      }
      custom_scripts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        ]
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
      featured_sections: {
        Row: {
          created_at: string
          emoji: string | null
          filter_type: string
          filter_value: string | null
          id: string
          is_active: boolean
          label: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean | null
          organization_id?: string | null
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean | null
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          city: string | null
          created_at: string
          heading: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          organization_id: string | null
          page_type: string
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          city?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          organization_id?: string | null
          page_type?: string
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          city?: string | null
          created_at?: string
          heading?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          organization_id?: string | null
          page_type?: string
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        ]
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
          phone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_type: string
          country: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          business_type?: string
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_type?: string
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
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
          created_at: string
          customer_document: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          discount: number
          id: string
          location_id: string
          metadata: Json
          notes: string | null
          organization_id: string
          paid_at: string | null
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
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          discount?: number
          id?: string
          location_id: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          paid_at?: string | null
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
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          discount?: number
          id?: string
          location_id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          meta_description: string | null
          meta_title: string | null
          name: string
          net_weight_grams: number | null
          organization_id: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          name: string
          net_weight_grams?: number | null
          organization_id?: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          net_weight_grams?: number | null
          organization_id?: string | null
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
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          segment?: string
          sent?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title?: string
          total?: number
          url?: string | null
        }
        Relationships: []
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
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        ]
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
          organization_id: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood: string
          organization_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json
          organization_id: string
          plan: string
          provider: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          plan?: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          plan?: string
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
        ]
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
    }
    Functions: {
      complete_persistent_cart: {
        Args: { _cart_token: string }
        Returns: boolean
      }
      default_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { _org_id: string }; Returns: boolean }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_coupon: { Args: { _coupon_id: string }; Returns: boolean }
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
      app_role: "admin" | "user" | "superadmin" | "editor" | "agente"
      business_type:
        | "detal"
        | "horeca"
        | "minimercado"
        | "distribuidor"
        | "casa"
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
      app_role: ["admin", "user", "superadmin", "editor", "agente"],
      business_type: ["detal", "horeca", "minimercado", "distribuidor", "casa"],
    },
  },
} as const
