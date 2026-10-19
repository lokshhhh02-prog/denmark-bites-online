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
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch_label: string | null
          created_at: string
          id: string
          ifsc: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          branch_label?: string | null
          created_at?: string
          id?: string
          ifsc: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch_label?: string | null
          created_at?: string
          id?: string
          ifsc?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string
          gst_percent: number
          id: number
          is_open: boolean
          name: string
          packing_charge: number
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          gst_percent?: number
          id: number
          is_open?: boolean
          name: string
          packing_charge?: number
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          gst_percent?: number
          id?: number
          is_open?: boolean
          name?: string
          packing_charge?: number
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          branch_id: number
          category: string
          created_at: string
          cuisine: string
          description: string
          id: string
          in_stock: boolean
          name: string
          price: number
          sort: number
        }
        Insert: {
          branch_id: number
          category: string
          created_at?: string
          cuisine?: string
          description?: string
          id?: string
          in_stock?: boolean
          name: string
          price: number
          sort?: number
        }
        Update: {
          branch_id?: number
          category?: string
          created_at?: string
          cuisine?: string
          description?: string
          id?: string
          in_stock?: boolean
          name?: string
          price?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: number
          cancel_token: string
          created_at: string
          customer_name: string
          gst_amount: number
          gst_percent: number
          id: string
          items: Json
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          packing_charge: number
          payment_method: string
          payment_status: string
          phone: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_number: string | null
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: number
          cancel_token?: string
          created_at?: string
          customer_name: string
          gst_amount: number
          gst_percent: number
          id?: string
          items: Json
          order_number?: never
          order_type: Database["public"]["Enums"]["order_type"]
          packing_charge?: number
          payment_method?: string
          payment_status?: string
          phone: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_number?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          branch_id?: number
          cancel_token?: string
          created_at?: string
          customer_name?: string
          gst_amount?: number
          gst_percent?: number
          id?: string
          items?: Json
          order_number?: never
          order_type?: Database["public"]["Enums"]["order_type"]
          packing_charge?: number
          payment_method?: string
          payment_status?: string
          phone?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_number?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          branch_id: number
          created_at: string
          email: string
        }
        Insert: {
          branch_id: number
          created_at?: string
          email: string
        }
        Update: {
          branch_id?: number
          created_at?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: number | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: number | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: number | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_manager: {
        Args: { _branch: number; _email: string }
        Returns: string
      }
      can_manage_branch: {
        Args: { _branch: number; _user_id: string }
        Returns: boolean
      }
      cancel_order_public: {
        Args: { _id: string; _token: string }
        Returns: boolean
      }
      get_order_public: { Args: { _id: string; _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_staff: {
        Args: never
        Returns: {
          branch_id: number
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      place_order:
        | {
            Args: {
              _branch: number
              _items: Json
              _name: string
              _phone: string
              _table: string
              _type: Database["public"]["Enums"]["order_type"]
            }
            Returns: Json
          }
        | {
            Args: {
              _branch: number
              _items: Json
              _name: string
              _payment?: string
              _phone: string
              _table: string
              _type: Database["public"]["Enums"]["order_type"]
            }
            Returns: Json
          }
      remove_manager: {
        Args: { _branch: number; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
      order_type: "dine_in" | "delivery"
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
      app_role: ["owner", "manager"],
      order_status: ["pending", "preparing", "ready", "completed", "cancelled"],
      order_type: ["dine_in", "delivery"],
    },
  },
} as const
