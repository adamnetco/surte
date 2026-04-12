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
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
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
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          slug?: string | null
          sort_order?: number | null
          website_url?: string | null
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
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
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
          slug?: string
          sort_order?: number | null
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: []
      }
      custom_scripts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
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
          position?: string
          script_content?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string
          is_active: boolean | null
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      google_reviews: {
        Row: {
          author_name: string
          created_at: string
          id: string
          is_active: boolean
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
          profile_photo_url?: string | null
          rating?: number
          review_date?: string | null
          review_text?: string | null
          sort_order?: number
        }
        Relationships: []
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
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          page_type?: string
          slug?: string
          sort_order?: number | null
          title?: string
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
          pricing_mode?: string
          product_id?: string
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
            foreignKeyName: "modifier_options_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      municipality_settings: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          min_order_amount: number
          og_image_url: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          min_order_amount?: number
          og_image_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          min_order_amount?: number
          og_image_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
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
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_id: string | null
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
          notes: string | null
          order_number: number
          payment_method: string | null
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
          notes?: string | null
          order_number?: number
          payment_method?: string | null
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
          notes?: string | null
          order_number?: number
          payment_method?: string | null
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
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
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
          product_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          price?: number
          product_id?: string
          sort_order?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: string | null
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
          phone?: string | null
          updated_at?: string
          user_id?: string
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
        }
        Insert: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood: string
        }
        Update: {
          city?: string
          created_at?: string
          delivery_price?: number
          id?: string
          is_active?: boolean | null
          neighborhood?: string
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
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
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
