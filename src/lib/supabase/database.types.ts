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
      checklist_items: {
        Row: {
          category: string | null
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          label: string
          sort: number
          trip_id: string
        }
        Insert: {
          category?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          label: string
          sort?: number
          trip_id: string
        }
        Update: {
          category?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          label?: string
          sort?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          label: string
          sort: number
          template_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          label: string
          sort?: number
          template_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          sort?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          crew_id: string
          expires_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          crew_id: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          crew_id?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_invites_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          created_at: string
          crew_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          stats: Json
          status: string
          trigger: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          status?: string
          trigger: string
          trip_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          status?: string
          trigger?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          created_at: string
          ends_at: string | null
          fetched_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          source: string
          source_id: string
          starts_at: string
          url: string | null
          venue_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          ends_at?: string | null
          fetched_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          source: string
          source_id: string
          starts_at: string
          url?: string | null
          venue_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          ends_at?: string | null
          fetched_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          source?: string
          source_id?: string
          starts_at?: string
          url?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      places: {
        Row: {
          category: string
          created_at: string
          fetched_at: string
          id: string
          lat: number
          lng: number
          name: string
          opening_hours: string | null
          phone: string | null
          source: string
          source_id: string
          tags: Json
          website: string | null
        }
        Insert: {
          category: string
          created_at?: string
          fetched_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          opening_hours?: string | null
          phone?: string | null
          source: string
          source_id: string
          tags?: Json
          website?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          fetched_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          opening_hours?: string | null
          phone?: string | null
          source?: string
          source_id?: string
          tags?: Json
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      source_fetches: {
        Row: {
          cache_key: string
          fetched_at: string
          item_count: number
          source: string
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          item_count?: number
          source: string
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          item_count?: number
          source?: string
        }
        Relationships: []
      }
      trip_recommendations: {
        Row: {
          created_at: string
          dismissed: boolean
          distance_m: number | null
          item_id: string
          item_type: string
          last_run_id: string | null
          open_on_trip_date: boolean | null
          pinned: boolean
          reasons: Json
          score: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          distance_m?: number | null
          item_id: string
          item_type: string
          last_run_id?: string | null
          open_on_trip_date?: boolean | null
          pinned?: boolean
          reasons?: Json
          score: number
          trip_id: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean
          distance_m?: number | null
          item_id?: string
          item_type?: string
          last_run_id?: string | null
          open_on_trip_date?: boolean | null
          pinned?: boolean
          reasons?: Json
          score?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_recommendations_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string | null
          crew_id: string
          discovery_radius_m: number
          id: string
          last_discovered_at: string | null
          name: string
          next_refresh_at: string | null
          status: string
          trail_name: string | null
          trail_url: string | null
          trailhead_lat: number | null
          trailhead_lng: number | null
          trailhead_town: string | null
          trip_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crew_id: string
          discovery_radius_m?: number
          id?: string
          last_discovered_at?: string | null
          name: string
          next_refresh_at?: string | null
          status?: string
          trail_name?: string | null
          trail_url?: string | null
          trailhead_lat?: number | null
          trailhead_lng?: number | null
          trailhead_town?: string | null
          trip_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crew_id?: string
          discovery_radius_m?: number
          id?: string
          last_discovered_at?: string | null
          name?: string
          next_refresh_at?: string | null
          status?: string
          trail_name?: string | null
          trail_url?: string | null
          trailhead_lat?: number | null
          trailhead_lng?: number | null
          trailhead_town?: string | null
          trip_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_snapshots: {
        Row: {
          created_at: string
          daily: Json
          fetched_at: string
          hourly: Json
          id: string
          run_id: string | null
          summary: Json
          trip_id: string
        }
        Insert: {
          created_at?: string
          daily: Json
          fetched_at?: string
          hourly: Json
          id?: string
          run_id?: string | null
          summary?: Json
          trip_id: string
        }
        Update: {
          created_at?: string
          daily?: Json
          fetched_at?: string
          hourly?: Json
          id?: string
          run_id?: string | null
          summary?: Json
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_snapshots_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trip_recommendation_details: {
        Row: {
          category: string | null
          dismissed: boolean | null
          distance_m: number | null
          item_id: string | null
          item_type: string | null
          last_run_id: string | null
          lat: number | null
          lng: number | null
          name: string | null
          open_on_trip_date: boolean | null
          opening_hours: string | null
          pinned: boolean | null
          reasons: Json | null
          score: number | null
          starts_at: string | null
          trip_id: string | null
          url: string | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_recommendations_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_checklist_template: {
        Args: { p_template_id: string; p_trip_id: string }
        Returns: {
          category: string | null
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          label: string
          sort: number
          trip_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "checklist_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_user_defaults: {
        Args: { p_email: string; p_meta: Json; p_user_id: string }
        Returns: undefined
      }
      is_crew_member: { Args: { p_crew_id: string }; Returns: boolean }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
      redeem_crew_invite: { Args: { p_code: string }; Returns: string }
      shares_crew_with: { Args: { p_user_id: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
