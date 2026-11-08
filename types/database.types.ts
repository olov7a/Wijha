/**
 * Hand-maintained until `supabase gen types typescript` can run against a
 * migrated database. It mirrors every column created by the B1/B2 migrations
 * plus the Phase C RPCs, so queries and actions stay fully typed meanwhile.
 *
 * When the migrations are applied, replace this file with the generated output;
 * the exported `UserRole` alias is the only extra the app relies on.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "student" | "owner" | "team" | "leader" | "admin";

type Timestamp = string;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          phone: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          phone?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          phone?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: boolean;
          commission_rate: number;
          currency: string;
          updated_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: boolean;
          commission_rate?: number;
          currency?: string;
          updated_by?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: boolean;
          commission_rate?: number;
          currency?: string;
          updated_by?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          user_id: string;
          gender: Database["public"]["Enums"]["gender_type"];
          university: string | null;
          study_year: number | null;
          is_smoker: boolean;
          hobbies: string[];
          id_document_path: string | null;
          university_card_path: string | null;
          verification_status: Database["public"]["Enums"]["moderation_status"];
          budget_min_piastres: number | null;
          budget_max_piastres: number | null;
          preferred_areas: string[];
          preferred_amenities: string[];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          user_id: string;
          gender: Database["public"]["Enums"]["gender_type"];
          university?: string | null;
          study_year?: number | null;
          is_smoker?: boolean;
          hobbies?: string[];
          id_document_path?: string | null;
          university_card_path?: string | null;
          verification_status?: Database["public"]["Enums"]["moderation_status"];
          budget_min_piastres?: number | null;
          budget_max_piastres?: number | null;
          preferred_areas?: string[];
          preferred_amenities?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          user_id?: string;
          gender?: Database["public"]["Enums"]["gender_type"];
          university?: string | null;
          study_year?: number | null;
          is_smoker?: boolean;
          hobbies?: string[];
          id_document_path?: string | null;
          university_card_path?: string | null;
          verification_status?: Database["public"]["Enums"]["moderation_status"];
          budget_min_piastres?: number | null;
          budget_max_piastres?: number | null;
          preferred_areas?: string[];
          preferred_amenities?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      owner_profiles: {
        Row: {
          user_id: string;
          id_document_path: string | null;
          ownership_proof_path: string | null;
          verification_status: Database["public"]["Enums"]["moderation_status"];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          user_id: string;
          id_document_path?: string | null;
          ownership_proof_path?: string | null;
          verification_status?: Database["public"]["Enums"]["moderation_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          user_id?: string;
          id_document_path?: string | null;
          ownership_proof_path?: string | null;
          verification_status?: Database["public"]["Enums"]["moderation_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          area: string;
          gender_type: Database["public"]["Enums"]["gender_type"];
          status: Database["public"]["Enums"]["unit_status"];
          description: string | null;
          amenities: string[];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          area: string;
          gender_type: Database["public"]["Enums"]["gender_type"];
          status?: Database["public"]["Enums"]["unit_status"];
          description?: string | null;
          amenities?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          area?: string;
          gender_type?: Database["public"]["Enums"]["gender_type"];
          status?: Database["public"]["Enums"]["unit_status"];
          description?: string | null;
          amenities?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          unit_id: string;
          name: string;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          unit_id: string;
          name: string;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          unit_id?: string;
          name?: string;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      beds: {
        Row: {
          id: string;
          room_id: string;
          label: string;
          price_piastres: number;
          status: Database["public"]["Enums"]["bed_status"];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          label: string;
          price_piastres: number;
          status?: Database["public"]["Enums"]["bed_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          label?: string;
          price_piastres?: number;
          status?: Database["public"]["Enums"]["bed_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      unit_visits: {
        Row: {
          id: string;
          unit_id: string;
          team_member_id: string;
          scheduled_at: Timestamp;
          status: Database["public"]["Enums"]["visit_status"];
          notes: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          unit_id: string;
          team_member_id: string;
          scheduled_at: Timestamp;
          status?: Database["public"]["Enums"]["visit_status"];
          notes?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          unit_id?: string;
          team_member_id?: string;
          scheduled_at?: Timestamp;
          status?: Database["public"]["Enums"]["visit_status"];
          notes?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      unit_evaluations: {
        Row: {
          id: string;
          unit_id: string;
          team_member_id: string;
          visit_id: string;
          checklist: Json;
          score: number;
          photo_paths: string[];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          unit_id: string;
          team_member_id: string;
          visit_id: string;
          checklist?: Json;
          score: number;
          photo_paths?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          unit_id?: string;
          team_member_id?: string;
          visit_id?: string;
          checklist?: Json;
          score?: number;
          photo_paths?: string[];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          student_id: string;
          unit_id: string;
          room_id: string;
          bed_id: string | null;
          move_in_date: string;
          move_out_date: string | null;
          rent_amount_piastres: number;
          commission_rate_snapshot: number;
          commission_amount_piastres: number;
          total_amount_piastres: number;
          status: Database["public"]["Enums"]["booking_status"];
          cancellation_reason: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          unit_id: string;
          room_id: string;
          bed_id?: string | null;
          move_in_date: string;
          move_out_date?: string | null;
          rent_amount_piastres: number;
          commission_rate_snapshot: number;
          commission_amount_piastres: number;
          status?: Database["public"]["Enums"]["booking_status"];
          cancellation_reason?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          unit_id?: string;
          room_id?: string;
          bed_id?: string | null;
          move_in_date?: string;
          move_out_date?: string | null;
          rent_amount_piastres?: number;
          commission_rate_snapshot?: number;
          commission_amount_piastres?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          cancellation_reason?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          amount_piastres: number;
          currency: string;
          method: string;
          gateway_reference: string | null;
          gateway_event_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          failure_reason: string | null;
          paid_at: Timestamp | null;
          expires_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          amount_piastres: number;
          currency?: string;
          method: string;
          gateway_reference?: string | null;
          gateway_event_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          failure_reason?: string | null;
          paid_at?: Timestamp | null;
          expires_at?: Timestamp | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          amount_piastres?: number;
          currency?: string;
          method?: string;
          gateway_reference?: string | null;
          gateway_event_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          failure_reason?: string | null;
          paid_at?: Timestamp | null;
          expires_at?: Timestamp | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          reviewer_id: string;
          target_type: Database["public"]["Enums"]["review_target_type"];
          target_id: string;
          rating: number;
          body: string | null;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          target_type: Database["public"]["Enums"]["review_target_type"];
          target_id: string;
          rating: number;
          body?: string | null;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          reviewer_id?: string;
          target_type?: Database["public"]["Enums"]["review_target_type"];
          target_id?: string;
          rating?: number;
          body?: string | null;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          booking_id: string | null;
          student_id: string;
          owner_id: string;
          status: Database["public"]["Enums"]["contract_status"];
          file_path: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          booking_id?: string | null;
          student_id: string;
          owner_id: string;
          status?: Database["public"]["Enums"]["contract_status"];
          file_path?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          booking_id?: string | null;
          student_id?: string;
          owner_id?: string;
          status?: Database["public"]["Enums"]["contract_status"];
          file_path?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          deleted_at?: Timestamp | null;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          id: number;
          booking_id: string;
          payment_id: string | null;
          from_status: Database["public"]["Enums"]["payment_status"] | null;
          to_status: Database["public"]["Enums"]["payment_status"];
          amount_piastres: number;
          currency: string;
          created_at: Timestamp;
        };
        Insert: {
          booking_id: string;
          payment_id?: string | null;
          from_status?: Database["public"]["Enums"]["payment_status"] | null;
          to_status: Database["public"]["Enums"]["payment_status"];
          amount_piastres: number;
          currency?: string;
          created_at?: Timestamp;
        };
        Update: {
          booking_id?: string;
          payment_id?: string | null;
          from_status?: Database["public"]["Enums"]["payment_status"] | null;
          to_status?: Database["public"]["Enums"]["payment_status"];
          amount_piastres?: number;
          currency?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: Timestamp;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: Timestamp;
        };
        Update: {
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
    };
    Views: {
      unit_listings: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          area: string;
          gender_type: Database["public"]["Enums"]["gender_type"];
          description: string | null;
          amenities: string[];
          status: Database["public"]["Enums"]["unit_status"];
          created_at: Timestamp;
          updated_at: Timestamp;
          rating: number;
          review_count: number;
          room_count: number;
          available_beds: number;
          total_beds: number;
          min_price_piastres: number;
          max_price_piastres: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      // Phase B2 soft delete/restore RPCs.
      soft_delete_unit: { Args: { p_unit_id: string }; Returns: undefined };
      restore_unit: { Args: { p_unit_id: string }; Returns: undefined };
      soft_delete_room: { Args: { p_room_id: string }; Returns: undefined };
      restore_room: { Args: { p_room_id: string }; Returns: undefined };
      soft_delete_bed: { Args: { p_bed_id: string }; Returns: undefined };
      restore_bed: { Args: { p_bed_id: string }; Returns: undefined };
      soft_delete_unit_visit: { Args: { p_visit_id: string }; Returns: undefined };
      restore_unit_visit: { Args: { p_visit_id: string }; Returns: undefined };
      soft_delete_review: { Args: { p_review_id: string }; Returns: undefined };
      restore_review: { Args: { p_review_id: string }; Returns: undefined };

      // Phase C inventory / booking / payment / contract / moderation RPCs.
      create_unit: {
        Args: {
          p_title: string;
          p_area: string;
          p_gender: Database["public"]["Enums"]["gender_type"];
          p_description: string | null;
          p_amenities: string[];
          p_rooms: Json;
        };
        Returns: string;
      };
      create_booking: {
        Args: {
          p_unit_id: string;
          p_room_id: string;
          p_bed_id: string | null;
          p_move_in_date: string;
          p_move_out_date?: string | null;
        };
        Returns: string;
      };
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      confirm_booking_payment: {
        Args: { p_booking_id: string; p_gateway_reference: string };
        Returns: undefined;
      };
      fail_booking_payment: {
        Args: { p_booking_id: string; p_failure_reason: string };
        Returns: undefined;
      };
      request_contract: {
        Args: { p_booking_id: string };
        Returns: string;
      };
      sign_contract: {
        Args: { p_contract_id: string; p_file_path: string };
        Returns: undefined;
      };
      moderate_review: {
        Args: {
          p_review_id: string;
          p_status: Database["public"]["Enums"]["moderation_status"];
        };
        Returns: undefined;
      };
      match_units: {
        Args: { p_limit?: number };
        Returns: {
          unit_id: string;
          title: string;
          area: string;
          gender_type: Database["public"]["Enums"]["gender_type"];
          description: string | null;
          amenities: string[];
          rating: number;
          review_count: number;
          available_beds: number;
          min_price_piastres: number;
          score: number;
        }[];
      };
      owner_bookings: {
        Args: { p_limit?: number };
        Returns: {
          booking_id: string;
          unit_id: string;
          unit_title: string;
          unit_area: string;
          room_name: string | null;
          bed_label: string | null;
          student_name: string | null;
          student_phone: string | null;
          move_in_date: string;
          move_out_date: string | null;
          rent_piastres: number;
          total_piastres: number;
          status: Database["public"]["Enums"]["booking_status"];
          payment_status: Database["public"]["Enums"]["payment_status"] | null;
          contract_id: string | null;
          contract_status: Database["public"]["Enums"]["contract_status"];
          created_at: Timestamp;
        }[];
      };
      admin_set_user_role: {
        Args: {
          p_user_id: string;
          p_role: Database["public"]["Enums"]["app_role"];
        };
        Returns: undefined;
      };
      claim_first_admin: { Args: { p_actor: string }; Returns: undefined };
      refund_booking_payment: { Args: { p_booking_id: string }; Returns: undefined };
      expire_pending_payments: { Args: Record<string, never>; Returns: number };
      admin_find_users: {
        Args: { p_query: string };
        Returns: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at: Timestamp;
        }[];
      };
    };
    Enums: {
      app_role: UserRole;
      gender_type: "male" | "female";
      unit_status: "pending" | "approved" | "rejected";
      bed_status: "available" | "held" | "booked";
      booking_status: "pending_payment" | "confirmed" | "cancelled" | "completed";
      payment_status: "pending" | "paid" | "failed" | "refunded" | "expired";
      review_target_type: "unit" | "student";
      moderation_status: "pending" | "approved" | "rejected";
      contract_status: "not_requested" | "requested" | "signed";
      visit_status: "scheduled" | "completed" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type UnitListing = Database["public"]["Views"]["unit_listings"]["Row"];
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
export type StudentProfileRow = Database["public"]["Tables"]["student_profiles"]["Row"];
export type MatchUnitRow = Database["public"]["Functions"]["match_units"]["Returns"][number];
