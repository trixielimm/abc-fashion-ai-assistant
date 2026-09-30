export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      style_profiles: {
        Row: { user_id: string; preferred_name: string; updated_at: string }
        Insert: { user_id: string; preferred_name?: string; updated_at?: string }
        Update: { user_id?: string; preferred_name?: string; updated_at?: string }
        Relationships: []
      }
      style_sizes: {
        Row: { user_id: string; item_type: string; size_system: string; size_label: string; updated_at: string }
        Insert: { user_id: string; item_type: string; size_system: string; size_label: string; updated_at?: string }
        Update: { user_id?: string; item_type?: string; size_system?: string; size_label?: string; updated_at?: string }
        Relationships: []
      }
      style_memories: {
        Row: { id: string; user_id: string; kind: string; facet: string; value: string; item_scope: string | null; created_at: string }
        Insert: { id?: string; user_id: string; kind: string; facet: string; value: string; item_scope?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; kind?: string; facet?: string; value?: string; item_scope?: string | null; created_at?: string }
        Relationships: []
      }
      saved_products: {
        Row: { user_id: string; product_id: string; created_at: string }
        Insert: { user_id: string; product_id: string; created_at?: string }
        Update: { user_id?: string; product_id?: string; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: {
          category_id: number
          category_name: string
        }
        Insert: {
          category_id?: never
          category_name: string
        }
        Update: {
          category_id?: never
          category_name?: string
        }
        Relationships: []
      }
      cross_sell_rules: {
        Row: {
          cross_sell_id: number
          priority: number
          product_id: string
          target_category_id: number
        }
        Insert: {
          cross_sell_id?: never
          priority?: number
          product_id: string
          target_category_id: number
        }
        Update: {
          cross_sell_id?: never
          priority?: number
          product_id?: string
          target_category_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cross_sell_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "cross_sell_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "cross_sell_rules_target_category_id_fkey"
            columns: ["target_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          product_id: string
          size_id: number
          stock_qty: number
        }
        Insert: {
          product_id: string
          size_id: number
          stock_qty?: number
        }
        Update: {
          product_id?: string
          size_id?: number
          stock_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_sizes_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["size_id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: number
        }
        Insert: {
          product_id: string
          tag_id: number
        }
        Update: {
          product_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      product_types: {
        Row: {
          product_type_id: number
          product_type_name: string
          subcategory_id: number
        }
        Insert: {
          product_type_id?: never
          product_type_name: string
          subcategory_id: number
        }
        Update: {
          product_type_id?: never
          product_type_name?: string
          subcategory_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_types_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["subcategory_id"]
          },
        ]
      }
      products: {
        Row: {
          brand_line: string | null
          colour: string | null
          created_at: string
          description: string | null
          embedding_vector: string | null
          fit: string | null
          gender: string | null
          image_key: string | null
          is_available: boolean
          material: string | null
          occasion: string | null
          price_aud: number
          product_id: string
          product_name: string
          product_type_id: number
          season: string | null
          style: string | null
          updated_at: string
        }
        Insert: {
          brand_line?: string | null
          colour?: string | null
          created_at?: string
          description?: string | null
          embedding_vector?: string | null
          fit?: string | null
          gender?: string | null
          image_key?: string | null
          is_available?: boolean
          material?: string | null
          occasion?: string | null
          price_aud: number
          product_id: string
          product_name: string
          product_type_id: number
          season?: string | null
          style?: string | null
          updated_at?: string
        }
        Update: {
          brand_line?: string | null
          colour?: string | null
          created_at?: string
          description?: string | null
          embedding_vector?: string | null
          fit?: string | null
          gender?: string | null
          image_key?: string | null
          is_available?: boolean
          material?: string | null
          occasion?: string | null
          price_aud?: number
          product_id?: string
          product_name?: string
          product_type_id?: number
          season?: string | null
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["product_type_id"]
          },
        ]
      }
      sizes: {
        Row: {
          size_id: number
          size_label: string
          size_order: number
        }
        Insert: {
          size_id?: never
          size_label: string
          size_order: number
        }
        Update: {
          size_id?: never
          size_label?: string
          size_order?: number
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: number
          subcategory_id: number
          subcategory_name: string
        }
        Insert: {
          category_id: number
          subcategory_id?: never
          subcategory_name: string
        }
        Update: {
          category_id?: number
          subcategory_id?: never
          subcategory_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      tags: {
        Row: {
          tag_id: number
          tag_name: string
        }
        Insert: {
          tag_id?: never
          tag_name: string
        }
        Update: {
          tag_id?: never
          tag_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_catalog: {
        Row: {
          brand_line: string | null
          category: string | null
          colour: string | null
          cross_sell_category: string | null
          description: string | null
          fit: string | null
          gender: string | null
          image_key: string | null
          is_available: boolean | null
          material: string | null
          occasion: string | null
          price_aud: number | null
          product_id: string | null
          product_name: string | null
          product_type: string | null
          season: string | null
          sizes_available: string[] | null
          stock_qty: number | null
          style: string | null
          subcategory: string | null
          tags: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      match_products: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          brand_line: string
          category: string
          colour: string
          cross_sell_category: string
          description: string
          fit: string
          gender: string
          image_key: string
          is_available: boolean
          material: string
          occasion: string
          price_aud: number
          product_id: string
          product_name: string
          product_type: string
          season: string
          similarity: number
          sizes_available: string[]
          stock_qty: number
          style: string
          subcategory: string
          tags: string[]
        }[]
      }
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
    Enums: {},
  },
} as const
