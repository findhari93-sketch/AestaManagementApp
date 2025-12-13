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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      advances: {
        Row: {
          amount: number
          created_at: string
          date: string
          deducted_amount: number
          deducted_date: string | null
          deducted_in_period_id: string | null
          deduction_status: Database["public"]["Enums"]["deduction_status"]
          deleted_at: string | null
          deleted_by: string | null
          given_by: string | null
          id: string
          is_deleted: boolean
          laborer_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          reason: string | null
          reference_number: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          deducted_amount?: number
          deducted_date?: string | null
          deducted_in_period_id?: string | null
          deduction_status?: Database["public"]["Enums"]["deduction_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          given_by?: string | null
          id?: string
          is_deleted?: boolean
          laborer_id: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          reason?: string | null
          reference_number?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          deducted_amount?: number
          deducted_date?: string | null
          deducted_in_period_id?: string | null
          deduction_status?: Database["public"]["Enums"]["deduction_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          given_by?: string | null
          id?: string
          is_deleted?: boolean
          laborer_id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          reason?: string | null
          reference_number?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_expense_sync: {
        Row: {
          attendance_date: string
          expense_id: string | null
          id: string
          site_id: string
          synced_at: string | null
          synced_by: string
          synced_by_user_id: string | null
          total_amount: number
          total_laborers: number
          total_work_days: number
        }
        Insert: {
          attendance_date: string
          expense_id?: string | null
          id?: string
          site_id: string
          synced_at?: string | null
          synced_by: string
          synced_by_user_id?: string | null
          total_amount: number
          total_laborers: number
          total_work_days: number
        }
        Update: {
          attendance_date?: string
          expense_id?: string | null
          id?: string
          site_id?: string
          synced_at?: string | null
          synced_by?: string
          synced_by_user_id?: string | null
          total_amount?: number
          total_laborers?: number
          total_work_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_expense_sync_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_expense_sync_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_expense_sync_synced_by_user_id_fkey"
            columns: ["synced_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at: string
          changed_by: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      building_sections: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          area_sqft: number | null
          construction_phase_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          sequence_order: number
          site_id: string
          status: Database["public"]["Enums"]["section_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          area_sqft?: number | null
          construction_phase_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          sequence_order?: number
          site_id: string
          status?: Database["public"]["Enums"]["section_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          area_sqft?: number | null
          construction_phase_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          sequence_order?: number
          site_id?: string
          status?: Database["public"]["Enums"]["section_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_sections_construction_phase_id_fkey"
            columns: ["construction_phase_id"]
            isOneToOne: false
            referencedRelation: "construction_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_sections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          notes: string | null
          plan_name: string
          site_id: string
          total_contract_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          plan_name: string
          site_id: string
          total_contract_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          plan_name?: string
          site_id?: string
          total_contract_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_plans_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_verified: boolean
          notes: string | null
          payment_date: string
          payment_mode: string
          payment_phase_id: string | null
          receipt_url: string | null
          site_id: string
          transaction_reference: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_verified?: boolean
          notes?: string | null
          payment_date: string
          payment_mode: string
          payment_phase_id?: string | null
          receipt_url?: string | null
          site_id: string
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_verified?: boolean
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          payment_phase_id?: string | null
          receipt_url?: string | null
          site_id?: string
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_payment_phase_id_fkey"
            columns: ["payment_phase_id"]
            isOneToOne: false
            referencedRelation: "payment_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      construction_phases: {
        Row: {
          created_at: string
          default_payment_percentage: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_payment_percentage?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_payment_percentage?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      construction_subphases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          phase_id: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          phase_id: string
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phase_id?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_subphases_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "construction_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_attendance: {
        Row: {
          attendance_status: string | null
          break_hours: number | null
          confirmed_at: string | null
          created_at: string
          daily_earnings: number
          daily_log_id: string | null
          daily_rate_applied: number
          date: string
          day_units: number | null
          deleted_at: string | null
          deleted_by: string | null
          end_time: string | null
          engineer_transaction_id: string | null
          entered_by: string | null
          hours_worked: number | null
          id: string
          in_time: string | null
          is_deleted: boolean
          is_paid: boolean | null
          is_verified: boolean
          laborer_id: string
          lunch_in: string | null
          lunch_out: string | null
          morning_entry_at: string | null
          out_time: string | null
          paid_via: string | null
          payment_date: string | null
          payment_id: string | null
          payment_mode: string | null
          payment_proof_url: string | null
          recorded_by: string | null
          recorded_by_user_id: string | null
          section_id: string | null
          site_id: string
          snacks_amount: number | null
          start_time: string | null
          subcontract_id: string | null
          synced_to_expense: boolean | null
          task_completed: string | null
          team_id: string | null
          total_hours: number | null
          updated_at: string
          updated_by: string | null
          updated_by_user_id: string | null
          verified_by: string | null
          work_days: number
          work_description: string | null
          work_hours: number | null
          work_progress_percent: number | null
          work_variance: Database["public"]["Enums"]["work_variance"] | null
        }
        Insert: {
          attendance_status?: string | null
          break_hours?: number | null
          confirmed_at?: string | null
          created_at?: string
          daily_earnings: number
          daily_log_id?: string | null
          daily_rate_applied: number
          date: string
          day_units?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_time?: string | null
          engineer_transaction_id?: string | null
          entered_by?: string | null
          hours_worked?: number | null
          id?: string
          in_time?: string | null
          is_deleted?: boolean
          is_paid?: boolean | null
          is_verified?: boolean
          laborer_id: string
          lunch_in?: string | null
          lunch_out?: string | null
          morning_entry_at?: string | null
          out_time?: string | null
          paid_via?: string | null
          payment_date?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          payment_proof_url?: string | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          section_id?: string | null
          site_id: string
          snacks_amount?: number | null
          start_time?: string | null
          subcontract_id?: string | null
          synced_to_expense?: boolean | null
          task_completed?: string | null
          team_id?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          updated_by_user_id?: string | null
          verified_by?: string | null
          work_days?: number
          work_description?: string | null
          work_hours?: number | null
          work_progress_percent?: number | null
          work_variance?: Database["public"]["Enums"]["work_variance"] | null
        }
        Update: {
          attendance_status?: string | null
          break_hours?: number | null
          confirmed_at?: string | null
          created_at?: string
          daily_earnings?: number
          daily_log_id?: string | null
          daily_rate_applied?: number
          date?: string
          day_units?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_time?: string | null
          engineer_transaction_id?: string | null
          entered_by?: string | null
          hours_worked?: number | null
          id?: string
          in_time?: string | null
          is_deleted?: boolean
          is_paid?: boolean | null
          is_verified?: boolean
          laborer_id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          morning_entry_at?: string | null
          out_time?: string | null
          paid_via?: string | null
          payment_date?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          payment_proof_url?: string | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          section_id?: string | null
          site_id?: string
          snacks_amount?: number | null
          start_time?: string | null
          subcontract_id?: string | null
          synced_to_expense?: boolean | null
          task_completed?: string | null
          team_id?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
          updated_by_user_id?: string | null
          verified_by?: string | null
          work_days?: number
          work_description?: string | null
          work_hours?: number | null
          work_progress_percent?: number | null
          work_variance?: Database["public"]["Enums"]["work_variance"] | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_attendance_contract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_engineer_transaction_id_fkey"
            columns: ["engineer_transaction_id"]
            isOneToOne: false
            referencedRelation: "site_engineer_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "labor_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "daily_attendance_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "daily_attendance_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          date: string
          general_notes: string | null
          holiday_reason: string | null
          id: string
          is_holiday: boolean
          logged_by: string | null
          site_id: string
          updated_at: string
          weather: string | null
          work_summary: string | null
        }
        Insert: {
          created_at?: string
          date: string
          general_notes?: string | null
          holiday_reason?: string | null
          id?: string
          is_holiday?: boolean
          logged_by?: string | null
          site_id: string
          updated_at?: string
          weather?: string | null
          work_summary?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          general_notes?: string | null
          holiday_reason?: string | null
          id?: string
          is_holiday?: boolean
          logged_by?: string | null
          site_id?: string
          updated_at?: string
          weather?: string | null
          work_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_material_usage: {
        Row: {
          brand_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_verified: boolean | null
          material_id: string
          notes: string | null
          quantity: number
          section_id: string | null
          site_id: string
          total_cost: number | null
          unit_cost: number | null
          updated_at: string | null
          usage_date: string
          used_by: string | null
          verified_at: string | null
          verified_by: string | null
          work_area: string | null
          work_description: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_verified?: boolean | null
          material_id: string
          notes?: string | null
          quantity: number
          section_id?: string | null
          site_id: string
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          usage_date?: string
          used_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_area?: string | null
          work_description?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_verified?: boolean | null
          material_id?: string
          notes?: string | null
          quantity?: number
          section_id?: string | null
          site_id?: string
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          usage_date?: string
          used_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_area?: string | null
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_material_usage_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "daily_material_usage_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "daily_material_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_work_summary: {
        Row: {
          comments: string | null
          contract_laborer_count: number | null
          created_at: string | null
          daily_laborer_count: number | null
          date: string
          default_snacks_per_person: number | null
          entered_by: string | null
          entered_by_user_id: string | null
          first_in_time: string | null
          id: string
          last_out_time: string | null
          market_laborer_count: number | null
          site_id: string
          total_expense: number | null
          total_laborer_count: number | null
          total_salary: number | null
          total_snacks: number | null
          updated_at: string | null
          updated_by: string | null
          updated_by_user_id: string | null
          work_description: string | null
          work_progress_percent: number | null
          work_status: string | null
          work_updates: Json | null
        }
        Insert: {
          comments?: string | null
          contract_laborer_count?: number | null
          created_at?: string | null
          daily_laborer_count?: number | null
          date: string
          default_snacks_per_person?: number | null
          entered_by?: string | null
          entered_by_user_id?: string | null
          first_in_time?: string | null
          id?: string
          last_out_time?: string | null
          market_laborer_count?: number | null
          site_id: string
          total_expense?: number | null
          total_laborer_count?: number | null
          total_salary?: number | null
          total_snacks?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          work_description?: string | null
          work_progress_percent?: number | null
          work_status?: string | null
          work_updates?: Json | null
        }
        Update: {
          comments?: string | null
          contract_laborer_count?: number | null
          created_at?: string | null
          daily_laborer_count?: number | null
          date?: string
          default_snacks_per_person?: number | null
          entered_by?: string | null
          entered_by_user_id?: string | null
          first_in_time?: string | null
          id?: string
          last_out_time?: string | null
          market_laborer_count?: number | null
          site_id?: string
          total_expense?: number | null
          total_laborer_count?: number | null
          total_salary?: number | null
          total_snacks?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          work_description?: string | null
          work_progress_percent?: number | null
          work_status?: string | null
          work_updates?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_work_summary_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_summary_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      default_building_sections: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          sequence_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sequence_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sequence_order?: number
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          created_at: string
          executed_at: string | null
          id: string
          reason: string | null
          record_id: string
          record_summary: string | null
          requested_at: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deletion_request_status"]
          table_name: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          record_id: string
          record_summary?: string | null
          requested_at?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deletion_request_status"]
          table_name: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          record_id?: string
          record_summary?: string | null
          requested_at?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deletion_request_status"]
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          challan_date: string | null
          challan_number: string | null
          challan_url: string | null
          created_at: string | null
          created_by: string | null
          delivery_date: string
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          driver_name: string | null
          driver_phone: string | null
          grn_number: string
          id: string
          inspection_notes: string | null
          invoice_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          invoice_url: string | null
          location_id: string | null
          notes: string | null
          po_id: string | null
          received_by: string | null
          site_id: string
          updated_at: string | null
          vehicle_number: string | null
          vendor_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          challan_date?: string | null
          challan_number?: string | null
          challan_url?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          driver_name?: string | null
          driver_phone?: string | null
          grn_number: string
          id?: string
          inspection_notes?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          location_id?: string | null
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          site_id: string
          updated_at?: string | null
          vehicle_number?: string | null
          vendor_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          challan_date?: string | null
          challan_number?: string | null
          challan_url?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          driver_name?: string | null
          driver_phone?: string | null
          grn_number?: string
          id?: string
          inspection_notes?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          location_id?: string | null
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          site_id?: string
          updated_at?: string | null
          vehicle_number?: string | null
          vendor_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          accepted_qty: number | null
          batch_number: string | null
          brand_id: string | null
          created_at: string | null
          delivery_id: string
          expiry_date: string | null
          id: string
          material_id: string
          notes: string | null
          ordered_qty: number | null
          po_item_id: string | null
          received_qty: number
          rejected_qty: number | null
          rejection_reason: string | null
          unit_price: number | null
        }
        Insert: {
          accepted_qty?: number | null
          batch_number?: string | null
          brand_id?: string | null
          created_at?: string | null
          delivery_id: string
          expiry_date?: string | null
          id?: string
          material_id: string
          notes?: string | null
          ordered_qty?: number | null
          po_item_id?: string | null
          received_qty: number
          rejected_qty?: number | null
          rejection_reason?: string | null
          unit_price?: number | null
        }
        Update: {
          accepted_qty?: number | null
          batch_number?: string | null
          brand_id?: string | null
          created_at?: string | null
          delivery_id?: string
          expiry_date?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          ordered_qty?: number | null
          po_item_id?: string | null
          received_qty?: number
          rejected_qty?: number | null
          rejection_reason?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "delivery_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_recurring: boolean
          module: Database["public"]["Enums"]["expense_module"]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          module?: Database["public"]["Enums"]["expense_module"]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          module?: Database["public"]["Enums"]["expense_module"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          cleared_date: string | null
          contract_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          entered_by: string | null
          entered_by_user_id: string | null
          id: string
          is_cleared: boolean
          is_deleted: boolean
          is_recurring: boolean
          laborer_id: string | null
          module: Database["public"]["Enums"]["expense_module"]
          notes: string | null
          paid_by: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          receipt_url: string | null
          reference_number: string | null
          section_id: string | null
          site_id: string | null
          site_payer_id: string | null
          team_id: string | null
          updated_at: string
          vendor_contact: string | null
          vendor_name: string | null
          week_ending: string | null
        }
        Insert: {
          amount: number
          category_id: string
          cleared_date?: string | null
          contract_id?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entered_by?: string | null
          entered_by_user_id?: string | null
          id?: string
          is_cleared?: boolean
          is_deleted?: boolean
          is_recurring?: boolean
          laborer_id?: string | null
          module?: Database["public"]["Enums"]["expense_module"]
          notes?: string | null
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          receipt_url?: string | null
          reference_number?: string | null
          section_id?: string | null
          site_id?: string | null
          site_payer_id?: string | null
          team_id?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_name?: string | null
          week_ending?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          cleared_date?: string | null
          contract_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entered_by?: string | null
          entered_by_user_id?: string | null
          id?: string
          is_cleared?: boolean
          is_deleted?: boolean
          is_recurring?: boolean
          laborer_id?: string | null
          module?: Database["public"]["Enums"]["expense_module"]
          notes?: string | null
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          receipt_url?: string | null
          reference_number?: string | null
          section_id?: string | null
          site_id?: string | null
          site_payer_id?: string | null
          team_id?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_name?: string | null
          week_ending?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_entered_by_user_id_fkey"
            columns: ["entered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "expenses_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_site_payer_id_fkey"
            columns: ["site_payer_id"]
            isOneToOne: false
            referencedRelation: "payer_expense_summary"
            referencedColumns: ["payer_id"]
          },
          {
            foreignKeyName: "expenses_site_payer_id_fkey"
            columns: ["site_payer_id"]
            isOneToOne: false
            referencedRelation: "site_payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_rows: number
          file_name: string | null
          file_size: number | null
          id: string
          import_type: string
          imported_by: string | null
          skipped_rows: number
          status: string
          success_rows: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_rows?: number
          file_name?: string | null
          file_size?: number | null
          id?: string
          import_type: string
          imported_by?: string | null
          skipped_rows?: number
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_rows?: number
          file_name?: string | null
          file_size?: number | null
          id?: string
          import_type?: string
          imported_by?: string | null
          skipped_rows?: number
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      labor_payments: {
        Row: {
          amount: number
          attendance_id: string | null
          created_at: string | null
          id: string
          is_under_contract: boolean | null
          laborer_id: string
          paid_by: string
          paid_by_user_id: string | null
          payment_channel: string
          payment_date: string
          payment_for_date: string
          payment_mode: string
          proof_url: string | null
          recorded_by: string
          recorded_by_user_id: string | null
          site_engineer_transaction_id: string | null
          site_id: string
          subcontract_id: string | null
        }
        Insert: {
          amount: number
          attendance_id?: string | null
          created_at?: string | null
          id?: string
          is_under_contract?: boolean | null
          laborer_id: string
          paid_by: string
          paid_by_user_id?: string | null
          payment_channel: string
          payment_date?: string
          payment_for_date: string
          payment_mode: string
          proof_url?: string | null
          recorded_by: string
          recorded_by_user_id?: string | null
          site_engineer_transaction_id?: string | null
          site_id: string
          subcontract_id?: string | null
        }
        Update: {
          amount?: number
          attendance_id?: string | null
          created_at?: string | null
          id?: string
          is_under_contract?: boolean | null
          laborer_id?: string
          paid_by?: string
          paid_by_user_id?: string | null
          payment_channel?: string
          payment_date?: string
          payment_for_date?: string
          payment_mode?: string
          proof_url?: string | null
          recorded_by?: string
          recorded_by_user_id?: string | null
          site_engineer_transaction_id?: string | null
          site_id?: string
          subcontract_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_payments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "daily_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "v_active_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_site_engineer_transaction_id_fkey"
            columns: ["site_engineer_transaction_id"]
            isOneToOne: false
            referencedRelation: "site_engineer_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_payments_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_roles: {
        Row: {
          category_id: string
          created_at: string
          default_daily_rate: number
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_market_role: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          default_daily_rate?: number
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_market_role?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          default_daily_rate?: number
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_market_role?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "labor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_site_daily_by_category"
            referencedColumns: ["category_id"]
          },
        ]
      }
      laborer_site_assignments: {
        Row: {
          assigned_date: string
          created_at: string
          id: string
          is_active: boolean
          laborer_id: string
          notes: string | null
          site_id: string
          unassigned_date: string | null
        }
        Insert: {
          assigned_date?: string
          created_at?: string
          id?: string
          is_active?: boolean
          laborer_id: string
          notes?: string | null
          site_id: string
          unassigned_date?: string | null
        }
        Update: {
          assigned_date?: string
          created_at?: string
          id?: string
          is_active?: boolean
          laborer_id?: string
          notes?: string | null
          site_id?: string
          unassigned_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laborer_site_assignments_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborer_site_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      laborers: {
        Row: {
          address: string | null
          age: number | null
          alternate_phone: string | null
          associated_team_id: string | null
          category_id: string
          created_at: string
          daily_rate: number
          deactivation_date: string | null
          deactivation_reason: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          id_proof_number: string | null
          id_proof_type: string | null
          joining_date: string | null
          laborer_type: string | null
          language: string | null
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          role_id: string
          status: Database["public"]["Enums"]["laborer_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          alternate_phone?: string | null
          associated_team_id?: string | null
          category_id: string
          created_at?: string
          daily_rate?: number
          deactivation_date?: string | null
          deactivation_reason?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          joining_date?: string | null
          laborer_type?: string | null
          language?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role_id: string
          status?: Database["public"]["Enums"]["laborer_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          alternate_phone?: string | null
          associated_team_id?: string | null
          category_id?: string
          created_at?: string
          daily_rate?: number
          deactivation_date?: string | null
          deactivation_reason?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          joining_date?: string | null
          laborer_type?: string | null
          language?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role_id?: string
          status?: Database["public"]["Enums"]["laborer_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laborers_associated_team_id_fkey"
            columns: ["associated_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborers_associated_team_id_fkey"
            columns: ["associated_team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "laborers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "labor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_site_daily_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "laborers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "labor_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_by_role"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "laborers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_by_role"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "laborers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      market_laborer_attendance: {
        Row: {
          attendance_status: string | null
          break_hours: number | null
          confirmed_at: string | null
          count: number
          created_at: string | null
          date: string
          day_units: number | null
          engineer_transaction_id: string | null
          entered_by: string
          entered_by_user_id: string | null
          id: string
          in_time: string | null
          is_paid: boolean | null
          lunch_in: string | null
          lunch_out: string | null
          morning_entry_at: string | null
          notes: string | null
          out_time: string | null
          paid_via: string | null
          payment_date: string | null
          payment_mode: string | null
          payment_proof_url: string | null
          rate_per_person: number
          role_id: string
          section_id: string | null
          site_id: string
          snacks_per_person: number | null
          total_cost: number
          total_hours: number | null
          total_snacks: number | null
          updated_at: string | null
          updated_by: string | null
          updated_by_user_id: string | null
          work_days: number
          work_hours: number | null
        }
        Insert: {
          attendance_status?: string | null
          break_hours?: number | null
          confirmed_at?: string | null
          count?: number
          created_at?: string | null
          date: string
          day_units?: number | null
          engineer_transaction_id?: string | null
          entered_by: string
          entered_by_user_id?: string | null
          id?: string
          in_time?: string | null
          is_paid?: boolean | null
          lunch_in?: string | null
          lunch_out?: string | null
          morning_entry_at?: string | null
          notes?: string | null
          out_time?: string | null
          paid_via?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_proof_url?: string | null
          rate_per_person: number
          role_id: string
          section_id?: string | null
          site_id: string
          snacks_per_person?: number | null
          total_cost: number
          total_hours?: number | null
          total_snacks?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          work_days?: number
          work_hours?: number | null
        }
        Update: {
          attendance_status?: string | null
          break_hours?: number | null
          confirmed_at?: string | null
          count?: number
          created_at?: string | null
          date?: string
          day_units?: number | null
          engineer_transaction_id?: string | null
          entered_by?: string
          entered_by_user_id?: string | null
          id?: string
          in_time?: string | null
          is_paid?: boolean | null
          lunch_in?: string | null
          lunch_out?: string | null
          morning_entry_at?: string | null
          notes?: string | null
          out_time?: string | null
          paid_via?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_proof_url?: string | null
          rate_per_person?: number
          role_id?: string
          section_id?: string | null
          site_id?: string
          snacks_per_person?: number | null
          total_cost?: number
          total_hours?: number | null
          total_snacks?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          work_days?: number
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_laborer_attendance_engineer_transaction_id_fkey"
            columns: ["engineer_transaction_id"]
            isOneToOne: false
            referencedRelation: "site_engineer_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_entered_by_user_id_fkey"
            columns: ["entered_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "labor_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_by_role"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_by_role"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_laborer_attendance_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      material_brands: {
        Row: {
          brand_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_preferred: boolean | null
          material_id: string
          notes: string | null
          quality_rating: number | null
        }
        Insert: {
          brand_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          material_id: string
          notes?: string | null
          quality_rating?: number | null
        }
        Update: {
          brand_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          material_id?: string
          notes?: string | null
          quality_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_brands_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_brands_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_brands_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
        ]
      }
      material_categories: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_items: {
        Row: {
          approved_qty: number | null
          brand_id: string | null
          created_at: string | null
          estimated_cost: number | null
          fulfilled_qty: number | null
          id: string
          material_id: string
          notes: string | null
          request_id: string
          requested_qty: number
        }
        Insert: {
          approved_qty?: number | null
          brand_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          fulfilled_qty?: number | null
          id?: string
          material_id: string
          notes?: string | null
          request_id: string
          requested_qty: number
        }
        Update: {
          approved_qty?: number | null
          brand_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          fulfilled_qty?: number | null
          id?: string
          material_id?: string
          notes?: string | null
          request_id?: string
          requested_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          converted_to_po_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          priority: string | null
          rejection_reason: string | null
          request_date: string
          request_number: string
          requested_by: string
          required_by_date: string | null
          section_id: string | null
          site_id: string
          status: Database["public"]["Enums"]["material_request_status"] | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          converted_to_po_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          rejection_reason?: string | null
          request_date?: string
          request_number: string
          requested_by: string
          required_by_date?: string | null
          section_id?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["material_request_status"] | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          converted_to_po_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          rejection_reason?: string | null
          request_date?: string
          request_number?: string
          requested_by?: string
          required_by_date?: string | null
          section_id?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["material_request_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_converted_to_po_id_fkey"
            columns: ["converted_to_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_converted_to_po_id_fkey"
            columns: ["converted_to_po_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "material_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      material_vendors: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_preferred: boolean | null
          last_price_update: string | null
          lead_time_days: number | null
          material_id: string
          min_order_qty: number | null
          notes: string | null
          unit_price: number
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          last_price_update?: string | null
          lead_time_days?: number | null
          material_id: string
          min_order_qty?: number | null
          notes?: string | null
          unit_price: number
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          last_price_update?: string | null
          lead_time_days?: number | null
          material_id?: string
          min_order_qty?: number | null
          notes?: string | null
          unit_price?: number
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_vendors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_vendors_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_vendors_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_vendors_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category_id: string | null
          code: string | null
          conversion_factor: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          gst_rate: number | null
          hsn_code: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          local_name: string | null
          min_order_qty: number | null
          name: string
          reorder_level: number | null
          secondary_unit: Database["public"]["Enums"]["material_unit"] | null
          specifications: Json | null
          unit: Database["public"]["Enums"]["material_unit"]
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          local_name?: string | null
          min_order_qty?: number | null
          name: string
          reorder_level?: number | null
          secondary_unit?: Database["public"]["Enums"]["material_unit"] | null
          specifications?: Json | null
          unit?: Database["public"]["Enums"]["material_unit"]
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          local_name?: string | null
          min_order_qty?: number | null
          name?: string
          reorder_level?: number | null
          secondary_unit?: Database["public"]["Enums"]["material_unit"] | null
          specifications?: Json | null
          unit?: Database["public"]["Enums"]["material_unit"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_read: boolean
          message: string
          notification_type: string
          read_at: string | null
          related_id: string | null
          related_table: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_phases: {
        Row: {
          amount: number
          construction_phase_id: string | null
          created_at: string
          description: string | null
          expected_date: string | null
          id: string
          is_milestone: boolean
          notes: string | null
          payment_plan_id: string
          percentage: number
          phase_name: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          construction_phase_id?: string | null
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          is_milestone?: boolean
          notes?: string | null
          payment_plan_id: string
          percentage: number
          phase_name: string
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          construction_phase_id?: string | null
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          is_milestone?: boolean
          notes?: string | null
          payment_plan_id?: string
          percentage?: number
          phase_name?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_phases_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "client_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          brand_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          material_id: string
          notes: string | null
          pending_qty: number | null
          po_id: string
          quantity: number
          received_qty: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          material_id: string
          notes?: string | null
          pending_qty?: number | null
          po_id: string
          quantity: number
          received_qty?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          material_id?: string
          notes?: string | null
          pending_qty?: number | null
          po_id?: string
          quantity?: number
          received_qty?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          advance_paid: number | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          delivery_address: string | null
          delivery_location_id: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          order_date: string
          other_charges: number | null
          payment_terms: string | null
          po_document_url: string | null
          po_number: string
          quotation_url: string | null
          site_id: string
          status: Database["public"]["Enums"]["po_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          transport_cost: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          advance_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          delivery_location_id?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string
          other_charges?: number | null
          payment_terms?: string | null
          po_document_url?: string | null
          po_number: string
          quotation_url?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["po_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          transport_cost?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          advance_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          delivery_location_id?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          order_date?: string
          other_charges?: number | null
          payment_terms?: string | null
          po_document_url?: string | null
          po_number?: string
          quotation_url?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["po_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          transport_cost?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payment_allocations: {
        Row: {
          amount: number
          created_at: string | null
          delivery_id: string | null
          id: string
          payment_id: string
          po_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          delivery_id?: string | null
          id?: string
          payment_id: string
          po_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          delivery_id?: string | null
          id?: string
          payment_id?: string
          po_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payment_allocations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "purchase_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_allocations_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_allocations_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_advance: boolean | null
          notes: string | null
          payment_date: string
          payment_mode: string
          receipt_url: string | null
          reference_number: string | null
          site_id: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_advance?: boolean | null
          notes?: string | null
          payment_date?: string
          payment_mode: string
          receipt_url?: string | null
          reference_number?: string | null
          site_id?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_advance?: boolean | null
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          receipt_url?: string | null
          reference_number?: string | null
          site_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          last_used_at: string | null
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          amount: number
          comments: string | null
          created_at: string
          id: string
          is_team_payment: boolean
          paid_by: string | null
          paid_to: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_url: string | null
          reference_number: string | null
          salary_period_id: string
          team_id: string | null
        }
        Insert: {
          amount: number
          comments?: string | null
          created_at?: string
          id?: string
          is_team_payment?: boolean
          paid_by?: string | null
          paid_to?: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_url?: string | null
          reference_number?: string | null
          salary_period_id: string
          team_id?: string | null
        }
        Update: {
          amount?: number
          comments?: string | null
          created_at?: string
          id?: string
          is_team_payment?: boolean
          paid_by?: string | null
          paid_to?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_url?: string | null
          reference_number?: string | null
          salary_period_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_salary_period_id_fkey"
            columns: ["salary_period_id"]
            isOneToOne: false
            referencedRelation: "salary_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_salary_period_id_fkey"
            columns: ["salary_period_id"]
            isOneToOne: false
            referencedRelation: "v_salary_periods_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      salary_periods: {
        Row: {
          advance_deductions: number
          amount_paid: number
          balance_due: number
          calculated_at: string | null
          calculated_by: string | null
          created_at: string
          extras: number
          gross_earnings: number
          id: string
          laborer_id: string
          net_payable: number
          notes: string | null
          other_additions: number
          other_deductions: number
          site_breakdown: Json | null
          status: Database["public"]["Enums"]["salary_status"]
          total_additions: number
          total_days_worked: number
          total_deductions: number
          total_hours_worked: number | null
          updated_at: string
          week_ending: string
          week_start: string
        }
        Insert: {
          advance_deductions?: number
          amount_paid?: number
          balance_due?: number
          calculated_at?: string | null
          calculated_by?: string | null
          created_at?: string
          extras?: number
          gross_earnings?: number
          id?: string
          laborer_id: string
          net_payable?: number
          notes?: string | null
          other_additions?: number
          other_deductions?: number
          site_breakdown?: Json | null
          status?: Database["public"]["Enums"]["salary_status"]
          total_additions?: number
          total_days_worked?: number
          total_deductions?: number
          total_hours_worked?: number | null
          updated_at?: string
          week_ending: string
          week_start: string
        }
        Update: {
          advance_deductions?: number
          amount_paid?: number
          balance_due?: number
          calculated_at?: string | null
          calculated_by?: string | null
          created_at?: string
          extras?: number
          gross_earnings?: number
          id?: string
          laborer_id?: string
          net_payable?: number
          notes?: string | null
          other_additions?: number
          other_deductions?: number
          site_breakdown?: Json | null
          status?: Database["public"]["Enums"]["salary_status"]
          total_additions?: number
          total_days_worked?: number
          total_deductions?: number
          total_hours_worked?: number | null
          updated_at?: string
          week_ending?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_periods_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_periods_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_clients: {
        Row: {
          client_id: string
          contract_value: number | null
          created_at: string
          id: string
          is_primary_client: boolean | null
          notes: string | null
          ownership_percentage: number | null
          site_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_value?: number | null
          created_at?: string
          id?: string
          is_primary_client?: boolean | null
          notes?: string | null
          ownership_percentage?: number | null
          site_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_value?: number | null
          created_at?: string
          id?: string
          is_primary_client?: boolean | null
          notes?: string | null
          ownership_percentage?: number | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_clients_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_engineer_settlements: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_mode: string
          proof_url: string | null
          recorded_by: string
          recorded_by_user_id: string | null
          settlement_date: string
          settlement_type: string
          site_engineer_id: string
          transactions_covered: string[] | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_mode: string
          proof_url?: string | null
          recorded_by: string
          recorded_by_user_id?: string | null
          settlement_date?: string
          settlement_type: string
          site_engineer_id: string
          transactions_covered?: string[] | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string
          proof_url?: string | null
          recorded_by?: string
          recorded_by_user_id?: string | null
          settlement_date?: string
          settlement_type?: string
          site_engineer_id?: string
          transactions_covered?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "site_engineer_settlements_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_settlements_site_engineer_id_fkey"
            columns: ["site_engineer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_engineer_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_user_id: string | null
          created_at: string | null
          description: string | null
          dispute_notes: string | null
          id: string
          is_settled: boolean | null
          notes: string | null
          payment_mode: string
          proof_url: string | null
          recipient_id: string | null
          recipient_type: string | null
          recorded_by: string
          recorded_by_user_id: string | null
          related_attendance_id: string | null
          related_subcontract_id: string | null
          settled_by: string | null
          settled_date: string | null
          settlement_mode: string | null
          settlement_proof_url: string | null
          settlement_reason: string | null
          settlement_status: string | null
          site_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string | null
          description?: string | null
          dispute_notes?: string | null
          id?: string
          is_settled?: boolean | null
          notes?: string | null
          payment_mode: string
          proof_url?: string | null
          recipient_id?: string | null
          recipient_type?: string | null
          recorded_by: string
          recorded_by_user_id?: string | null
          related_attendance_id?: string | null
          related_subcontract_id?: string | null
          settled_by?: string | null
          settled_date?: string | null
          settlement_mode?: string | null
          settlement_proof_url?: string | null
          settlement_reason?: string | null
          settlement_status?: string | null
          site_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string | null
          description?: string | null
          dispute_notes?: string | null
          id?: string
          is_settled?: boolean | null
          notes?: string | null
          payment_mode?: string
          proof_url?: string | null
          recipient_id?: string | null
          recipient_type?: string | null
          recorded_by?: string
          recorded_by_user_id?: string | null
          related_attendance_id?: string | null
          related_subcontract_id?: string | null
          settled_by?: string | null
          settled_date?: string | null
          settlement_mode?: string | null
          settlement_proof_url?: string | null
          settlement_reason?: string | null
          settlement_status?: string | null
          site_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_engineer_transactions_confirmed_by_user_id_fkey"
            columns: ["confirmed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_related_attendance_id_fkey"
            columns: ["related_attendance_id"]
            isOneToOne: false
            referencedRelation: "daily_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_related_attendance_id_fkey"
            columns: ["related_attendance_id"]
            isOneToOne: false
            referencedRelation: "v_active_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_related_subcontract_id_fkey"
            columns: ["related_subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_engineer_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_paid_holiday: boolean | null
          reason: string | null
          site_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          is_paid_holiday?: boolean | null
          reason?: string | null
          site_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_paid_holiday?: boolean | null
          reason?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_holidays_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_material_budgets: {
        Row: {
          budget_amount: number
          category_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          site_id: string
          updated_at: string | null
        }
        Insert: {
          budget_amount: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          site_id: string
          updated_at?: string | null
        }
        Update: {
          budget_amount?: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_material_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_material_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_material_budgets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_payers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          site_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          site_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_payers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_payment_milestones: {
        Row: {
          actual_payment_date: string | null
          amount: number
          created_at: string
          expected_date: string | null
          id: string
          milestone_description: string | null
          milestone_name: string
          notes: string | null
          percentage: number
          sequence_order: number
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_payment_date?: string | null
          amount: number
          created_at?: string
          expected_date?: string | null
          id?: string
          milestone_description?: string | null
          milestone_name: string
          notes?: string | null
          percentage: number
          sequence_order?: number
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_payment_date?: string | null
          amount?: number
          created_at?: string
          expected_date?: string | null
          id?: string
          milestone_description?: string | null
          milestone_name?: string
          notes?: string | null
          percentage?: number
          sequence_order?: number
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_payment_milestones_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          actual_completion_date: string | null
          address: string | null
          city: string | null
          client_contact: string | null
          client_email: string | null
          client_name: string | null
          construction_phase: string | null
          construction_phase_id: string | null
          contract_document_url: string | null
          created_at: string
          created_by: string | null
          default_section_id: string | null
          default_work_end: string | null
          default_work_start: string | null
          has_multiple_payers: boolean | null
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          location_google_maps_url: string | null
          location_lat: number | null
          location_lng: number | null
          name: string
          nearby_tea_shop_contact: string | null
          nearby_tea_shop_name: string | null
          notes: string | null
          payment_plan_json: Json | null
          payment_segments: number | null
          project_contract_value: number | null
          site_type: Database["public"]["Enums"]["site_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["site_status"]
          target_completion_date: string | null
          total_amount_received: number | null
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          address?: string | null
          city?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string | null
          construction_phase?: string | null
          construction_phase_id?: string | null
          contract_document_url?: string | null
          created_at?: string
          created_by?: string | null
          default_section_id?: string | null
          default_work_end?: string | null
          default_work_start?: string | null
          has_multiple_payers?: boolean | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          location_google_maps_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          nearby_tea_shop_contact?: string | null
          nearby_tea_shop_name?: string | null
          notes?: string | null
          payment_plan_json?: Json | null
          payment_segments?: number | null
          project_contract_value?: number | null
          site_type?: Database["public"]["Enums"]["site_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          target_completion_date?: string | null
          total_amount_received?: number | null
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          address?: string | null
          city?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_name?: string | null
          construction_phase?: string | null
          construction_phase_id?: string | null
          contract_document_url?: string | null
          created_at?: string
          created_by?: string | null
          default_section_id?: string | null
          default_work_end?: string | null
          default_work_start?: string | null
          has_multiple_payers?: boolean | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          location_google_maps_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          nearby_tea_shop_contact?: string | null
          nearby_tea_shop_name?: string | null
          notes?: string | null
          payment_plan_json?: Json | null
          payment_segments?: number | null
          project_contract_value?: number | null
          site_type?: Database["public"]["Enums"]["site_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["site_status"]
          target_completion_date?: string | null
          total_amount_received?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_construction_phase_id_fkey"
            columns: ["construction_phase_id"]
            isOneToOne: false
            referencedRelation: "construction_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_default_section_id_fkey"
            columns: ["default_section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_default_section_id_fkey"
            columns: ["default_section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
        ]
      }
      stock_inventory: {
        Row: {
          available_qty: number | null
          avg_unit_cost: number | null
          brand_id: string | null
          created_at: string | null
          current_qty: number
          id: string
          last_issued_date: string | null
          last_received_date: string | null
          location_id: string | null
          material_id: string
          reorder_level: number | null
          reorder_qty: number | null
          reserved_qty: number
          site_id: string
          updated_at: string | null
        }
        Insert: {
          available_qty?: number | null
          avg_unit_cost?: number | null
          brand_id?: string | null
          created_at?: string | null
          current_qty?: number
          id?: string
          last_issued_date?: string | null
          last_received_date?: string | null
          location_id?: string | null
          material_id: string
          reorder_level?: number | null
          reorder_qty?: number | null
          reserved_qty?: number
          site_id: string
          updated_at?: string | null
        }
        Update: {
          available_qty?: number | null
          avg_unit_cost?: number | null
          brand_id?: string | null
          created_at?: string | null
          current_qty?: number
          id?: string
          last_issued_date?: string | null
          last_received_date?: string | null
          location_id?: string | null
          material_id?: string
          reorder_level?: number | null
          reorder_qty?: number | null
          reserved_qty?: number
          site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_inventory_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          location_type: string | null
          name: string
          site_id: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          location_type?: string | null
          name: string
          site_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          location_type?: string | null
          name?: string
          site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          inventory_id: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          section_id: string | null
          site_id: string
          total_cost: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          inventory_id: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          section_id?: string | null
          site_id: string
          total_cost?: number | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          inventory_id?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          section_id?: string | null
          site_id?: string
          total_cost?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "stock_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "stock_transactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          material_id: string
          notes: string | null
          quantity_received: number | null
          quantity_sent: number
          transfer_id: string
          unit_cost: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          material_id: string
          notes?: string | null
          quantity_received?: number | null
          quantity_sent: number
          transfer_id: string
          unit_cost?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          quantity_received?: number | null
          quantity_sent?: number
          transfer_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "material_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
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
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          from_location_id: string | null
          from_site_id: string
          id: string
          initiated_at: string | null
          initiated_by: string | null
          notes: string | null
          received_at: string | null
          received_by: string | null
          status: string | null
          to_location_id: string | null
          to_site_id: string
          transfer_date: string
          transfer_number: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_location_id?: string | null
          from_site_id: string
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string | null
          to_location_id?: string | null
          to_site_id: string
          transfer_date?: string
          transfer_number?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_location_id?: string | null
          from_site_id?: string
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string | null
          to_location_id?: string | null
          to_site_id?: string
          transfer_date?: string
          transfer_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_site_id_fkey"
            columns: ["from_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_site_id_fkey"
            columns: ["to_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_milestones: {
        Row: {
          amount: number | null
          completion_date: string | null
          contract_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          percentage: number | null
          sequence_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          completion_date?: string | null
          contract_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          percentage?: number | null
          sequence_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          completion_date?: string | null
          contract_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          percentage?: number | null
          sequence_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_payments: {
        Row: {
          amount: number
          balance_after_payment: number | null
          comments: string | null
          contract_id: string
          created_at: string
          id: string
          milestone_id: string | null
          paid_by: string | null
          paid_by_user_id: string | null
          payment_channel: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_type: Database["public"]["Enums"]["contract_payment_type"]
          period_from_date: string | null
          period_to_date: string | null
          receipt_url: string | null
          recorded_by: string | null
          recorded_by_user_id: string | null
          reference_number: string | null
          site_engineer_transaction_id: string | null
          total_salary_for_period: number | null
        }
        Insert: {
          amount: number
          balance_after_payment?: number | null
          comments?: string | null
          contract_id: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          paid_by?: string | null
          paid_by_user_id?: string | null
          payment_channel?: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_type: Database["public"]["Enums"]["contract_payment_type"]
          period_from_date?: string | null
          period_to_date?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          reference_number?: string | null
          site_engineer_transaction_id?: string | null
          total_salary_for_period?: number | null
        }
        Update: {
          amount?: number
          balance_after_payment?: number | null
          comments?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          paid_by?: string | null
          paid_by_user_id?: string | null
          payment_channel?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_type?: Database["public"]["Enums"]["contract_payment_type"]
          period_from_date?: string | null
          period_to_date?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          reference_number?: string | null
          site_engineer_transaction_id?: string | null
          total_salary_for_period?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "subcontract_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_subcontract_payments_site_eng_trans"
            columns: ["site_engineer_transaction_id"]
            isOneToOne: false
            referencedRelation: "site_engineer_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_payments_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_payments_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_sections: {
        Row: {
          contract_id: string
          created_at: string
          estimated_value: number | null
          id: string
          scope_notes: string | null
          section_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          scope_notes?: string | null
          section_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          scope_notes?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_sections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
        ]
      }
      subcontracts: {
        Row: {
          actual_end_date: string | null
          assigned_sections: string[] | null
          contract_number: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          description: string | null
          expected_end_date: string | null
          id: string
          is_rate_based: boolean
          laborer_id: string | null
          measurement_unit:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          notes: string | null
          rate_per_unit: number | null
          scope_of_work: string | null
          site_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          team_id: string | null
          terms_and_conditions: string | null
          title: string
          total_units: number | null
          total_value: number
          updated_at: string
          weekly_advance_rate: number | null
        }
        Insert: {
          actual_end_date?: string | null
          assigned_sections?: string[] | null
          contract_number?: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          is_rate_based?: boolean
          laborer_id?: string | null
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          notes?: string | null
          rate_per_unit?: number | null
          scope_of_work?: string | null
          site_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          team_id?: string | null
          terms_and_conditions?: string | null
          title: string
          total_units?: number | null
          total_value?: number
          updated_at?: string
          weekly_advance_rate?: number | null
        }
        Update: {
          actual_end_date?: string | null
          assigned_sections?: string[] | null
          contract_number?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          is_rate_based?: boolean
          laborer_id?: string | null
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          notes?: string | null
          rate_per_unit?: number | null
          scope_of_work?: string | null
          site_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          team_id?: string | null
          terms_and_conditions?: string | null
          title?: string
          total_units?: number | null
          total_value?: number
          updated_at?: string
          weekly_advance_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      tea_shop_accounts: {
        Row: {
          address: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          owner_name: string | null
          shop_name: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          owner_name?: string | null
          shop_name: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          owner_name?: string | null
          shop_name?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_accounts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tea_shop_clearances: {
        Row: {
          amount_paid: number
          balance: number
          created_at: string
          expense_id: string | null
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          tea_shop_id: string
          total_amount: number
          week_end: string
          week_start: string
        }
        Insert: {
          amount_paid: number
          balance?: number
          created_at?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tea_shop_id: string
          total_amount: number
          week_end: string
          week_start: string
        }
        Update: {
          amount_paid?: number
          balance?: number
          created_at?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tea_shop_id?: string
          total_amount?: number
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_clearances_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_clearances_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_clearances_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "tea_shop_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_clearances_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "v_tea_shop_weekly"
            referencedColumns: ["tea_shop_id"]
          },
        ]
      }
      tea_shop_consumption_details: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          is_working: boolean | null
          laborer_id: string | null
          laborer_name: string | null
          laborer_type: string | null
          snacks_amount: number | null
          snacks_items: Json | null
          tea_amount: number | null
          tea_rounds: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          is_working?: boolean | null
          laborer_id?: string | null
          laborer_name?: string | null
          laborer_type?: string | null
          snacks_amount?: number | null
          snacks_items?: Json | null
          tea_amount?: number | null
          tea_rounds?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          is_working?: boolean | null
          laborer_id?: string | null
          laborer_name?: string | null
          laborer_type?: string | null
          snacks_amount?: number | null
          snacks_items?: Json | null
          tea_amount?: number | null
          tea_rounds?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_consumption_details_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "tea_shop_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_consumption_details_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
        ]
      }
      tea_shop_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          entered_by: string | null
          entry_mode: string | null
          id: string
          is_split_entry: boolean | null
          items_detail: string | null
          market_laborer_count: number | null
          market_laborer_snacks_amount: number | null
          market_laborer_tea_amount: number | null
          market_laborer_total: number | null
          nonworking_laborer_count: number | null
          nonworking_laborer_total: number | null
          notes: string | null
          num_people: number | null
          num_rounds: number | null
          percentage_split: Json | null
          simple_total_cost: number | null
          site_id: string | null
          snacks_items: Json | null
          snacks_total: number | null
          split_percentage: number | null
          split_source_entry_id: string | null
          split_target_site_id: string | null
          tea_people_count: number | null
          tea_rate_per_round: number | null
          tea_rounds: number | null
          tea_shop_id: string
          tea_total: number | null
          team_id: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          updated_by_user_id: string | null
          working_laborer_count: number | null
          working_laborer_total: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          entered_by?: string | null
          entry_mode?: string | null
          id?: string
          is_split_entry?: boolean | null
          items_detail?: string | null
          market_laborer_count?: number | null
          market_laborer_snacks_amount?: number | null
          market_laborer_tea_amount?: number | null
          market_laborer_total?: number | null
          nonworking_laborer_count?: number | null
          nonworking_laborer_total?: number | null
          notes?: string | null
          num_people?: number | null
          num_rounds?: number | null
          percentage_split?: Json | null
          simple_total_cost?: number | null
          site_id?: string | null
          snacks_items?: Json | null
          snacks_total?: number | null
          split_percentage?: number | null
          split_source_entry_id?: string | null
          split_target_site_id?: string | null
          tea_people_count?: number | null
          tea_rate_per_round?: number | null
          tea_rounds?: number | null
          tea_shop_id: string
          tea_total?: number | null
          team_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          working_laborer_count?: number | null
          working_laborer_total?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          entered_by?: string | null
          entry_mode?: string | null
          id?: string
          is_split_entry?: boolean | null
          items_detail?: string | null
          market_laborer_count?: number | null
          market_laborer_snacks_amount?: number | null
          market_laborer_tea_amount?: number | null
          market_laborer_total?: number | null
          nonworking_laborer_count?: number | null
          nonworking_laborer_total?: number | null
          notes?: string | null
          num_people?: number | null
          num_rounds?: number | null
          percentage_split?: Json | null
          simple_total_cost?: number | null
          site_id?: string | null
          snacks_items?: Json | null
          snacks_total?: number | null
          split_percentage?: number | null
          split_source_entry_id?: string | null
          split_target_site_id?: string | null
          tea_people_count?: number | null
          tea_rate_per_round?: number | null
          tea_rounds?: number | null
          tea_shop_id?: string
          tea_total?: number | null
          team_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_by_user_id?: string | null
          working_laborer_count?: number | null
          working_laborer_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_entries_split_source_entry_id_fkey"
            columns: ["split_source_entry_id"]
            isOneToOne: false
            referencedRelation: "tea_shop_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_entries_split_target_site_id_fkey"
            columns: ["split_target_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_entries_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "tea_shop_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_entries_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "v_tea_shop_weekly"
            referencedColumns: ["tea_shop_id"]
          },
          {
            foreignKeyName: "tea_shop_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tea_shop_entries_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tea_shop_settlements: {
        Row: {
          amount_paid: number
          balance_remaining: number | null
          created_at: string | null
          entries_total: number
          id: string
          is_engineer_settled: boolean | null
          notes: string | null
          payer_type: string
          payment_date: string
          payment_mode: string
          period_end: string
          period_start: string
          previous_balance: number | null
          recorded_by: string | null
          recorded_by_user_id: string | null
          site_engineer_id: string | null
          site_engineer_transaction_id: string | null
          status: string | null
          subcontract_id: string | null
          tea_shop_id: string
          total_due: number
          updated_at: string | null
        }
        Insert: {
          amount_paid: number
          balance_remaining?: number | null
          created_at?: string | null
          entries_total: number
          id?: string
          is_engineer_settled?: boolean | null
          notes?: string | null
          payer_type: string
          payment_date: string
          payment_mode: string
          period_end: string
          period_start: string
          previous_balance?: number | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          site_engineer_id?: string | null
          site_engineer_transaction_id?: string | null
          status?: string | null
          subcontract_id?: string | null
          tea_shop_id: string
          total_due: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_remaining?: number | null
          created_at?: string | null
          entries_total?: number
          id?: string
          is_engineer_settled?: boolean | null
          notes?: string | null
          payer_type?: string
          payment_date?: string
          payment_mode?: string
          period_end?: string
          period_start?: string
          previous_balance?: number | null
          recorded_by?: string | null
          recorded_by_user_id?: string | null
          site_engineer_id?: string | null
          site_engineer_transaction_id?: string | null
          status?: string | null
          subcontract_id?: string | null
          tea_shop_id?: string
          total_due?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_settlements_site_engineer_id_fkey"
            columns: ["site_engineer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_settlements_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_settlements_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "tea_shop_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tea_shop_settlements_tea_shop_id_fkey"
            columns: ["tea_shop_id"]
            isOneToOne: false
            referencedRelation: "v_tea_shop_weekly"
            referencedColumns: ["tea_shop_id"]
          },
        ]
      }
      team_salary_summaries: {
        Row: {
          balance_due: number
          created_at: string
          grand_total: number
          id: string
          role_breakdown: Json | null
          status: Database["public"]["Enums"]["salary_status"]
          team_id: string
          total_additions: number
          total_days_worked: number
          total_deductions: number
          total_expenses: number
          total_gross_earnings: number
          total_laborers: number
          total_net_payable: number
          total_paid: number
          updated_at: string
          week_ending: string
        }
        Insert: {
          balance_due?: number
          created_at?: string
          grand_total?: number
          id?: string
          role_breakdown?: Json | null
          status?: Database["public"]["Enums"]["salary_status"]
          team_id: string
          total_additions?: number
          total_days_worked?: number
          total_deductions?: number
          total_expenses?: number
          total_gross_earnings?: number
          total_laborers?: number
          total_net_payable?: number
          total_paid?: number
          updated_at?: string
          week_ending: string
        }
        Update: {
          balance_due?: number
          created_at?: string
          grand_total?: number
          id?: string
          role_breakdown?: Json | null
          status?: Database["public"]["Enums"]["salary_status"]
          team_id?: string
          total_additions?: number
          total_days_worked?: number
          total_deductions?: number
          total_expenses?: number
          total_gross_earnings?: number
          total_laborers?: number
          total_net_payable?: number
          total_paid?: number
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_salary_summaries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_salary_summaries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_address: string | null
          leader_name: string
          leader_phone: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["team_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_address?: string | null
          leader_name: string
          leader_phone?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_address?: string | null
          leader_name?: string
          leader_phone?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          assigned_sites: string[] | null
          auth_id: string | null
          avatar_url: string | null
          created_at: string
          date_format: string | null
          display_name: string | null
          email: string
          email_notifications: boolean | null
          id: string
          job_title: string | null
          last_login_at: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          theme_preference: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          assigned_sites?: string[] | null
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          date_format?: string | null
          display_name?: string | null
          email: string
          email_notifications?: boolean | null
          id?: string
          job_title?: string | null
          last_login_at?: string | null
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          theme_preference?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          assigned_sites?: string[] | null
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          date_format?: string | null
          display_name?: string | null
          email?: string
          email_notifications?: boolean | null
          id?: string
          job_title?: string | null
          last_login_at?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          theme_preference?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendor_material_categories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          vendor_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          vendor_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_material_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_material_categories_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_price_history: {
        Row: {
          created_at: string | null
          effective_date: string
          id: string
          material_vendor_id: string
          new_price: number
          old_price: number
          reason: string | null
          recorded_by: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string
          id?: string
          material_vendor_id: string
          new_price: number
          old_price: number
          reason?: string | null
          recorded_by?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          id?: string
          material_vendor_id?: string
          new_price?: number
          old_price?: number
          reason?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_history_material_vendor_id_fkey"
            columns: ["material_vendor_id"]
            isOneToOne: false
            referencedRelation: "material_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          alternate_phone: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          code: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          pan_number: string | null
          payment_terms_days: number | null
          phone: string | null
          pincode: string | null
          rating: number | null
          state: string | null
          updated_at: string | null
          updated_by: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          alternate_phone?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          pan_number?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          rating?: number | null
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          alternate_phone?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          pan_number?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          rating?: number | null
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      payer_expense_summary: {
        Row: {
          expense_count: number | null
          first_expense_date: string | null
          is_active: boolean | null
          last_expense_date: string | null
          payer_id: string | null
          payer_name: string | null
          phone: string | null
          site_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_payers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_attendance: {
        Row: {
          category_name: string | null
          contract_id: string | null
          created_at: string | null
          daily_earnings: number | null
          daily_log_id: string | null
          daily_rate_applied: number | null
          date: string | null
          deleted_at: string | null
          deleted_by: string | null
          end_time: string | null
          entered_by: string | null
          hours_worked: number | null
          id: string | null
          is_deleted: boolean | null
          is_verified: boolean | null
          laborer_id: string | null
          laborer_name: string | null
          laborer_phone: string | null
          role_name: string | null
          section_id: string | null
          section_name: string | null
          site_id: string | null
          site_name: string | null
          start_time: string | null
          task_completed: string | null
          team_id: string | null
          team_leader: string | null
          team_name: string | null
          updated_at: string | null
          verified_by: string | null
          work_days: number | null
          work_description: string | null
          work_variance: Database["public"]["Enums"]["work_variance"] | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_attendance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "daily_attendance_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "daily_attendance_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_low_stock_alerts: {
        Row: {
          avg_unit_cost: number | null
          current_qty: number | null
          id: string | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          reorder_level: number | null
          shortage_qty: number | null
          site_id: string | null
          site_name: string | null
          unit: Database["public"]["Enums"]["material_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_material_usage_by_section: {
        Row: {
          first_usage: string | null
          last_usage: string | null
          material_id: string | null
          material_name: string | null
          section_id: string | null
          section_name: string | null
          site_id: string | null
          total_cost: number | null
          total_quantity: number | null
          unit: Database["public"]["Enums"]["material_unit"] | null
          usage_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "daily_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_site_stock_summary"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "daily_material_usage_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_material_usage_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "daily_material_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pending_advances: {
        Row: {
          laborer_id: string | null
          pending_amount: number | null
          pending_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advances_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pending_deletions: {
        Row: {
          created_at: string | null
          executed_at: string | null
          id: string | null
          reason: string | null
          record_id: string | null
          record_summary: string | null
          requested_at: string | null
          requested_by: string | null
          requested_by_name: string | null
          requested_by_role: Database["public"]["Enums"]["user_role"] | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deletion_request_status"] | null
          table_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pending_purchase_orders: {
        Row: {
          created_by: string | null
          created_by_name: string | null
          expected_delivery_date: string | null
          id: string | null
          order_date: string | null
          po_number: string | null
          site_id: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          total_amount: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_salary_periods_detailed: {
        Row: {
          advance_deductions: number | null
          amount_paid: number | null
          balance_due: number | null
          calculated_at: string | null
          calculated_by: string | null
          category_name: string | null
          created_at: string | null
          extras: number | null
          gross_earnings: number | null
          id: string | null
          laborer_id: string | null
          laborer_name: string | null
          laborer_phone: string | null
          net_payable: number | null
          notes: string | null
          other_additions: number | null
          other_deductions: number | null
          role_name: string | null
          site_breakdown: Json | null
          status: Database["public"]["Enums"]["salary_status"] | null
          team_leader: string | null
          team_name: string | null
          total_additions: number | null
          total_days_worked: number | null
          total_deductions: number | null
          total_hours_worked: number | null
          updated_at: string | null
          week_ending: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_periods_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_periods_laborer_id_fkey"
            columns: ["laborer_id"]
            isOneToOne: false
            referencedRelation: "laborers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_section_cost_by_role: {
        Row: {
          category_name: string | null
          laborer_count: number | null
          role_id: string | null
          role_name: string | null
          section_id: string | null
          section_name: string | null
          site_id: string | null
          total_amount: number | null
          total_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "building_sections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "building_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_section_cost_summary"
            referencedColumns: ["section_id"]
          },
        ]
      }
      v_section_cost_summary: {
        Row: {
          expense_cost: number | null
          labor_cost: number | null
          section_id: string | null
          section_name: string | null
          sequence_order: number | null
          site_id: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["section_status"] | null
          total_cost: number | null
          total_work_days: number | null
          unique_laborers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "building_sections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_site_daily_by_category: {
        Row: {
          category_id: string | null
          category_name: string | null
          date: string | null
          laborer_count: number | null
          site_id: string | null
          total_amount: number | null
          total_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_attendance_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_site_daily_summary: {
        Row: {
          date: string | null
          site_id: string | null
          site_name: string | null
          total_earnings: number | null
          total_laborers: number | null
          total_work_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_attendance_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_site_stock_summary: {
        Row: {
          avg_cost: number | null
          category_name: string | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          site_id: string | null
          site_name: string | null
          total_available: number | null
          total_qty: number | null
          total_reserved: number | null
          total_value: number | null
          unit: Database["public"]["Enums"]["material_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tea_shop_weekly: {
        Row: {
          num_days: number | null
          shop_name: string | null
          site_id: string | null
          tea_shop_id: string | null
          total_amount: number | null
          total_people: number | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tea_shop_accounts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_team_weekly_by_role: {
        Row: {
          laborer_count: number | null
          role_id: string | null
          role_name: string | null
          team_id: string | null
          team_name: string | null
          total_amount: number | null
          total_days: number | null
          week_ending: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laborers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laborers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_weekly_summary"
            referencedColumns: ["team_id"]
          },
        ]
      }
      v_team_weekly_summary: {
        Row: {
          active_members: number | null
          leader_name: string | null
          team_id: string | null
          team_name: string | null
          total_advances: number | null
          total_earnings: number | null
          total_expenses: number | null
          total_work_days: number | null
          week_ending: string | null
        }
        Relationships: []
      }
      v_unread_notifications: {
        Row: {
          unread_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_deletion: {
        Args: {
          p_request_id: string
          p_review_notes?: string
          p_reviewed_by: string
        }
        Returns: boolean
      }
      calculate_salary_period: {
        Args: {
          p_calculated_by?: string
          p_laborer_id: string
          p_week_ending: string
        }
        Returns: string
      }
      can_access_site: { Args: { p_site_id: string }; Returns: boolean }
      copy_default_sections_to_site: {
        Args: { p_site_id: string }
        Returns: number
      }
      create_audit_log: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_changed_by?: string
          p_new_data?: Json
          p_notes?: string
          p_old_data?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      generate_grn_number: { Args: never; Returns: string }
      generate_mr_number: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      generate_transfer_number: { Args: never; Returns: string }
      generate_weekly_notifications: { Args: never; Returns: number }
      get_current_user_id: { Args: never; Returns: string }
      get_monthly_report: {
        Args: { p_month: number; p_site_id: string; p_year: number }
        Returns: Json
      }
      get_site_dashboard: {
        Args: { p_date?: string; p_site_id: string }
        Returns: Json
      }
      get_site_dashboard_detailed: {
        Args: { p_date?: string; p_site_id: string }
        Returns: Json
      }
      get_team_weekly_summary: {
        Args: { p_team_id: string; p_week_ending: string }
        Returns: Json
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_week_attendance_summary: {
        Args: { p_site_id: string; p_week_ending: string }
        Returns: {
          category_name: string
          extras: number
          laborer_id: string
          laborer_name: string
          laborer_phone: string
          net_payable: number
          pending_advances: number
          role_name: string
          team_id: string
          team_name: string
          total_days: number
          total_earnings: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      reject_deletion: {
        Args: {
          p_request_id: string
          p_review_notes?: string
          p_reviewed_by: string
        }
        Returns: boolean
      }
      request_deletion: {
        Args: {
          p_reason?: string
          p_record_id: string
          p_requested_by: string
          p_table_name: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      audit_action: "create" | "update" | "delete" | "soft_delete" | "restore"
      contract_payment_type:
        | "weekly_advance"
        | "milestone"
        | "part_payment"
        | "final_settlement"
      contract_status:
        | "draft"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      contract_type: "mesthri" | "specialist"
      deduction_status: "pending" | "partial" | "deducted" | "written_off"
      deletion_request_status: "pending" | "approved" | "rejected"
      delivery_status:
        | "pending"
        | "in_transit"
        | "partial"
        | "delivered"
        | "rejected"
      employment_type: "daily_wage" | "contract" | "specialist"
      expense_module: "labor" | "material" | "machinery" | "general"
      laborer_status: "active" | "inactive"
      material_request_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "ordered"
        | "partial_fulfilled"
        | "fulfilled"
        | "cancelled"
      material_unit:
        | "kg"
        | "g"
        | "ton"
        | "liter"
        | "ml"
        | "piece"
        | "bag"
        | "bundle"
        | "sqft"
        | "sqm"
        | "cft"
        | "cum"
        | "nos"
        | "rmt"
        | "box"
        | "set"
      measurement_unit: "sqft" | "rft" | "nos" | "lumpsum" | "per_point"
      milestone_status: "pending" | "in_progress" | "completed" | "paid"
      payment_mode: "cash" | "upi" | "bank_transfer" | "cheque" | "other"
      po_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "ordered"
        | "partial_delivered"
        | "delivered"
        | "cancelled"
      salary_status: "draft" | "calculated" | "partial" | "paid"
      section_status: "not_started" | "in_progress" | "completed"
      site_status: "planning" | "active" | "on_hold" | "completed"
      site_type: "single_client" | "multi_client"
      stock_transaction_type:
        | "purchase"
        | "usage"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "return"
        | "wastage"
        | "initial"
      team_status: "active" | "inactive" | "completed"
      transaction_type: "advance" | "extra"
      user_role: "admin" | "office" | "site_engineer"
      user_status: "active" | "inactive" | "suspended"
      work_days_value: "0.5" | "1" | "1.5" | "2"
      work_variance: "overtime" | "standard" | "undertime"
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
      audit_action: ["create", "update", "delete", "soft_delete", "restore"],
      contract_payment_type: [
        "weekly_advance",
        "milestone",
        "part_payment",
        "final_settlement",
      ],
      contract_status: ["draft", "active", "on_hold", "completed", "cancelled"],
      contract_type: ["mesthri", "specialist"],
      deduction_status: ["pending", "partial", "deducted", "written_off"],
      deletion_request_status: ["pending", "approved", "rejected"],
      delivery_status: [
        "pending",
        "in_transit",
        "partial",
        "delivered",
        "rejected",
      ],
      employment_type: ["daily_wage", "contract", "specialist"],
      expense_module: ["labor", "material", "machinery", "general"],
      laborer_status: ["active", "inactive"],
      material_request_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "ordered",
        "partial_fulfilled",
        "fulfilled",
        "cancelled",
      ],
      material_unit: [
        "kg",
        "g",
        "ton",
        "liter",
        "ml",
        "piece",
        "bag",
        "bundle",
        "sqft",
        "sqm",
        "cft",
        "cum",
        "nos",
        "rmt",
        "box",
        "set",
      ],
      measurement_unit: ["sqft", "rft", "nos", "lumpsum", "per_point"],
      milestone_status: ["pending", "in_progress", "completed", "paid"],
      payment_mode: ["cash", "upi", "bank_transfer", "cheque", "other"],
      po_status: [
        "draft",
        "pending_approval",
        "approved",
        "ordered",
        "partial_delivered",
        "delivered",
        "cancelled",
      ],
      salary_status: ["draft", "calculated", "partial", "paid"],
      section_status: ["not_started", "in_progress", "completed"],
      site_status: ["planning", "active", "on_hold", "completed"],
      site_type: ["single_client", "multi_client"],
      stock_transaction_type: [
        "purchase",
        "usage",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "return",
        "wastage",
        "initial",
      ],
      team_status: ["active", "inactive", "completed"],
      transaction_type: ["advance", "extra"],
      user_role: ["admin", "office", "site_engineer"],
      user_status: ["active", "inactive", "suspended"],
      work_days_value: ["0.5", "1", "1.5", "2"],
      work_variance: ["overtime", "standard", "undertime"],
    },
  },
} as const

// ============================================
// Helper Type Exports for convenience
// ============================================

// Table Row types
export type Expense = Database["public"]["Tables"]["expenses"]["Row"]
export type SitePayer = Database["public"]["Tables"]["site_payers"]["Row"]
export type Site = Database["public"]["Tables"]["sites"]["Row"]
export type User = Database["public"]["Tables"]["users"]["Row"]
export type Laborer = Database["public"]["Tables"]["laborers"]["Row"]
export type Team = Database["public"]["Tables"]["teams"]["Row"]
export type DailyAttendance = Database["public"]["Tables"]["daily_attendance"]["Row"]
export type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"]
export type BuildingSection = Database["public"]["Tables"]["building_sections"]["Row"]
export type ConstructionPhase = Database["public"]["Tables"]["construction_phases"]["Row"]
export type Subcontract = Database["public"]["Tables"]["subcontracts"]["Row"]
export type LaborPayment = Database["public"]["Tables"]["labor_payments"]["Row"]
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"]
export type Material = Database["public"]["Tables"]["materials"]["Row"]

// Enum types
export type ExpenseModule = Database["public"]["Enums"]["expense_module"]
export type PaymentMode = Database["public"]["Enums"]["payment_mode"]
export type SiteStatus = Database["public"]["Enums"]["site_status"]
export type SiteType = Database["public"]["Enums"]["site_type"]
export type UserRole = Database["public"]["Enums"]["user_role"]
export type LaborerStatus = Database["public"]["Enums"]["laborer_status"]
export type EmploymentType = Database["public"]["Enums"]["employment_type"]
export type ContractStatus = Database["public"]["Enums"]["contract_status"]
export type ContractType = Database["public"]["Enums"]["contract_type"]
export type SectionStatus = Database["public"]["Enums"]["section_status"]
export type MaterialUnit = Database["public"]["Enums"]["material_unit"]
export type MeasurementUnit = Database["public"]["Enums"]["measurement_unit"]
export type POStatus = Database["public"]["Enums"]["po_status"]
export type MaterialRequestStatus = Database["public"]["Enums"]["material_request_status"]
export type PaymentType = Database["public"]["Enums"]["contract_payment_type"]
export type TransactionType = Database["public"]["Enums"]["transaction_type"]

// Site engineer related types
export type SiteEngineerTransaction = Database["public"]["Tables"]["site_engineer_transactions"]["Row"]
export type SiteEngineerSettlement = Database["public"]["Tables"]["site_engineer_settlements"]["Row"]
export type SiteEngineerTransactionType = "received_from_company" | "spent_on_behalf" | "used_own_money" | "returned_to_company"
export type RecipientType = "laborer" | "mesthri" | "vendor" | "other"
export type SalaryPeriod = Database["public"]["Tables"]["salary_periods"]["Row"]
export type ConstructionSubphase = Database["public"]["Tables"]["construction_subphases"]["Row"]
export type SitePaymentMilestone = Database["public"]["Tables"]["site_payment_milestones"]["Row"]
export type LaborerType = string | null
export type TeaShopAccount = Database["public"]["Tables"]["tea_shop_accounts"]["Row"]
export type DailyWorkSummary = Database["public"]["Tables"]["daily_work_summary"]["Row"]
export type ClientPaymentPlan = Database["public"]["Tables"]["client_payment_plans"]["Row"]
export type PaymentPhase = Database["public"]["Tables"]["payment_phases"]["Row"]
export type ClientPayment = Database["public"]["Tables"]["client_payments"]["Row"]
export type SiteHoliday = Database["public"]["Tables"]["site_holidays"]["Row"]
export type PaymentChannel = string | null
export type TeaShopEntry = Database["public"]["Tables"]["tea_shop_entries"]["Row"]
export type TeaShopSettlement = Database["public"]["Tables"]["tea_shop_settlements"]["Row"]
export type TeaShopEntryExtended = TeaShopEntry & {
  laborer_name?: string;
  team_name?: string;
  entry_mode?: string | null;
}
export type ThemePreference = "light" | "dark" | "system"

// UI helper types
export interface LaborGroupPercentageSplit {
  daily: number;
  contract: number;
  market: number;
}

export interface SnackItem {
  name: string;
  quantity: number;
  rate: number;
  total: number;
}

export type TeaShopEntryMode = "simple" | "detailed"
export type MarketLaborerAttendance = Database["public"]["Tables"]["market_laborer_attendance"]["Row"]
