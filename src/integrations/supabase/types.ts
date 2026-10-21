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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_remarks: {
        Row: {
          appointment_id: string
          author_id: string
          created_at: string
          id: string
          objections: string | null
          outcome_at_time: Database["public"]["Enums"]["demo_outcome"] | null
          remark: string
          requested_changes: string | null
        }
        Insert: {
          appointment_id: string
          author_id: string
          created_at?: string
          id?: string
          objections?: string | null
          outcome_at_time?: Database["public"]["Enums"]["demo_outcome"] | null
          remark: string
          requested_changes?: string | null
        }
        Update: {
          appointment_id?: string
          author_id?: string
          created_at?: string
          id?: string
          objections?: string | null
          outcome_at_time?: Database["public"]["Enums"]["demo_outcome"] | null
          remark?: string
          requested_changes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_remarks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_remarks_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booking_agent_id: string
          cancellation_reason: string | null
          client_id: string
          created_at: string
          demo_staff_id: string | null
          demo_website_url: string | null
          duration_minutes: number
          final_website_url: string | null
          follow_up_date: string | null
          id: string
          is_demo: boolean
          local_date: string
          local_time: string
          meeting_url: string
          outcome: Database["public"]["Enums"]["demo_outcome"] | null
          platform: Database["public"]["Enums"]["meeting_platform"]
          sale_amount: number | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_agent_id: string
          cancellation_reason?: string | null
          client_id: string
          created_at?: string
          demo_staff_id?: string | null
          demo_website_url?: string | null
          duration_minutes?: number
          final_website_url?: string | null
          follow_up_date?: string | null
          id?: string
          is_demo?: boolean
          local_date: string
          local_time: string
          meeting_url: string
          outcome?: Database["public"]["Enums"]["demo_outcome"] | null
          platform: Database["public"]["Enums"]["meeting_platform"]
          sale_amount?: number | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone: string
          updated_at?: string
        }
        Update: {
          booking_agent_id?: string
          cancellation_reason?: string | null
          client_id?: string
          created_at?: string
          demo_staff_id?: string | null
          demo_website_url?: string | null
          duration_minutes?: number
          final_website_url?: string | null
          follow_up_date?: string | null
          id?: string
          is_demo?: boolean
          local_date?: string
          local_time?: string
          meeting_url?: string
          outcome?: Database["public"]["Enums"]["demo_outcome"] | null
          platform?: Database["public"]["Enums"]["meeting_platform"]
          sale_amount?: number | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_booking_agent_id_fkey"
            columns: ["booking_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_demo_staff_id_fkey"
            columns: ["demo_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string
          id: number
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          business_name: string
          country: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_demo: boolean
          notes: string | null
          owner_name: string
          phone: string
          timezone: string
          updated_at: string
        }
        Insert: {
          business_name: string
          country: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          owner_name: string
          phone: string
          timezone: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          owner_name?: string
          phone?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "booking_agent" | "demo_staff"
      appointment_status:
        | "scheduled"
        | "rescheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      demo_outcome:
        | "interested"
        | "follow_up_required"
        | "not_interested"
        | "sold"
        | "lost"
      meeting_platform: "zoom" | "google_meet"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "booking_agent", "demo_staff"],
      appointment_status: [
        "scheduled",
        "rescheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      demo_outcome: [
        "interested",
        "follow_up_required",
        "not_interested",
        "sold",
        "lost",
      ],
      meeting_platform: ["zoom", "google_meet"],
    },
  },
} as const
