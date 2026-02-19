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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          category: string
          client_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          field_accessed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action?: string
          category?: string
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          field_accessed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          category?: string
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          field_accessed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          auto_process_days: number[] | null
          auto_process_time: string | null
          created_at: string
          id: string
          last_auto_run_date: string | null
          last_osago_series: string | null
          monthly_goal: number
          notification_test_mode: boolean
          preferred_rounding_service_id: string | null
          rounding_step: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_process_days?: number[] | null
          auto_process_time?: string | null
          created_at?: string
          id?: string
          last_auto_run_date?: string | null
          last_osago_series?: string | null
          monthly_goal?: number
          notification_test_mode?: boolean
          preferred_rounding_service_id?: string | null
          rounding_step?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_process_days?: number[] | null
          auto_process_time?: string | null
          created_at?: string
          id?: string
          last_auto_run_date?: string | null
          last_osago_series?: string | null
          monthly_goal?: number
          notification_test_mode?: boolean
          preferred_rounding_service_id?: string | null
          rounding_step?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_preferred_rounding_service_id_fkey"
            columns: ["preferred_rounding_service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_config: {
        Row: {
          action_type: string
          config_value: number | null
          created_at: string
          id: string
          is_enabled: boolean
          restriction_bypass_until: string | null
          rule_type: string
          target_role: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string
          config_value?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          restriction_bypass_until?: string | null
          rule_type?: string
          target_role?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          config_value?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          restriction_bypass_until?: string | null
          rule_type?: string
          target_role?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          slug: string
          template_id: string | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          template_id?: string | null
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          template_id?: string | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      car_brands_models: {
        Row: {
          brand: string
          created_at: string
          id: string
          model: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          model?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          model?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          media_type: string | null
          media_url: string | null
          room_id: string | null
          sender_id: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          room_id?: string | null
          sender_id?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          room_id?: string | null
          sender_id?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          joined_at: string | null
          last_read_at: string | null
          room_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          debt_payment_id: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          sale_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          debt_payment_id?: string | null
          document_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          sale_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          debt_payment_id?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          sale_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_debt_payment_id_fkey"
            columns: ["debt_payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_completed: boolean
          reminder_date: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          reminder_date?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          reminder_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          agent_id: string | null
          archive_reason: string | null
          birth_date: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          inn: string | null
          is_archived: boolean
          is_company: boolean
          is_pnd_signed: boolean
          last_name: string
          middle_name: string | null
          notes: string | null
          passport_data: string | null
          passport_issue_date: string | null
          passport_issued_by: string | null
          passport_number: string | null
          passport_series: string | null
          passport_unit_code: string | null
          phone: string
          pnd_signed_date: string | null
          telegram_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          archive_reason?: string | null
          birth_date?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          inn?: string | null
          is_archived?: boolean
          is_company?: boolean
          is_pnd_signed?: boolean
          last_name: string
          middle_name?: string | null
          notes?: string | null
          passport_data?: string | null
          passport_issue_date?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_series?: string | null
          passport_unit_code?: string | null
          phone: string
          pnd_signed_date?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          archive_reason?: string | null
          birth_date?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          inn?: string | null
          is_archived?: boolean
          is_company?: boolean
          is_pnd_signed?: boolean
          last_name?: string
          middle_name?: string | null
          notes?: string | null
          passport_data?: string | null
          passport_issue_date?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_series?: string | null
          passport_unit_code?: string | null
          phone?: string
          pnd_signed_date?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_at: string
          payment_method: string
          sale_id: string
          shift_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          sale_id: string
          shift_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          sale_id?: string
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      document_archives: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          document_data: Json
          id: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          document_data?: Json
          id?: string
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          document_data?: Json
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_archives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          email_address: string
          id: string
          imap_host: string
          imap_port: number
          is_active: boolean
          is_org_account: boolean
          last_sync_at: string | null
          password_encrypted: string
          signature: string | null
          smtp_host: string
          smtp_port: number
          updated_at: string
          use_ssl: boolean
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_address: string
          id?: string
          imap_host: string
          imap_port?: number
          is_active?: boolean
          is_org_account?: boolean
          last_sync_at?: string | null
          password_encrypted: string
          signature?: string | null
          smtp_host: string
          smtp_port?: number
          updated_at?: string
          use_ssl?: boolean
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_address?: string
          id?: string
          imap_host?: string
          imap_port?: number
          is_active?: boolean
          is_org_account?: boolean
          last_sync_at?: string | null
          password_encrypted?: string
          signature?: string | null
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          use_ssl?: boolean
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          content_type: string | null
          created_at: string | null
          email_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          email_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          email_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          attachments: Json | null
          bcc: string | null
          body_html: string | null
          cc: string | null
          client_id: string | null
          company_id: string | null
          created_at: string | null
          direction: string | null
          email_account_id: string | null
          external_uid: string | null
          folder: string
          from_email: string
          id: string
          is_read: boolean | null
          open_count: number
          opened_at: string | null
          reply_to_id: string | null
          subject: string | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          bcc?: string | null
          body_html?: string | null
          cc?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          email_account_id?: string | null
          external_uid?: string | null
          folder?: string
          from_email: string
          id?: string
          is_read?: boolean | null
          open_count?: number
          opened_at?: string | null
          reply_to_id?: string | null
          subject?: string | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          bcc?: string | null
          body_html?: string | null
          cc?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          email_account_id?: string | null
          external_uid?: string | null
          folder?: string
          from_email?: string
          id?: string
          is_read?: boolean | null
          open_count?: number
          opened_at?: string | null
          reply_to_id?: string | null
          subject?: string | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_contracts: {
        Row: {
          commission_rate: number
          company_id: string
          contract_number: string
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          start_date: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          company_id: string
          contract_number: string
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          start_date: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          company_id?: string
          contract_number?: string
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_products: {
        Row: {
          code: string
          created_at: string
          default_commission_percent: number
          default_series: string | null
          id: string
          is_active: boolean
          is_roundable: boolean
          name: string
          number_length: number
          number_mask: string | null
          requires_vehicle: boolean
          round_to: number
          series_mask: string | null
        }
        Insert: {
          code: string
          created_at?: string
          default_commission_percent?: number
          default_series?: string | null
          id?: string
          is_active?: boolean
          is_roundable?: boolean
          name: string
          number_length?: number
          number_mask?: string | null
          requires_vehicle?: boolean
          round_to?: number
          series_mask?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          default_commission_percent?: number
          default_series?: string | null
          id?: string
          is_active?: boolean
          is_roundable?: boolean
          name?: string
          number_length?: number
          number_mask?: string | null
          requires_vehicle?: boolean
          round_to?: number
          series_mask?: string | null
        }
        Relationships: []
      }
      mass_broadcasts: {
        Row: {
          audience_filter: string
          audience_params: Json
          channel: string
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          sent_count: number
          started_at: string | null
          status: string
          template_id: string | null
          total_recipients: number
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_filter?: string
          audience_params?: Json
          channel?: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_filter?: string
          audience_params?: Json
          channel?: string
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          client_id: string
          content: string
          created_at: string
          delivery_status: string
          direction: string
          external_message_id: string | null
          id: string
          is_automated: boolean
          is_internal: boolean
          is_read: boolean
          manager_id: string | null
          media_type: string | null
          media_url: string | null
          message_type: string
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          client_id: string
          content: string
          created_at?: string
          delivery_status?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          is_automated?: boolean
          is_internal?: boolean
          is_read?: boolean
          manager_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          client_id?: string
          content?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          is_automated?: boolean
          is_internal?: boolean
          is_read?: boolean
          manager_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_activity_logs: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messenger_settings: {
        Row: {
          channel: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          broadcast_id: string | null
          channel: string
          client_id: string
          created_at: string
          error_message: string | null
          external_message_id: string | null
          external_peer_id: string | null
          id: string
          message: string
          policy_id: string | null
          read_at: string | null
          sent_at: string
          source: string | null
          status: string
          template_id: string | null
          template_title: string | null
          trigger_id: string | null
          user_id: string
        }
        Insert: {
          broadcast_id?: string | null
          channel?: string
          client_id: string
          created_at?: string
          error_message?: string | null
          external_message_id?: string | null
          external_peer_id?: string | null
          id?: string
          message: string
          policy_id?: string | null
          read_at?: string | null
          sent_at?: string
          source?: string | null
          status?: string
          template_id?: string | null
          template_title?: string | null
          trigger_id?: string | null
          user_id: string
        }
        Update: {
          broadcast_id?: string | null
          channel?: string
          client_id?: string
          created_at?: string
          error_message?: string | null
          external_message_id?: string | null
          external_peer_id?: string | null
          id?: string
          message?: string
          policy_id?: string | null
          read_at?: string | null
          sent_at?: string
          source?: string | null
          status?: string
          template_id?: string | null
          template_title?: string | null
          trigger_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "notification_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          message_template: string
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template?: string
          slug: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template?: string
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_triggers: {
        Row: {
          created_at: string
          days_before: number
          event_type: string
          id: string
          is_active: boolean
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before?: number
          event_type: string
          id?: string
          is_active?: boolean
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before?: number
          event_type?: string
          id?: string
          is_active?: boolean
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          currency: string
          enable_watermarks: boolean
          id: string
          inn: string | null
          is_setup_complete: boolean
          logo_url: string | null
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          currency?: string
          enable_watermarks?: boolean
          id?: string
          inn?: string | null
          is_setup_complete?: boolean
          logo_url?: string | null
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          enable_watermarks?: boolean
          id?: string
          inn?: string | null
          is_setup_complete?: boolean
          logo_url?: string | null
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          commission_received_at: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_type: string
          policy_id: string
          status: string
          transferred_to_insurer: string | null
        }
        Insert: {
          amount: number
          client_id: string
          commission_received_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_type: string
          policy_id: string
          status?: string
          transferred_to_insurer?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          commission_received_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_type?: string
          policy_id?: string
          status?: string
          transferred_to_insurer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_conversations: {
        Row: {
          client_id: string
          id: string
          pinned_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          id?: string
          pinned_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          id?: string
          pinned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          agent_id: string | null
          client_id: string
          commission_amount: number
          commission_percent: number
          created_at: string
          end_date: string
          id: string
          insurance_company: string
          insurance_product_id: string | null
          notes: string | null
          payment_status: string
          policy_number: string
          policy_series: string | null
          policy_type: string
          premium_amount: number
          prolongation_status: string
          start_date: string
          status: string
          updated_at: string
          vehicle_model: string | null
          vehicle_number: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          end_date: string
          id?: string
          insurance_company: string
          insurance_product_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_number: string
          policy_series?: string | null
          policy_type: string
          premium_amount: number
          prolongation_status?: string
          start_date: string
          status?: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_number?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          end_date?: string
          id?: string
          insurance_company?: string
          insurance_product_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_number?: string
          policy_series?: string | null
          policy_type?: string
          premium_amount?: number
          prolongation_status?: string
          start_date?: string
          status?: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_insurance_product_id_fkey"
            columns: ["insurance_product_id"]
            isOneToOne: false
            referencedRelation: "insurance_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_service_links: {
        Row: {
          created_at: string
          id: string
          inclusion_type: string
          is_deletion_prohibited: boolean
          product_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inclusion_type?: string
          is_deletion_prohibited?: boolean
          product_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inclusion_type?: string
          is_deletion_prohibited?: boolean
          product_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_service_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "insurance_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_service_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_role_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          last_login_at: string | null
          last_seen_at: string | null
          must_change_password: boolean
          telegram_chat_id: string | null
          temp_password: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_role_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          telegram_chat_id?: string | null
          temp_password?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_role_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          telegram_chat_id?: string | null
          temp_password?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_custom_role_name_fkey"
            columns: ["custom_role_name"]
            isOneToOne: false
            referencedRelation: "user_roles_list"
            referencedColumns: ["role_name"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          permission_key: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          permission_key: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          permission_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_audit_log: {
        Row: {
          action: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          sale_id: string
          timestamp: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          sale_id: string
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          sale_id?: string
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_audit_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          amount: number
          commission_amount: number | null
          commission_percent: number | null
          created_at: string
          end_date: string | null
          id: string
          insurance_company: string | null
          insurance_product_id: string | null
          item_type: string
          policy_number: string | null
          policy_series: string | null
          premium_amount: number | null
          quantity: number | null
          sale_id: string
          service_name: string | null
          start_date: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          insurance_company?: string | null
          insurance_product_id?: string | null
          item_type: string
          policy_number?: string | null
          policy_series?: string | null
          premium_amount?: number | null
          quantity?: number | null
          sale_id: string
          service_name?: string | null
          start_date?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          insurance_company?: string | null
          insurance_product_id?: string | null
          item_type?: string
          policy_number?: string | null
          policy_series?: string | null
          premium_amount?: number | null
          quantity?: number | null
          sale_id?: string
          service_name?: string | null
          start_date?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_insurance_product_id_fkey"
            columns: ["insurance_product_id"]
            isOneToOne: false
            referencedRelation: "insurance_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          audit_log: Json
          bank_id: string | null
          client_id: string
          company_id: string | null
          completed_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          debt_status: string
          id: string
          installment_due_date: string | null
          installment_payments_count: number | null
          is_installment: boolean | null
          items: Json
          payment_method: string
          rounding_amount: number
          status: string
          total_amount: number
          uid: string
        }
        Insert: {
          amount_paid?: number
          audit_log?: Json
          bank_id?: string | null
          client_id: string
          company_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_status?: string
          id?: string
          installment_due_date?: string | null
          installment_payments_count?: number | null
          is_installment?: boolean | null
          items?: Json
          payment_method?: string
          rounding_amount?: number
          status?: string
          total_amount?: number
          uid: string
        }
        Update: {
          amount_paid?: number
          audit_log?: Json
          bank_id?: string | null
          client_id?: string
          company_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          debt_status?: string
          id?: string
          installment_due_date?: string | null
          installment_payments_count?: number | null
          is_installment?: boolean | null
          items?: Json
          payment_method?: string
          rounding_amount?: number
          status?: string
          total_amount?: number
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "insurance_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_email: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_email?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_email?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      services_catalog: {
        Row: {
          category: string
          created_at: string
          default_price: number
          id: string
          is_active: boolean
          is_roundable: boolean
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_price?: number
          id?: string
          is_active?: boolean
          is_roundable?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          default_price?: number
          id?: string
          is_active?: boolean
          is_roundable?: boolean
          name?: string
        }
        Relationships: []
      }
      shift_reports: {
        Row: {
          actual_closing_balance: number
          actual_opening_balance: number
          actual_withdrawal: number
          amount_to_keep: number
          closed_at: string | null
          closing_discrepancy_reason: string | null
          created_at: string
          expected_closing_balance: number
          expected_opening_balance: number
          id: string
          income_cash: number
          income_debt: number
          income_non_cash: number
          notes: string | null
          opened_at: string
          opening_discrepancy_reason: string | null
          sales_summary: Json | null
          services_summary: Json | null
          status: Database["public"]["Enums"]["shift_status"]
          suggested_withdrawal: number
          total_revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_closing_balance?: number
          actual_opening_balance?: number
          actual_withdrawal?: number
          amount_to_keep?: number
          closed_at?: string | null
          closing_discrepancy_reason?: string | null
          created_at?: string
          expected_closing_balance?: number
          expected_opening_balance?: number
          id?: string
          income_cash?: number
          income_debt?: number
          income_non_cash?: number
          notes?: string | null
          opened_at?: string
          opening_discrepancy_reason?: string | null
          sales_summary?: Json | null
          services_summary?: Json | null
          status?: Database["public"]["Enums"]["shift_status"]
          suggested_withdrawal?: number
          total_revenue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_closing_balance?: number
          actual_opening_balance?: number
          actual_withdrawal?: number
          amount_to_keep?: number
          closed_at?: string | null
          closing_discrepancy_reason?: string | null
          created_at?: string
          expected_closing_balance?: number
          expected_opening_balance?: number
          id?: string
          income_cash?: number
          income_debt?: number
          income_non_cash?: number
          notes?: string | null
          opened_at?: string
          opening_discrepancy_reason?: string | null
          sales_summary?: Json | null
          services_summary?: Json | null
          status?: Database["public"]["Enums"]["shift_status"]
          suggested_withdrawal?: number
          total_revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          email: string
          full_name: string
          id: string
          invited_at: string
          invited_by: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          email: string
          full_name: string
          id?: string
          invited_at?: string
          invited_by: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          email?: string
          full_name?: string
          id?: string
          invited_at?: string
          invited_by?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agent_id: string | null
          client_id: string | null
          completed: boolean
          created_at: string
          description: string | null
          due_date: string
          id: string
          policy_id: string | null
          priority: string
          title: string
          type: string
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          policy_id?: string | null
          priority?: string
          title: string
          type?: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          policy_id?: string | null
          priority?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_list: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          role_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          role_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          role_name?: string
        }
        Relationships: []
      }
      vehicle_registry: {
        Row: {
          brand_id: string | null
          brand_name: string
          color: string | null
          created_at: string
          id: string
          last_customer_id: string | null
          model_name: string | null
          plate_number: string | null
          updated_at: string
          vin_code: string | null
          year: number | null
        }
        Insert: {
          brand_id?: string | null
          brand_name?: string
          color?: string | null
          created_at?: string
          id?: string
          last_customer_id?: string | null
          model_name?: string | null
          plate_number?: string | null
          updated_at?: string
          vin_code?: string | null
          year?: number | null
        }
        Update: {
          brand_id?: string | null
          brand_name?: string
          color?: string | null
          created_at?: string
          id?: string
          last_customer_id?: string | null
          model_name?: string | null
          plate_number?: string | null
          updated_at?: string
          vin_code?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_registry_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "car_brands_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_registry_last_customer_id_fkey"
            columns: ["last_customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_first_admin: {
        Args: {
          _full_name: string
          _org_address?: string
          _org_currency?: string
          _org_inn?: string
          _org_name: string
          _org_timezone?: string
          _user_id: string
        }
        Returns: undefined
      }
      create_chat_room: {
        Args: { p_is_group?: boolean; p_member_ids?: string[]; p_name?: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      normalize_vehicle_number: {
        Args: { vehicle_num: string }
        Returns: string
      }
      track_email_open: { Args: { p_email_id: string }; Returns: undefined }
      update_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "agent" | "viewer"
      insurance_type:
        | "ОСАГО"
        | "КАСКО"
        | "Имущество"
        | "Жизнь"
        | "ДМС"
        | "НС"
        | "ДОМ"
        | "Другое"
      payment_method: "cash" | "card" | "transfer" | "sbp"
      payment_status: "pending" | "paid" | "transferred" | "commission_received"
      policy_status: "active" | "expiring_soon" | "expired" | "renewed"
      sale_status: "draft" | "completed" | "cancelled"
      service_category: "inspection" | "documents" | "other"
      shift_status: "open" | "closed"
      task_priority: "low" | "medium" | "high"
      task_type: "renewal" | "birthday" | "call" | "payment" | "custom"
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
      app_role: ["admin", "agent", "viewer"],
      insurance_type: [
        "ОСАГО",
        "КАСКО",
        "Имущество",
        "Жизнь",
        "ДМС",
        "НС",
        "ДОМ",
        "Другое",
      ],
      payment_method: ["cash", "card", "transfer", "sbp"],
      payment_status: ["pending", "paid", "transferred", "commission_received"],
      policy_status: ["active", "expiring_soon", "expired", "renewed"],
      sale_status: ["draft", "completed", "cancelled"],
      service_category: ["inspection", "documents", "other"],
      shift_status: ["open", "closed"],
      task_priority: ["low", "medium", "high"],
      task_type: ["renewal", "birthday", "call", "payment", "custom"],
    },
  },
} as const
