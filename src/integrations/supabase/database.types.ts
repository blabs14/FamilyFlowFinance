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
      accounts: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string
          deleted_at: string | null
          family_id: string | null
          id: string
          nome: string
          order_index: number | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string | null
          currency?: string
          deleted_at?: string | null
          family_id?: string | null
          id?: string
          nome: string
          order_index?: number | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string
          deleted_at?: string | null
          family_id?: string | null
          id?: string
          nome?: string
          order_index?: number | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          details: Json | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          row_id: string | null
          table_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          row_id?: string | null
          table_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          row_id?: string | null
          table_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount_cents: number
          categoria_id: string
          created_at: string | null
          currency: string
          family_id: string | null
          id: string
          mes: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          categoria_id: string
          created_at?: string | null
          currency?: string
          family_id?: string | null
          id?: string
          mes: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          categoria_id?: string
          created_at?: string | null
          currency?: string
          family_id?: string | null
          id?: string
          mes?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cor: string | null
          created_at: string | null
          family_id: string | null
          icone: string | null
          id: string
          is_system: boolean
          nome: string
          normalized_nome: string | null
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          is_system?: boolean
          nome: string
          normalized_nome?: string | null
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          normalized_nome?: string | null
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      category_customizations: {
        Row: {
          category_id: string
          created_at: string | null
          custom_color: string | null
          custom_icon: string | null
          custom_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          custom_color?: string | null
          custom_icon?: string | null
          custom_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          custom_color?: string | null
          custom_icon?: string | null
          custom_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_customizations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_installments: {
        Row: {
          created_at: string
          credit_card_id: string
          current_installment: number
          id: string
          monthly_cents: number
          num_installments: number
          started_at: string
          total_cents: number
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          credit_card_id: string
          current_installment?: number
          id?: string
          monthly_cents: number
          num_installments: number
          started_at?: string
          total_cents: number
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          credit_card_id?: string
          current_installment?: number
          id?: string
          monthly_cents?: number
          num_installments?: number
          started_at?: string
          total_cents?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_installments_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_detailed"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_statements: {
        Row: {
          closing_date: string
          created_at: string
          credit_card_id: string
          due_date: string
          id: string
          paid_cents: number
          parent_statement_id: string | null
          status: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          closing_date: string
          created_at?: string
          credit_card_id: string
          due_date: string
          id?: string
          paid_cents?: number
          parent_statement_id?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          closing_date?: string
          created_at?: string
          credit_card_id?: string
          due_date?: string
          id?: string
          paid_cents?: number
          parent_statement_id?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_statements_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_statements_parent_statement_id_fkey"
            columns: ["parent_statement_id"]
            isOneToOne: false
            referencedRelation: "credit_card_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          annual_fee_cents: number
          apr: number | null
          closing_day: number | null
          created_at: string
          credit_limit_cents: number
          currency: string
          current_balance_cents: number
          deleted_at: string | null
          family_id: string | null
          id: string
          nome: string
          order_index: number | null
          payment_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_fee_cents?: number
          apr?: number | null
          closing_day?: number | null
          created_at?: string
          credit_limit_cents?: number
          currency?: string
          current_balance_cents?: number
          deleted_at?: string | null
          family_id?: string | null
          id?: string
          nome: string
          order_index?: number | null
          payment_day?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_fee_cents?: number
          apr?: number | null
          closing_day?: number | null
          created_at?: string
          credit_limit_cents?: number
          currency?: string
          current_balance_cents?: number
          deleted_at?: string | null
          family_id?: string | null
          id?: string
          nome?: string
          order_index?: number | null
          payment_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          rate_to_eur: number
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          rate_to_eur?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          rate_to_eur?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      deletion_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      export_audit: {
        Row: {
          count: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          file_path: string | null
          filters: Json
          format: string
          id: number
          size_bytes: number | null
          status: string
          user_id: string
        }
        Insert: {
          count: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          file_path?: string | null
          filters?: Json
          format: string
          id?: number
          size_bytes?: number | null
          status?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          file_path?: string | null
          filters?: Json
          format?: string
          id?: number
          size_bytes?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          nome: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          nome: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          nome?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      family_backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string | null
          created_by: string
          error_message: string | null
          expires_at: string | null
          family_id: string
          file_path: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          status: string
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          error_message?: string | null
          expires_at?: string | null
          family_id: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          status?: string
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          error_message?: string | null
          expires_at?: string | null
          family_id?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_backups_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          family_id: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string | null
          permissions: string[] | null
          role: string
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string | null
          permissions?: string[] | null
          role?: string
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string | null
          permissions?: string[] | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_family_members_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      goal_funding_rules: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          day_of_month: number | null
          enabled: boolean
          fixed_cents: number | null
          goal_id: string
          id: string
          min_amount_cents: number | null
          percent_bp: number | null
          type: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          day_of_month?: number | null
          enabled?: boolean
          fixed_cents?: number | null
          goal_id: string
          id?: string
          min_amount_cents?: number | null
          percent_bp?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          day_of_month?: number | null
          enabled?: boolean
          fixed_cents?: number | null
          goal_id?: string
          id?: string
          min_amount_cents?: number | null
          percent_bp?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_funding_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_funding_rules_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_funding_rules_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_funding_rules_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_ledger: {
        Row: {
          account_id: string | null
          amount_cents: number
          created_at: string
          created_by: string | null
          data: string
          goal_id: string
          id: string
          operation_id: string
          rule_id: string | null
          signed: number
          tipo: string
          transaction_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          created_at?: string
          created_by?: string | null
          data?: string
          goal_id: string
          id?: string
          operation_id?: string
          rule_id?: string | null
          signed: number
          tipo: string
          transaction_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          data?: string
          goal_id?: string
          id?: string
          operation_id?: string
          rule_id?: string | null
          signed?: number
          tipo?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "goal_funding_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_detailed"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          ativa: boolean | null
          created_at: string | null
          family_id: string | null
          id: string
          nome: string
          prazo: string | null
          status: string | null
          target_cents: number
          updated_at: string | null
          user_id: string
          valor_atual: number | null
          valor_meta: number | null
        }
        Insert: {
          account_id?: string | null
          ativa?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          nome: string
          prazo?: string | null
          status?: string | null
          target_cents?: number
          updated_at?: string | null
          user_id: string
          valor_atual?: number | null
          valor_meta?: number | null
        }
        Update: {
          account_id?: string | null
          ativa?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          nome?: string
          prazo?: string | null
          status?: string | null
          target_cents?: number
          updated_at?: string | null
          user_id?: string
          valor_atual?: number | null
          valor_meta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotent_ops: {
        Row: {
          created_at: string | null
          id: string
          operation_data: Json | null
          operation_key: string
          operation_type: string
          result: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          operation_data?: Json | null
          operation_key: string
          operation_type: string
          result?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          operation_data?: Json | null
          operation_key?: string
          operation_type?: string
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      import_profiles: {
        Row: {
          bank_name: string
          created_at: string
          id: string
          mapping_json: Json
          sample_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name: string
          created_at?: string
          id?: string
          mapping_json: Json
          sample_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          id?: string
          mapping_json?: Json
          sample_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ingestion_files: {
        Row: {
          created_at: string
          id: string
          job_id: string
          mime_type: string | null
          ocr_json: Json | null
          original_filename: string | null
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          mime_type?: string | null
          ocr_json?: Json | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          mime_type?: string | null
          ocr_json?: Json | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_ingestion_job_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          error: string | null
          family_id: string | null
          finished_at: string | null
          id: string
          scope: string
          source: string
          started_at: string | null
          stats_json: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          error?: string | null
          family_id?: string | null
          finished_at?: string | null
          id?: string
          scope: string
          source: string
          started_at?: string | null
          stats_json?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          error?: string | null
          family_id?: string | null
          finished_at?: string | null
          id?: string
          scope?: string
          source?: string
          started_at?: string | null
          stats_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_tables: {
        Row: {
          created_at: string | null
          domain: string
          effective_from: string
          effective_to: string | null
          id: string
          payload: Json
          region: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          domain: string
          effective_from: string
          effective_to?: string | null
          id?: string
          payload: Json
          region?: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          domain?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          payload?: Json
          region?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string | null
          family_id: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_bonus_configs: {
        Row: {
          bonus_type: string
          config_data: Json
          contract_id: string
          created_at: string | null
          family_id: string | null
          id: string
          is_active: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bonus_type: string
          config_data?: Json
          contract_id: string
          created_at?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bonus_type?: string
          config_data?: Json
          contract_id?: string
          created_at?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_bonus_configs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_contracts: {
        Row: {
          auto_deductions_enabled: boolean
          base_salary_cents: number
          category_location_config: Json | null
          christmas_bonus_mode: string
          created_at: string | null
          currency: string
          duration: number | null
          has_probation_period: boolean | null
          hourly_rate_cents: number | null
          id: string
          is_active: boolean | null
          job_category: string | null
          name: string
          notices_config: Json | null
          probation_config: Json | null
          probation_duration_days: number | null
          schedule_config: Json | null
          schedule_json: Json
          training_config: Json | null
          updated_at: string | null
          user_id: string
          vacation_bonus_mode: string
          weekly_hours: number | null
          workplace_location: string | null
        }
        Insert: {
          auto_deductions_enabled?: boolean
          base_salary_cents: number
          category_location_config?: Json | null
          christmas_bonus_mode?: string
          created_at?: string | null
          currency?: string
          duration?: number | null
          has_probation_period?: boolean | null
          hourly_rate_cents?: number | null
          id?: string
          is_active?: boolean | null
          job_category?: string | null
          name: string
          notices_config?: Json | null
          probation_config?: Json | null
          probation_duration_days?: number | null
          schedule_config?: Json | null
          schedule_json: Json
          training_config?: Json | null
          updated_at?: string | null
          user_id: string
          vacation_bonus_mode?: string
          weekly_hours?: number | null
          workplace_location?: string | null
        }
        Update: {
          auto_deductions_enabled?: boolean
          base_salary_cents?: number
          category_location_config?: Json | null
          christmas_bonus_mode?: string
          created_at?: string | null
          currency?: string
          duration?: number | null
          has_probation_period?: boolean | null
          hourly_rate_cents?: number | null
          id?: string
          is_active?: boolean | null
          job_category?: string | null
          name?: string
          notices_config?: Json | null
          probation_config?: Json | null
          probation_duration_days?: number | null
          schedule_config?: Json | null
          schedule_json?: Json
          training_config?: Json | null
          updated_at?: string | null
          user_id?: string
          vacation_bonus_mode?: string
          weekly_hours?: number | null
          workplace_location?: string | null
        }
        Relationships: []
      }
      payroll_custom_bonuses: {
        Row: {
          amount: number
          contract_id: string
          created_at: string | null
          description: string | null
          family_id: string | null
          id: string
          is_active: boolean
          is_percentage: boolean
          is_taxable: boolean
          name: string
          payment_frequency: string
          requires_approval: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          is_percentage?: boolean
          is_taxable?: boolean
          name: string
          payment_frequency?: string
          requires_approval?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          is_percentage?: boolean
          is_taxable?: boolean
          name?: string
          payment_frequency?: string
          requires_approval?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_custom_bonuses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_custom_bonuses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_deduction_conditions: {
        Row: {
          adse_rate: number
          auto_calculation_enabled: boolean
          contract_id: string
          created_at: string | null
          dependents: number
          disability_dependents: boolean
          disability_worker: boolean
          duodecimos: boolean
          has_adse: boolean
          id: string
          income_holders: string
          marital_status: string
          meal_method: string
          overtime_rule: string
          region: string
          residency: string
          taxation_mode: string | null
          union_rate: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          adse_rate?: number
          auto_calculation_enabled?: boolean
          contract_id: string
          created_at?: string | null
          dependents?: number
          disability_dependents?: boolean
          disability_worker?: boolean
          duodecimos?: boolean
          has_adse?: boolean
          id?: string
          income_holders?: string
          marital_status?: string
          meal_method?: string
          overtime_rule?: string
          region?: string
          residency?: string
          taxation_mode?: string | null
          union_rate?: number
          updated_at?: string | null
          user_id: string
          year?: number
        }
        Update: {
          adse_rate?: number
          auto_calculation_enabled?: boolean
          contract_id?: string
          created_at?: string | null
          dependents?: number
          disability_dependents?: boolean
          disability_worker?: boolean
          duodecimos?: boolean
          has_adse?: boolean
          id?: string
          income_holders?: string
          marital_status?: string
          meal_method?: string
          overtime_rule?: string
          region?: string
          residency?: string
          taxation_mode?: string | null
          union_rate?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deduction_conditions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_deduction_configs: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          irs_percentage: number
          social_security_percentage: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          irs_percentage?: number
          social_security_percentage?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          irs_percentage?: number
          social_security_percentage?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deduction_configs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_holidays: {
        Row: {
          affects_overtime: boolean | null
          contract_id: string
          country_code: string | null
          created_at: string | null
          date: string
          description: string | null
          family_id: string | null
          holiday_type: string | null
          id: string
          is_automatic: boolean | null
          is_paid: boolean | null
          is_recurring: boolean | null
          name: string
          region_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          affects_overtime?: boolean | null
          contract_id: string
          country_code?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          family_id?: string | null
          holiday_type?: string | null
          id?: string
          is_automatic?: boolean | null
          is_paid?: boolean | null
          is_recurring?: boolean | null
          name: string
          region_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          affects_overtime?: boolean | null
          contract_id?: string
          country_code?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          family_id?: string | null
          holiday_type?: string | null
          id?: string
          is_automatic?: boolean | null
          is_paid?: boolean | null
          is_recurring?: boolean | null
          name?: string
          region_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_holidays_contract"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_holidays_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          amount_cents: number
          created_at: string | null
          description: string
          family_id: string | null
          id: string
          kind: string
          period_id: string
          quantity: number | null
          rate_cents: number | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          description: string
          family_id?: string | null
          id?: string
          kind: string
          period_id: string
          quantity?: number | null
          rate_cents?: number | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          description?: string
          family_id?: string | null
          id?: string
          kind?: string
          period_id?: string
          quantity?: number | null
          rate_cents?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contract_id: string
          created_at: string | null
          employee_name: string
          end_date: string
          id: string
          leave_type: string
          medical_certificate: boolean | null
          notes: string | null
          paid_days: number
          percentage_paid: number
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          supporting_documents: Json | null
          total_days: number
          unpaid_days: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id: string
          created_at?: string | null
          employee_name: string
          end_date: string
          id?: string
          leave_type: string
          medical_certificate?: boolean | null
          notes?: string | null
          paid_days?: number
          percentage_paid?: number
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          supporting_documents?: Json | null
          total_days: number
          unpaid_days?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id?: string
          created_at?: string | null
          employee_name?: string
          end_date?: string
          id?: string
          leave_type?: string
          medical_certificate?: boolean | null
          notes?: string | null
          paid_days?: number
          percentage_paid?: number
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          supporting_documents?: Json | null
          total_days?: number
          unpaid_days?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_leaves_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_meal_allowance_configs: {
        Row: {
          contract_id: string
          created_at: string | null
          daily_amount_cents: number | null
          duodecimos_enabled: boolean | null
          excluded_months: number[] | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["meal_allowance_payment_method"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          daily_amount_cents?: number | null
          duodecimos_enabled?: boolean | null
          excluded_months?: number[] | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["meal_allowance_payment_method"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          daily_amount_cents?: number | null
          duodecimos_enabled?: boolean | null
          excluded_months?: number[] | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["meal_allowance_payment_method"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_meal_allowance_configs_contract_id"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_mileage_policies: {
        Row: {
          contract_id: string | null
          created_at: string | null
          family_id: string | null
          id: string
          is_active: boolean | null
          monthly_cap_cents: number | null
          name: string
          rate_cents_per_km: number
          requires_origin_destination: boolean | null
          requires_purpose: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean | null
          monthly_cap_cents?: number | null
          name: string
          rate_cents_per_km: number
          requires_origin_destination?: boolean | null
          requires_purpose?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean | null
          monthly_cap_cents?: number | null
          name?: string
          rate_cents_per_km?: number
          requires_origin_destination?: boolean | null
          requires_purpose?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_mileage_policies_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_mileage_trips: {
        Row: {
          attachment_path: string | null
          contract_id: string | null
          created_at: string | null
          date: string
          dedupe_hash: string | null
          destination: string | null
          family_id: string | null
          id: string
          km: number
          notes: string | null
          origin: string | null
          policy_id: string
          purpose: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          contract_id?: string | null
          created_at?: string | null
          date: string
          dedupe_hash?: string | null
          destination?: string | null
          family_id?: string | null
          id?: string
          km: number
          notes?: string | null
          origin?: string | null
          policy_id: string
          purpose?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          contract_id?: string | null
          created_at?: string | null
          date?: string
          dedupe_hash?: string | null
          destination?: string | null
          family_id?: string | null
          id?: string
          km?: number
          notes?: string | null
          origin?: string | null
          policy_id?: string
          purpose?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_mileage_trips_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_mileage_trips_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "payroll_mileage_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_ot_policies: {
        Row: {
          annual_limit_hours: number | null
          contract_id: string
          created_at: string | null
          daily_limit_hours: number | null
          day_multiplier: number
          family_id: string | null
          holiday_multiplier: number
          id: string
          is_active: boolean | null
          multiplier: number
          name: string
          night_end: string
          night_multiplier: number
          night_start: string
          rounding_minutes: number
          threshold_hours: number
          updated_at: string | null
          user_id: string
          weekend_multiplier: number
          weekly_limit_hours: number | null
        }
        Insert: {
          annual_limit_hours?: number | null
          contract_id: string
          created_at?: string | null
          daily_limit_hours?: number | null
          day_multiplier?: number
          family_id?: string | null
          holiday_multiplier?: number
          id?: string
          is_active?: boolean | null
          multiplier?: number
          name: string
          night_end?: string
          night_multiplier?: number
          night_start?: string
          rounding_minutes?: number
          threshold_hours?: number
          updated_at?: string | null
          user_id: string
          weekend_multiplier?: number
          weekly_limit_hours?: number | null
        }
        Update: {
          annual_limit_hours?: number | null
          contract_id?: string
          created_at?: string | null
          daily_limit_hours?: number | null
          day_multiplier?: number
          family_id?: string | null
          holiday_multiplier?: number
          id?: string
          is_active?: boolean | null
          multiplier?: number
          name?: string
          night_end?: string
          night_multiplier?: number
          night_start?: string
          rounding_minutes?: number
          threshold_hours?: number
          updated_at?: string | null
          user_id?: string
          weekend_multiplier?: number
          weekly_limit_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_ot_policies_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payslips: {
        Row: {
          christmas_bonus_cents: number | null
          created_at: string | null
          family_id: string | null
          file_path: string | null
          gross_cents: number | null
          id: string
          irs_deduction_cents: number | null
          meal_allowance_cents: number | null
          net_cents: number | null
          notes: string | null
          other_allowances_cents: number | null
          other_deductions_cents: number | null
          period_id: string
          ss_deduction_cents: number | null
          updated_at: string | null
          user_id: string
          vacation_bonus_cents: number | null
        }
        Insert: {
          christmas_bonus_cents?: number | null
          created_at?: string | null
          family_id?: string | null
          file_path?: string | null
          gross_cents?: number | null
          id?: string
          irs_deduction_cents?: number | null
          meal_allowance_cents?: number | null
          net_cents?: number | null
          notes?: string | null
          other_allowances_cents?: number | null
          other_deductions_cents?: number | null
          period_id: string
          ss_deduction_cents?: number | null
          updated_at?: string | null
          user_id: string
          vacation_bonus_cents?: number | null
        }
        Update: {
          christmas_bonus_cents?: number | null
          created_at?: string | null
          family_id?: string | null
          file_path?: string | null
          gross_cents?: number | null
          id?: string
          irs_deduction_cents?: number | null
          meal_allowance_cents?: number | null
          net_cents?: number | null
          notes?: string | null
          other_allowances_cents?: number | null
          other_deductions_cents?: number | null
          period_id?: string
          ss_deduction_cents?: number | null
          updated_at?: string | null
          user_id?: string
          vacation_bonus_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payslips_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          contract_id: string
          created_at: string | null
          family_id: string | null
          gross_cents: number
          id: string
          month: number
          net_expected_cents: number
          period_key: string
          planned_minutes: number
          recalculated_at: string | null
          updated_at: string | null
          user_id: string
          worked_minutes: number
          year: number
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          family_id?: string | null
          gross_cents: number
          id?: string
          month: number
          net_expected_cents: number
          period_key: string
          planned_minutes: number
          recalculated_at?: string | null
          updated_at?: string | null
          user_id: string
          worked_minutes: number
          year: number
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          family_id?: string | null
          gross_cents?: number
          id?: string
          month?: number
          net_expected_cents?: number
          period_key?: string
          planned_minutes?: number
          recalculated_at?: string | null
          updated_at?: string | null
          user_id?: string
          worked_minutes?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_time_entries: {
        Row: {
          break_minutes: number | null
          contract_id: string
          created_at: string | null
          date: string
          dedupe_hash: string | null
          description: string | null
          end_time: string
          family_id: string | null
          id: string
          is_exception: boolean | null
          is_holiday: boolean | null
          is_overtime: boolean | null
          is_sick: boolean | null
          is_vacation: boolean | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          break_minutes?: number | null
          contract_id: string
          created_at?: string | null
          date: string
          dedupe_hash?: string | null
          description?: string | null
          end_time: string
          family_id?: string | null
          id?: string
          is_exception?: boolean | null
          is_holiday?: boolean | null
          is_overtime?: boolean | null
          is_sick?: boolean | null
          is_vacation?: boolean | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          break_minutes?: number | null
          contract_id?: string
          created_at?: string | null
          date?: string
          dedupe_hash?: string | null
          description?: string | null
          end_time?: string
          family_id?: string | null
          id?: string
          is_exception?: boolean | null
          is_holiday?: boolean | null
          is_overtime?: boolean | null
          is_sick?: boolean | null
          is_vacation?: boolean | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_time_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_vacations: {
        Row: {
          contract_id: string
          created_at: string | null
          days_count: number
          description: string | null
          end_date: string
          id: string
          is_approved: boolean | null
          start_date: string
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          days_count: number
          description?: string | null
          end_date: string
          id?: string
          is_approved?: boolean | null
          start_date: string
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          days_count?: number
          description?: string | null
          end_date?: string
          id?: string
          is_approved?: boolean | null
          start_date?: string
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_vacations_contract_id"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_bonus_configs: {
        Row: {
          bonus_name: string
          bonus_type: string
          bonus_value: number
          contract_id: string | null
          created_at: string | null
          evaluation_period: string
          id: string
          is_active: boolean | null
          max_bonus_amount: number | null
          metric_type: string
          threshold_operator: string
          threshold_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bonus_name: string
          bonus_type: string
          bonus_value: number
          contract_id?: string | null
          created_at?: string | null
          evaluation_period: string
          id?: string
          is_active?: boolean | null
          max_bonus_amount?: number | null
          metric_type: string
          threshold_operator: string
          threshold_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bonus_name?: string
          bonus_type?: string
          bonus_value?: number
          contract_id?: string | null
          created_at?: string | null
          evaluation_period?: string
          id?: string
          is_active?: boolean | null
          max_bonus_amount?: number | null
          metric_type?: string
          threshold_operator?: string
          threshold_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_bonus_configs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_bonus_results: {
        Row: {
          applied_at: string | null
          applied_bonus_amount: number
          calculated_bonus_amount: number
          calculation_details: Json | null
          config_id: string
          contract_id: string | null
          created_at: string | null
          evaluation_period_end: string
          evaluation_period_start: string
          id: string
          metric_value: number
          status: string
          threshold_met: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          applied_bonus_amount?: number
          calculated_bonus_amount?: number
          calculation_details?: Json | null
          config_id: string
          contract_id?: string | null
          created_at?: string | null
          evaluation_period_end: string
          evaluation_period_start: string
          id?: string
          metric_value: number
          status?: string
          threshold_met: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          applied_bonus_amount?: number
          calculated_bonus_amount?: number
          calculation_details?: Json | null
          config_id?: string
          contract_id?: string | null
          created_at?: string | null
          evaluation_period_end?: string
          evaluation_period_start?: string
          id?: string
          metric_value?: number
          status?: string
          threshold_met?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_bonus_results_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "performance_bonus_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_bonus_results_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "payroll_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string | null
          first_name: string | null
          foto_url: string | null
          id: string
          last_name: string | null
          nome: string
          percentual_divisao: number | null
          personal_settings: Json | null
          phone: string | null
          poupanca_mensal: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          foto_url?: string | null
          id?: string
          last_name?: string | null
          nome: string
          percentual_divisao?: number | null
          personal_settings?: Json | null
          phone?: string | null
          poupanca_mensal?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          foto_url?: string | null
          id?: string
          last_name?: string | null
          nome?: string
          percentual_divisao?: number | null
          personal_settings?: Json | null
          phone?: string | null
          poupanca_mensal?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          currency: string | null
          date: string | null
          file_id: string | null
          id: string
          job_id: string | null
          ocr_json: Json | null
          storage_path: string
          tax_cents: number | null
          total_cents: number | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          date?: string | null
          file_id?: string | null
          id?: string
          job_id?: string | null
          ocr_json?: Json | null
          storage_path: string
          tax_cents?: number | null
          total_cents?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          date?: string | null
          file_id?: string | null
          id?: string
          job_id?: string | null
          ocr_json?: Json | null
          storage_path?: string
          tax_cents?: number | null
          total_cents?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "ingestion_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_ingestion_job_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      recurring_instances: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          due_date: string
          id: string
          period_key: string
          rule_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          due_date: string
          id?: string
          period_key: string
          rule_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          period_key?: string
          rule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_instances_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "_rr_rules_for_user"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "recurring_instances_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount_cents: number
          cancel_at_period_end: boolean | null
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          family_id: string | null
          id: string
          interval_count: number
          interval_unit: string
          is_subscription: boolean
          last_run_date: string | null
          metadata: Json | null
          next_run_date: string
          payee: string | null
          payment_method: string | null
          scope: string
          start_date: string
          status: string
          trial_end_date: string | null
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          cancel_at_period_end?: boolean | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          family_id?: string | null
          id?: string
          interval_count?: number
          interval_unit: string
          is_subscription?: boolean
          last_run_date?: string | null
          metadata?: Json | null
          next_run_date: string
          payee?: string | null
          payment_method?: string | null
          scope: string
          start_date: string
          status?: string
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          cancel_at_period_end?: boolean | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          family_id?: string | null
          id?: string
          interval_count?: number
          interval_unit?: string
          is_subscription?: boolean
          last_run_date?: string | null
          metadata?: Json | null
          next_run_date?: string
          payee?: string | null
          payment_method?: string | null
          scope?: string
          start_date?: string
          status?: string
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          data: string | null
          date: string
          description: string | null
          family_id: string | null
          id: string
          recurring: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string | null
          date: string
          description?: string | null
          family_id?: string | null
          id?: string
          recurring?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string | null
          date?: string
          description?: string | null
          family_id?: string | null
          id?: string
          recurring?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          id: string
          layout: Json
          name: string
          styling: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          layout?: Json
          name: string
          styling?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          layout?: Json
          name?: string
          styling?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_exports: {
        Row: {
          active: boolean | null
          created_at: string | null
          day_of_month: number | null
          day_of_week: number | null
          email: string
          id: string
          last_run: string | null
          name: string
          next_run: string | null
          options: Json
          schedule: string
          time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          email: string
          id?: string
          last_run?: string | null
          name: string
          next_run?: string | null
          options: Json
          schedule: string
          time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          email?: string
          id?: string
          last_run?: string | null
          name?: string
          next_run?: string | null
          options?: Json
          schedule?: string
          time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staging_transactions: {
        Row: {
          created_at: string
          dedupe_status: string
          hash: string
          id: string
          job_id: string
          normalized_json: Json
          posted_txn_id: string | null
          raw_json: Json
          row_index: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedupe_status?: string
          hash: string
          id?: string
          job_id: string
          normalized_json: Json
          posted_txn_id?: string | null
          raw_json: Json
          row_index?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedupe_status?: string
          hash?: string
          id?: string
          job_id?: string
          normalized_json?: Json
          posted_txn_id?: string | null
          raw_json?: Json
          row_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staging_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_ingestion_job_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      subsidy_configs: {
        Row: {
          advance_percentage: number | null
          contract_id: string
          created_at: string | null
          enabled: boolean
          id: string
          payment_method: string
          payment_month: number | null
          proportional_calculation: boolean | null
          reference_salary_months: number | null
          type: string
          updated_at: string | null
          user_id: string
          vacation_days_entitled: number | null
          vacation_days_taken: number | null
        }
        Insert: {
          advance_percentage?: number | null
          contract_id: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          payment_method: string
          payment_month?: number | null
          proportional_calculation?: boolean | null
          reference_salary_months?: number | null
          type: string
          updated_at?: string | null
          user_id: string
          vacation_days_entitled?: number | null
          vacation_days_taken?: number | null
        }
        Update: {
          advance_percentage?: number | null
          contract_id?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          payment_method?: string
          payment_month?: number | null
          proportional_calculation?: boolean | null
          reference_salary_months?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
          vacation_days_entitled?: number | null
          vacation_days_taken?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number
          categoria_id: string
          created_at: string | null
          credit_card_id: string | null
          currency: string
          data: string
          descricao: string | null
          event_time: string
          family_id: string | null
          goal_id: string | null
          id: string
          operation_id: string | null
          reversal_of: string | null
          tipo: string
          transfer_group_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents?: number
          categoria_id: string
          created_at?: string | null
          credit_card_id?: string | null
          currency?: string
          data: string
          descricao?: string | null
          event_time?: string
          family_id?: string | null
          goal_id?: string | null
          id?: string
          operation_id?: string | null
          reversal_of?: string | null
          tipo: string
          transfer_group_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          categoria_id?: string
          created_at?: string | null
          credit_card_id?: string | null
          currency?: string
          data?: string
          descricao?: string | null
          event_time?: string
          family_id?: string | null
          goal_id?: string | null
          id?: string
          operation_id?: string | null
          reversal_of?: string | null
          tipo?: string
          transfer_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "transactions_detailed"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          currency: string
          display_name: string
          id: string
          preferences: Json
          risk_per_trade: number | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          preferences?: Json
          risk_per_trade?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          preferences?: Json
          risk_per_trade?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      _rr_rules_for_user: {
        Row: {
          rule_id: string | null
        }
        Insert: {
          rule_id?: string | null
        }
        Update: {
          rule_id?: string | null
        }
        Relationships: []
      }
      account_balances: {
        Row: {
          account_id: string | null
          family_id: string | null
          nome: string | null
          saldo_atual: number | null
          tipo: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_balances_v1: {
        Row: {
          account_id: string | null
          disponivel: number | null
          family_id: string | null
          is_in_debt: boolean | null
          nome: string | null
          reservado: number | null
          reservado_final: number | null
          saldo_atual: number | null
          tipo: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_reserved: {
        Row: {
          account_id: string | null
          total_reservado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_progress: {
        Row: {
          budget_id: string | null
          categoria_cor: string | null
          categoria_id: string | null
          categoria_nome: string | null
          mes: string | null
          progresso_percentual: number | null
          user_id: string | null
          valor_gasto: number | null
          valor_orcamento: number | null
          valor_restante: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members_with_profile: {
        Row: {
          family_id: string | null
          id: string | null
          joined_at: string | null
          permissions: string[] | null
          profile_nome: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_family_members_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          id: string | null
          nome: string | null
          progresso_percentual: number | null
          status_objetivo: string | null
          total_alocado_historico: number | null
          total_alocado_real: number | null
          user_id: string | null
          valor_objetivo: number | null
        }
        Relationships: []
      }
      goals_with_balance: {
        Row: {
          account_id: string | null
          ativa: boolean | null
          created_at: string | null
          family_id: string | null
          id: string | null
          nome: string | null
          prazo: string | null
          status: string | null
          target_cents: number | null
          updated_at: string | null
          user_id: string | null
          valor_atual: number | null
          valor_atual_cents: number | null
          valor_meta: number | null
          valor_objetivo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_detailed: {
        Row: {
          account_id: string | null
          account_nome: string | null
          account_tipo: string | null
          amount_cents: number | null
          categoria_cor: string | null
          categoria_nome: string | null
          created_at: string | null
          data: string | null
          descricao: string | null
          family_id: string | null
          family_nome: string | null
          goal_id: string | null
          goal_nome: string | null
          id: string | null
          tipo: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ingestion_job_summary: {
        Row: {
          duplicate: number | null
          job_id: string | null
          posted: number | null
          total: number | null
          unique: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _drop_policy_if_exists: {
        Args: { p_policy: string; p_table: unknown }
        Returns: undefined
      }
      _is_family_context: { Args: { p_family_id: string }; Returns: boolean }
      _is_personal_context: { Args: { p_family_id: string }; Returns: boolean }
      _rr_advance_next: {
        Args: { p_count: number; p_date: string; p_unit: string }
        Returns: string
      }
      _rr_can_edit: {
        Args: { r: Database["public"]["Tables"]["recurring_rules"]["Row"] }
        Returns: boolean
      }
      accept_family_invite: { Args: { invite_token: string }; Returns: Json }
      accept_family_invite_by_email: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      allocate_to_goal: {
        Args: {
          p_account_id: string
          p_amount: number
          p_goal_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      allocate_to_goal_with_transaction: {
        Args: {
          account_id_param: string
          amount_param: number
          description_param?: string
          goal_id_param: string
          user_id_param: string
        }
        Returns: Json
      }
      apply_fixed_monthly_contributions: {
        Args: { p_date?: string }
        Returns: number
      }
      cancel_family_invite: { Args: { p_invite_id: string }; Returns: Json }
      cc_tx_v1: {
        Args: {
          p_account_id: string
          p_categoria_id: string
          p_data: string
          p_descricao?: string
          p_goal_id?: string
          p_tipo: string
          p_user_id: string
          p_valor: number
        }
        Returns: string
      }
      cleanup_all_old_transfer_transactions: { Args: never; Returns: Json }
      cleanup_expired_backups: { Args: never; Returns: number }
      cleanup_old_transfer_transactions: { Args: never; Returns: Json }
      cleanup_unused_indexes: {
        Args: never
        Returns: {
          index_name: string
          index_size: string
          last_scan_days: number
          table_name: string
        }[]
      }
      create_family_backup: {
        Args: { p_backup_type?: string; p_family_id: string; p_metadata?: Json }
        Returns: Json
      }
      create_family_direct: {
        Args: { p_family_name: string; p_user_id: string }
        Returns: string
      }
      create_family_notification: {
        Args: {
          p_category?: string
          p_family_id: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_family_with_member:
        | {
            Args: { p_description?: string; p_family_name: string }
            Returns: Json
          }
        | {
            Args: {
              p_description: string
              p_family_name: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_description?: string
              p_family_name: string
              p_user_id: string
            }
            Returns: Json
          }
      create_regular_transaction: {
        Args: {
          p_account_id: string
          p_categoria_id: string
          p_data: string
          p_descricao: string
          p_goal_id?: string
          p_tipo: string
          p_user_id: string
          p_valor: number
        }
        Returns: Json
      }
      create_system_notification: {
        Args: {
          p_category?: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: {
          category: string
          created_at: string
          family_id: string
          id: string
          message: string
          metadata: Json
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      create_transfer_transaction: {
        Args: {
          p_amount: number
          p_categoria_id: string
          p_data: string
          p_description: string
          p_from_account_id: string
          p_to_account_id: string
          p_user_id: string
        }
        Returns: Json
      }
      deallocate_from_goal_with_transaction: {
        Args: {
          account_id_param: string
          amount_param: number
          goal_id_param: string
          user_id_param?: string
        }
        Returns: Json
      }
      delete_account_with_related_data: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: Json
      }
      delete_family_with_cascade: {
        Args: { p_family_id: string }
        Returns: Json
      }
      delete_goal_with_restoration:
        | {
            Args: { goal_id_param: string; user_id_param: string }
            Returns: Json
          }
        | {
            Args: {
              goal_id_param: string
              idempotency_key: string
              user_id_param: string
            }
            Returns: Json
          }
      ensure_category_for_user: {
        Args: { p_color?: string; p_name: string; p_user_id: string }
        Returns: string
      }
      ensure_goals_account: {
        Args: { p_family_id?: string; p_user_id?: string }
        Returns: string
      }
      fn_goal_deallocate: {
        Args: {
          amount_param: number
          description_param?: string
          destination_account_id_param: string
          force_param?: boolean
          goal_id_param: string
          transaction_date_param?: string
          user_id_param: string
        }
        Returns: Json
      }
      fn_goal_delete_with_correct_logic: {
        Args: {
          destination_account_id_param?: string
          goal_id_param: string
          idempotency_key?: string
          user_id_param: string
        }
        Returns: Json
      }
      get_accounts_with_balances: {
        Args: { p_family_id?: string; p_scope?: string }
        Returns: {
          account_id: string
          disponivel: number
          family_id: string
          is_in_debt: boolean
          nome: string
          reservado: number
          saldo_atual: number
          tipo: string
          user_id: string
        }[]
      }
      get_credit_card_summary:
        | {
            Args: { p_account_id: string }
            Returns: {
              ciclo_inicio: string
              saldo: number
              status: string
              total_gastos: number
              total_pagamentos: number
            }[]
          }
        | { Args: { p_account_id: string; p_user_id: string }; Returns: Json }
      get_current_user_id: { Args: never; Returns: string }
      get_dashboard_data: {
        Args: { user_id_param: string }
        Returns: {
          total_contas: number
          total_reservado_objetivos: number
          total_saldo_contas: number
          total_saldo_disponivel: number
        }[]
      }
      get_family_accounts_with_balances: {
        Args: { p_user_id: string }
        Returns: {
          account_id: string
          family_id: string
          nome: string
          saldo_atual: number
          saldo_disponivel: number
          tipo: string
          total_reservado: number
          user_id: string
        }[]
      }
      get_family_backup_stats: { Args: { p_family_id: string }; Returns: Json }
      get_family_budgets: {
        Args: { p_user_id: string }
        Returns: {
          amount_cents: number
          categoria_id: string
          created_at: string | null
          currency: string
          family_id: string | null
          id: string
          mes: string
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "budgets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_family_category_breakdown: {
        Args: {
          p_date_end: string
          p_date_start: string
          p_family_id: string
          p_kind?: string
        }
        Returns: {
          category_id: string
          category_name: string
          percentage: number
          total: number
        }[]
      }
      get_family_data_by_id: { Args: { p_family_id: string }; Returns: Json }
      get_family_financial_summary: {
        Args: { family_id_param: string; user_id_param: string }
        Returns: {
          total_contas: number
          total_reservado_objetivos: number
          total_saldo_contas: number
          total_saldo_disponivel: number
        }[]
      }
      get_family_goals: {
        Args: { p_user_id: string }
        Returns: {
          ativa: boolean
          created_at: string
          family_id: string
          id: string
          nome: string
          prazo: string
          progresso_percentual: number
          total_alocado: number
          updated_at: string
          user_id: string
          valor_atual: number
          valor_objetivo: number
        }[]
      }
      get_family_kpis:
        | {
            Args: never
            Returns: {
              credit_card_debt: number
              goals_account_balance: number
              goals_progress_percentage: number
              monthly_savings: number
              pending_invites: number
              top_goal_progress: number
              total_balance: number
              total_goals_value: number
              total_members: number
            }[]
          }
        | {
            Args: {
              p_date_end: string
              p_date_start: string
              p_exclude_transfers?: boolean
              p_family_id: string
            }
            Returns: {
              budget_spent_percentage: number
              credit_card_debt: number
              delta_vs_prev: number
              goals_account_balance: number
              goals_progress_percentage: number
              monthly_savings: number
              overspent_budget_ids: string[]
              overspent_budgets_count: number
              pending_invites: number
              prev_month_savings: number
              top_goal_progress: number
              total_balance: number
              total_budget_amount: number
              total_budget_spent: number
              total_goals_value: number
              total_members: number
            }[]
          }
      get_family_kpis_with_user: {
        Args: { p_user_id: string }
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          pending_invites: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
          total_members: number
        }[]
      }
      get_family_members_simple: {
        Args: { p_family_id: string }
        Returns: Json
      }
      get_family_members_test: { Args: { p_family_id: string }; Returns: Json }
      get_family_members_with_profiles: {
        Args: { p_family_id: string }
        Returns: Json
      }
      get_family_pending_invites: {
        Args: { p_family_id: string }
        Returns: Json
      }
      get_family_statistics: { Args: { p_family_id: string }; Returns: Json }
      get_family_transactions: {
        Args: never
        Returns: {
          account_id: string
          amount_cents: number
          categoria_id: string
          created_at: string | null
          credit_card_id: string | null
          currency: string
          data: string
          descricao: string | null
          event_time: string
          family_id: string | null
          goal_id: string | null
          id: string
          operation_id: string | null
          reversal_of: string | null
          tipo: string
          transfer_group_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_goals_account_id:
        | { Args: { p_user_id: string }; Returns: string }
        | {
            Args: { family_id_param: string; user_id_param: string }
            Returns: string
          }
      get_index_usage_stats: {
        Args: never
        Returns: {
          index_name: string
          index_scans: number
          index_size: string
          index_tuples_fetched: number
          index_tuples_read: number
          table_name: string
        }[]
      }
      get_personal_accounts_with_balances: {
        Args: { p_user_id?: string }
        Returns: {
          created_at: string
          family_id: string
          id: string
          nome: string
          saldo: number
          saldo_atual: number
          saldo_disponivel: number
          tipo: string
          total_reservado: number
          user_id: string
        }[]
      }
      get_personal_budgets: {
        Args: never
        Returns: {
          categoria_cor: string
          categoria_id: string
          categoria_nome: string
          id: string
          mes: string
          progresso_percentual: number
          user_id: string
          valor_gasto: number
          valor_orcamento: number
          valor_restante: number
        }[]
      }
      get_personal_financial_summary: {
        Args: { user_id_param: string }
        Returns: {
          total_contas: number
          total_reservado_objetivos: number
          total_saldo_contas: number
          total_saldo_disponivel: number
        }[]
      }
      get_personal_goals: {
        Args: { p_user_id?: string }
        Returns: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          prazo: string
          progresso_percentual: number
          total_alocado: number
          updated_at: string
          user_id: string
          valor_atual: number
          valor_objetivo: number
        }[]
      }
      get_personal_kpis: {
        Args: never
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
        }[]
      }
      get_personal_kpis_debug: {
        Args: never
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
        }[]
      }
      get_personal_kpis_test: {
        Args: { p_user_id: string }
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
        }[]
      }
      get_personal_kpis_test_fixed: {
        Args: { p_user_id: string }
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
        }[]
      }
      get_personal_kpis_with_user: {
        Args: { p_user_id: string }
        Returns: {
          budget_spent_percentage: number
          credit_card_debt: number
          goals_account_balance: number
          goals_progress_percentage: number
          monthly_savings: number
          top_goal_progress: number
          total_balance: number
          total_budget_amount: number
          total_budget_spent: number
          total_goals_value: number
        }[]
      }
      get_personal_transactions: {
        Args: never
        Returns: {
          account_id: string
          amount_cents: number
          categoria_id: string
          created_at: string | null
          credit_card_id: string | null
          currency: string
          data: string
          descricao: string | null
          event_time: string
          family_id: string | null
          goal_id: string | null
          id: string
          operation_id: string | null
          reversal_of: string | null
          tipo: string
          transfer_group_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_personal_transactions_fast: {
        Args: never
        Returns: {
          account_id: string
          categoria_id: string
          created_at: string
          data: string
          descricao: string
          family_id: string
          goal_id: string
          id: string
          tipo: string
          user_id: string
          valor: number
        }[]
      }
      get_user_account_balances: {
        Args: never
        Returns: {
          account_id: string
          saldo_atual: number
        }[]
      }
      get_user_account_reserved: {
        Args: never
        Returns: {
          account_id: string
          total_reservado: number
        }[]
      }
      get_user_account_reserved_scoped: {
        Args: { p_include_family?: boolean; p_origin_only?: boolean }
        Returns: {
          account_id: string
          total_reservado: number
        }[]
      }
      get_user_accounts: {
        Args: { p_family_id?: string; p_user_id?: string }
        Returns: {
          account_id: string
          amount_cents: number
          currency: string
          family_id: string
          nome: string
          order_index: number
          saldo_atual: number
          saldo_disponivel: number
          tipo: string
        }[]
      }
      get_user_accounts_with_balances: {
        Args: { p_user_id: string }
        Returns: {
          account_id: string
          family_id: string
          nome: string
          saldo_atual: number
          saldo_disponivel: number
          tipo: string
          total_reservado: number
          user_id: string
        }[]
      }
      get_user_all_transactions:
        | {
            Args: never
            Returns: {
              account_id: string
              categoria_id: string
              data: string
              descricao: string
              family_id: string
              id: string
              tipo: string
              user_id: string
              valor: number
            }[]
          }
        | {
            Args: { p_user_id: string }
            Returns: {
              categoria_id: string
              data: string
              descricao: string
              family_id: string
              id: string
              modo: string
              tipo: string
              user_id: string
              valor: number
            }[]
          }
      get_user_budget_progress: {
        Args: never
        Returns: {
          budget_id: string
          categoria_cor: string
          categoria_id: string
          categoria_nome: string
          mes: string
          progresso_percentual: number
          valor_gasto: number
          valor_orcamento: number
          valor_restante: number
        }[]
      }
      get_user_credit_cards: {
        Args: { p_family_id?: string; p_user_id?: string }
        Returns: {
          annual_fee_cents: number
          apr: number
          available_cents: number
          card_id: string
          closing_day: number
          credit_limit_cents: number
          currency: string
          current_balance_cents: number
          family_id: string
          nome: string
          order_index: number
          payment_day: number
          utilization_pct: number
        }[]
      }
      get_user_families:
        | {
            Args: never
            Returns: {
              family_id: string
            }[]
          }
        | { Args: { p_user_id: string }; Returns: string[] }
      get_user_family_data:
        | { Args: never; Returns: Json }
        | { Args: { p_user_id: string }; Returns: Json }
      get_user_financial_summary: {
        Args: never
        Returns: {
          total_contas: number
          total_reservado_objetivos: number
          total_saldo_contas: number
          total_saldo_disponivel: number
        }[]
      }
      get_user_goal_progress:
        | {
            Args: never
            Returns: {
              id: string
              nome: string
              progresso_percentual: number
              status_objetivo: string
              total_alocado_historico: number
              total_alocado_real: number
              valor_objetivo: number
            }[]
          }
        | {
            Args: { user_id_param?: string }
            Returns: {
              id: string
              nome: string
              progresso_percentual: number
              status_objetivo: string
              total_alocado_historico: number
              total_alocado_real: number
              valor_objetivo: number
            }[]
          }
      get_user_pending_family_invites: { Args: never; Returns: Json }
      get_user_transactions_detailed: {
        Args: {
          p_account_id?: string
          p_categoria_id?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limit?: number
          p_offset?: number
          p_tipo?: string
        }
        Returns: {
          account_id: string
          account_nome: string
          account_tipo: string
          categoria_cor: string
          categoria_id: string
          categoria_nome: string
          created_at: string
          data: string
          descricao: string
          family_id: string
          family_nome: string
          goal_id: string
          goal_nome: string
          id: string
          tipo: string
          valor: number
        }[]
      }
      handle_credit_card_account: {
        Args: { p_account_id: string; p_operation: string; p_user_id: string }
        Returns: boolean
      }
      handle_credit_card_transaction:
        | {
            Args: {
              p_account_id: string
              p_categoria_id: string
              p_data: string
              p_descricao: string
              p_goal_id?: string
              p_tipo: string
              p_user_id: string
              p_valor: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_id: string
              p_categoria_id: string
              p_data: string
              p_descricao?: string
              p_goal_id?: string
              p_tipo: string
              p_user_id: string
              p_valor: number
            }
            Returns: Json
          }
      invite_family_member_by_email: {
        Args: { p_email: string; p_family_id: string; p_role?: string }
        Returns: Json
      }
      invite_family_member_by_email_safe: {
        Args: { p_email: string; p_family_id: string; p_role?: string }
        Returns: Json
      }
      is_family_admin: {
        Args: { p_family_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_family_editor: {
        Args: { p_family_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_family_non_viewer: { Args: { p_family_id: string }; Returns: boolean }
      is_member_of_family: {
        Args: { p_family_id: string; p_user_id?: string }
        Returns: boolean
      }
      log_permission_check:
        | {
            Args: {
              p_details?: Json
              p_operation: string
              p_result: boolean
              p_table_name: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_details?: Json
              p_operation: string
              p_result: boolean
              p_table_name: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_details: Json
              p_operation: string
              p_result: string
              p_table_name: string
              p_user_id: string
            }
            Returns: undefined
          }
      manage_credit_card_balance: {
        Args: { p_account_id: string; p_new_balance: number; p_user_id: string }
        Returns: string
      }
      normalize_account_balances: { Args: never; Returns: undefined }
      pay_credit_card: {
        Args: {
          p_amount_cents: number
          p_card_id: string
          p_date?: string
          p_description?: string
          p_from_account_id: string
          p_operation_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      pay_credit_card_from_account: {
        Args: {
          p_amount: number
          p_bank_account_id: string
          p_card_account_id: string
          p_date: string
          p_descricao?: string
          p_user_id: string
        }
        Returns: boolean
      }
      refresh_staging_dedupe: { Args: { p_job_id: string }; Returns: undefined }
      remove_family_member: {
        Args: { p_family_id: string; p_member_user_id: string }
        Returns: Json
      }
      reorder_accounts: {
        Args: { p_items: Json; p_user_id: string }
        Returns: undefined
      }
      reorder_credit_cards: {
        Args: { p_items: Json; p_user_id: string }
        Returns: undefined
      }
      restore_family_backup: { Args: { p_backup_id: string }; Returns: Json }
      rr_cancel_at_period_end: { Args: { rule_id: string }; Returns: undefined }
      rr_pause_rule: { Args: { rule_id: string }; Returns: undefined }
      rr_resume_rule: { Args: { rule_id: string }; Returns: undefined }
      rr_skip_next: { Args: { rule_id: string }; Returns: undefined }
      run_recurrents_now: { Args: never; Returns: undefined }
      set_account_balance: {
        Args: { p_account_id: string; p_new_balance: number; p_user_id: string }
        Returns: undefined
      }
      set_credit_card_balance: {
        Args: { p_account_id: string; p_new_balance: number; p_user_id: string }
        Returns: Json
      }
      set_regular_account_balance: {
        Args: { p_account_id: string; p_new_balance: number; p_user_id: string }
        Returns: string
      }
      soft_delete_account: {
        Args: { p_account_id: string; p_user_id?: string }
        Returns: Json
      }
      soft_delete_credit_card: {
        Args: { p_card_id: string; p_user_id?: string }
        Returns: Json
      }
      test_auth_context: {
        Args: never
        Returns: {
          current_user_id: string
          has_auth_context: boolean
          test_message: string
        }[]
      }
      test_connectivity: { Args: never; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      update_account_balance: {
        Args: { account_id_param: string }
        Returns: boolean
      }
      update_ai_video_thumbnail_v3: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      update_ai_video_thumbnail_v4: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: boolean
      }
      update_ai_video_thumbnail_v5: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      update_ai_video_thumbnail_v6: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      update_ai_video_thumbnail_v7: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: boolean
      }
      update_ai_video_thumbnail_v8: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: Json
      }
      update_clip_thumbnail_v3: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      update_family_settings: {
        Args: {
          p_description?: string
          p_family_id: string
          p_nome: string
          p_settings?: Json
        }
        Returns: Json
      }
      update_member_role: {
        Args: {
          p_family_id: string
          p_member_user_id: string
          p_new_role: string
        }
        Returns: Json
      }
      update_short_metadata_v1: {
        Args: { p_id: string; p_meta: Json }
        Returns: undefined
      }
      update_short_metadata_v2: {
        Args: { p_id: string; p_meta: Json }
        Returns: undefined
      }
      update_short_thumbnail_v3: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      update_short_thumbnail_v4: {
        Args: { p_id: string; p_meta: Json; p_url: string }
        Returns: undefined
      }
      upsert_staging_transaction: {
        Args: {
          p_dedupe_status?: string
          p_hash: string
          p_job_id: string
          p_normalized_json: Json
          p_raw_json: Json
          p_row_index: number
        }
        Returns: string
      }
      validate_family_permission: {
        Args: { p_family_id: string; p_required_role: string }
        Returns: boolean
      }
    }
    Enums: {
      meal_allowance_payment_method: "cash" | "card"
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
      meal_allowance_payment_method: ["cash", "card"],
    },
  },
} as const
