export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity: string;
          entity_id?: string | null;
          id?: number;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity?: string;
          entity_id?: string | null;
          id?: number;
        };
        Relationships: [];
      };
      admin_bootstrap_emails: {
        Row: {
          email: string;
        };
        Insert: {
          email: string;
        };
        Update: {
          email?: string;
        };
        Relationships: [];
      };
      batch_items: {
        Row: {
          batch_id: string;
          collection_id: string;
          pickup_id: string;
          weight_kg: number;
        };
        Insert: {
          batch_id: string;
          collection_id: string;
          pickup_id: string;
          weight_kg: number;
        };
        Update: {
          batch_id?: string;
          collection_id?: string;
          pickup_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "batch_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batch_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: true;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batch_items_pickup_id_fkey";
            columns: ["pickup_id"];
            isOneToOne: false;
            referencedRelation: "pickups";
            referencedColumns: ["id"];
          },
        ];
      };
      batch_verifications: {
        Row: {
          accepted_kg: number;
          actual_kg: number;
          batch_id: string;
          decision: Database["public"]["Enums"]["batch_decision"];
          grade: string;
          note: string | null;
          rejected_kg: number;
          verified_at: string;
          verified_by: string;
        };
        Insert: {
          accepted_kg: number;
          actual_kg: number;
          batch_id: string;
          decision: Database["public"]["Enums"]["batch_decision"];
          grade: string;
          note?: string | null;
          rejected_kg: number;
          verified_at?: string;
          verified_by: string;
        };
        Update: {
          accepted_kg?: number;
          actual_kg?: number;
          batch_id?: string;
          decision?: Database["public"]["Enums"]["batch_decision"];
          grade?: string;
          note?: string | null;
          rejected_kg?: number;
          verified_at?: string;
          verified_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "batch_verifications_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: true;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
        ];
      };
      batches: {
        Row: {
          created_at: string;
          created_by: string | null;
          handed_over_at: string | null;
          handed_over_by: string | null;
          id: string;
          material_id: string;
          processor_name: string;
          processor_org_id: string;
          qr_code: string;
          ref: string;
          status: Database["public"]["Enums"]["batch_status"];
          total_kg: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          handed_over_at?: string | null;
          handed_over_by?: string | null;
          id?: string;
          material_id: string;
          processor_name: string;
          processor_org_id: string;
          qr_code: string;
          ref: string;
          status?: Database["public"]["Enums"]["batch_status"];
          total_kg: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          handed_over_at?: string | null;
          handed_over_by?: string | null;
          id?: string;
          material_id?: string;
          processor_name?: string;
          processor_org_id?: string;
          qr_code?: string;
          ref?: string;
          status?: Database["public"]["Enums"]["batch_status"];
          total_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "batches_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batches_processor_org_id_fkey";
            columns: ["processor_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      coin_transactions: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          label: string;
          pickup_id: string | null;
          redemption_id: string | null;
          type: Database["public"]["Enums"]["coin_txn_type"];
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          label: string;
          pickup_id?: string | null;
          redemption_id?: string | null;
          type: Database["public"]["Enums"]["coin_txn_type"];
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          label?: string;
          pickup_id?: string | null;
          redemption_id?: string | null;
          type?: Database["public"]["Enums"]["coin_txn_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coin_transactions_pickup_id_fkey";
            columns: ["pickup_id"];
            isOneToOne: false;
            referencedRelation: "pickups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_redemption_id_fkey";
            columns: ["redemption_id"];
            isOneToOne: false;
            referencedRelation: "redemptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          accepted: boolean;
          batch_id: string | null;
          client_request_id: string | null;
          collected_at: string;
          collector_id: string | null;
          hub_received_at: string | null;
          hub_received_by: string | null;
          id: string;
          offline_recorded: boolean;
          payout_id: string | null;
          photo_path: string | null;
          pickup_id: string;
          receipt_no: string | null;
          reject_reason: string | null;
          weight_kg: number | null;
        };
        Insert: {
          accepted: boolean;
          batch_id?: string | null;
          client_request_id?: string | null;
          collected_at?: string;
          collector_id?: string | null;
          hub_received_at?: string | null;
          hub_received_by?: string | null;
          id?: string;
          offline_recorded?: boolean;
          payout_id?: string | null;
          photo_path?: string | null;
          pickup_id: string;
          receipt_no?: string | null;
          reject_reason?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          accepted?: boolean;
          batch_id?: string | null;
          client_request_id?: string | null;
          collected_at?: string;
          collector_id?: string | null;
          hub_received_at?: string | null;
          hub_received_by?: string | null;
          id?: string;
          offline_recorded?: boolean;
          payout_id?: string | null;
          photo_path?: string | null;
          pickup_id?: string;
          receipt_no?: string | null;
          reject_reason?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "collections_collector_id_fkey";
            columns: ["collector_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collections_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collections_pickup_id_fkey";
            columns: ["pickup_id"];
            isOneToOne: true;
            referencedRelation: "pickups";
            referencedColumns: ["id"];
          },
        ];
      };
      collector_profiles: {
        Row: {
          active: boolean;
          areas: string[];
          created_at: string;
          user_id: string;
          vehicle: string;
        };
        Insert: {
          active?: boolean;
          areas?: string[];
          created_at?: string;
          user_id: string;
          vehicle?: string;
        };
        Update: {
          active?: boolean;
          areas?: string[];
          created_at?: string;
          user_id?: string;
          vehicle?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collector_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      materials: {
        Row: {
          accepted: string[];
          active: boolean;
          examples: string;
          id: string;
          name: string;
          not_accepted: string[];
          points_per_kg: number;
          prep: string[];
          sort: number;
        };
        Insert: {
          accepted?: string[];
          active?: boolean;
          examples?: string;
          id: string;
          name: string;
          not_accepted?: string[];
          points_per_kg: number;
          prep?: string[];
          sort?: number;
        };
        Update: {
          accepted?: string[];
          active?: boolean;
          examples?: string;
          id?: string;
          name?: string;
          not_accepted?: string[];
          points_per_kg?: number;
          prep?: string[];
          sort?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          org_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          org_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address: string;
          area: string;
          created_at: string;
          id: string;
          kind: string;
          materials: string[];
          name: string;
          phone: string;
          status: string;
        };
        Insert: {
          address?: string;
          area?: string;
          created_at?: string;
          id?: string;
          kind: string;
          materials?: string[];
          name: string;
          phone?: string;
          status?: string;
        };
        Update: {
          address?: string;
          area?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          materials?: string[];
          name?: string;
          phone?: string;
          status?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        Insert: {
          amount_gmd: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          id?: string;
          item_count?: number;
          kind: string;
          method?: string | null;
          note?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          partner?: string | null;
          payee_name: string;
          payee_user_id?: string | null;
          quantity?: number;
          rate?: number | null;
          ref: string;
          reference?: string | null;
          requested_by?: string | null;
          status?: string;
        };
        Update: {
          amount_gmd?: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          id?: string;
          item_count?: number;
          kind?: string;
          method?: string | null;
          note?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          partner?: string | null;
          payee_name?: string;
          payee_user_id?: string | null;
          quantity?: number;
          rate?: number | null;
          ref?: string;
          reference?: string | null;
          requested_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_payee_user_id_fkey";
            columns: ["payee_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pickup_locations: {
        Row: {
          label: string | null;
          lat: number;
          lng: number;
          pickup_id: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          label?: string | null;
          lat: number;
          lng: number;
          pickup_id: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          label?: string | null;
          lat?: number;
          lng?: number;
          pickup_id?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pickup_locations_pickup_id_fkey";
            columns: ["pickup_id"];
            isOneToOne: true;
            referencedRelation: "pickups";
            referencedColumns: ["id"];
          },
        ];
      };
      pickup_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          pickup_id: string;
          status: Database["public"]["Enums"]["pickup_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          pickup_id: string;
          status: Database["public"]["Enums"]["pickup_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          pickup_id?: string;
          status?: Database["public"]["Enums"]["pickup_status"];
        };
        Relationships: [
          {
            foreignKeyName: "pickup_status_history_pickup_id_fkey";
            columns: ["pickup_id"];
            isOneToOne: false;
            referencedRelation: "pickups";
            referencedColumns: ["id"];
          },
        ];
      };
      pickups: {
        Row: {
          accepted_kg: number | null;
          address: string;
          area: string;
          bags: number;
          batch_id: string | null;
          client_request_id: string | null;
          collector_id: string | null;
          collector_name: string | null;
          created_at: string;
          customer_name: string;
          frequency: string | null;
          id: string;
          material_id: string;
          notes: string | null;
          organization_id: string | null;
          owner_id: string;
          owner_type: string;
          phone: string;
          points_awarded: number | null;
          points_pending: number;
          preferred_date: string;
          qr_code: string;
          ref: string;
          schedule_id: string | null;
          slot: string;
          status: Database["public"]["Enums"]["pickup_status"];
          updated_at: string;
        };
        Insert: {
          accepted_kg?: number | null;
          address: string;
          area: string;
          bags: number;
          batch_id?: string | null;
          client_request_id?: string | null;
          collector_id?: string | null;
          collector_name?: string | null;
          created_at?: string;
          customer_name: string;
          frequency?: string | null;
          id?: string;
          material_id: string;
          notes?: string | null;
          organization_id?: string | null;
          owner_id: string;
          owner_type: string;
          phone?: string;
          points_awarded?: number | null;
          points_pending?: number;
          preferred_date: string;
          qr_code: string;
          ref: string;
          schedule_id?: string | null;
          slot: string;
          status?: Database["public"]["Enums"]["pickup_status"];
          updated_at?: string;
        };
        Update: {
          accepted_kg?: number | null;
          address?: string;
          area?: string;
          bags?: number;
          batch_id?: string | null;
          client_request_id?: string | null;
          collector_id?: string | null;
          collector_name?: string | null;
          created_at?: string;
          customer_name?: string;
          frequency?: string | null;
          id?: string;
          material_id?: string;
          notes?: string | null;
          organization_id?: string | null;
          owner_id?: string;
          owner_type?: string;
          phone?: string;
          points_awarded?: number | null;
          points_pending?: number;
          preferred_date?: string;
          qr_code?: string;
          ref?: string;
          schedule_id?: string | null;
          slot?: string;
          status?: Database["public"]["Enums"]["pickup_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pickups_collector_id_fkey";
            columns: ["collector_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pickups_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pickups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pickups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pickups_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "recurring_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          key: string;
          label: string;
          value: number;
        };
        Insert: {
          key: string;
          label?: string;
          value: number;
        };
        Update: {
          key?: string;
          label?: string;
          value?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_type: string;
          active: boolean;
          address: string;
          area: string;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          language: string;
          phone: string;
          sms_alerts: boolean;
          updated_at: string;
        };
        Insert: {
          account_type?: string;
          active?: boolean;
          address?: string;
          area?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          language?: string;
          phone?: string;
          sms_alerts?: boolean;
          updated_at?: string;
        };
        Update: {
          account_type?: string;
          active?: boolean;
          address?: string;
          area?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          language?: string;
          phone?: string;
          sms_alerts?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_schedules: {
        Row: {
          active: boolean;
          bags: number;
          created_at: string;
          frequency: string;
          id: string;
          material_id: string;
          organization_id: string | null;
          owner_id: string;
          slot: string;
          start_date: string;
        };
        Insert: {
          active?: boolean;
          bags: number;
          created_at?: string;
          frequency: string;
          id?: string;
          material_id: string;
          organization_id?: string | null;
          owner_id: string;
          slot: string;
          start_date: string;
        };
        Update: {
          active?: boolean;
          bags?: number;
          created_at?: string;
          frequency?: string;
          id?: string;
          material_id?: string;
          organization_id?: string | null;
          owner_id?: string;
          slot?: string;
          start_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_schedules_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_schedules_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      redemption_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          redemption_id: string;
          status: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          redemption_id: string;
          status: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          redemption_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redemption_status_history_redemption_id_fkey";
            columns: ["redemption_id"];
            isOneToOne: false;
            referencedRelation: "redemptions";
            referencedColumns: ["id"];
          },
        ];
      };
      redemptions: {
        Row: {
          client_request_id: string | null;
          cost: number;
          created_at: string;
          id: string;
          name: string;
          partner: string | null;
          payout_id: string | null;
          ref: string;
          reward_id: string;
          status: string;
          user_id: string;
          value_gmd: number | null;
          voucher: string;
        };
        Insert: {
          client_request_id?: string | null;
          cost: number;
          created_at?: string;
          id?: string;
          name: string;
          partner?: string | null;
          payout_id?: string | null;
          ref: string;
          reward_id: string;
          status?: string;
          user_id: string;
          value_gmd?: number | null;
          voucher: string;
        };
        Update: {
          client_request_id?: string | null;
          cost?: number;
          created_at?: string;
          id?: string;
          name?: string;
          partner?: string | null;
          payout_id?: string | null;
          ref?: string;
          reward_id?: string;
          status?: string;
          user_id?: string;
          value_gmd?: number | null;
          voucher?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redemptions_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rewards: {
        Row: {
          active: boolean;
          category: string;
          cost: number;
          created_at: string;
          id: string;
          name: string;
          partner: string;
          stock: number;
          value_gmd: number;
        };
        Insert: {
          active?: boolean;
          category: string;
          cost: number;
          created_at?: string;
          id: string;
          name: string;
          partner: string;
          stock?: number;
          value_gmd?: number;
        };
        Update: {
          active?: boolean;
          category?: string;
          cost?: number;
          created_at?: string;
          id?: string;
          name?: string;
          partner?: string;
          stock?: number;
          value_gmd?: number;
        };
        Relationships: [];
      };
      role_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          note: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["request_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["request_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["request_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scans: {
        Row: {
          accepted: boolean;
          advice: string | null;
          contaminated: boolean;
          created_at: string;
          estimated_kg: number;
          id: string;
          image_path: string | null;
          items: Json;
          primary_material: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          accepted?: boolean;
          advice?: string | null;
          contaminated?: boolean;
          created_at?: string;
          estimated_kg?: number;
          id?: string;
          image_path?: string | null;
          items?: Json;
          primary_material?: string | null;
          source?: string;
          user_id: string;
        };
        Update: {
          accepted?: boolean;
          advice?: string | null;
          contaminated?: boolean;
          created_at?: string;
          estimated_kg?: number;
          id?: string;
          image_path?: string | null;
          items?: Json;
          primary_material?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scans_primary_material_fkey";
            columns: ["primary_material"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          available: number;
          pending: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          available?: number;
          pending?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          available?: number;
          pending?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _create_collector_payout: {
        Args: { _actor: string; _collector: string };
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      _log: {
        Args: {
          _action: string;
          _details?: Json;
          _entity: string;
          _entity_id: string;
        };
        Returns: undefined;
      };
      _notify: {
        Args: {
          _body: string;
          _kind: string;
          _link?: string;
          _title: string;
          _user: string;
        };
        Returns: undefined;
      };
      _notify_org: {
        Args: {
          _body: string;
          _kind: string;
          _link?: string;
          _org: string;
          _title: string;
        };
        Returns: undefined;
      };
      _notify_role: {
        Args: {
          _body: string;
          _kind: string;
          _link?: string;
          _role: Database["public"]["Enums"]["app_role"];
          _title: string;
        };
        Returns: undefined;
      };
      _rand4: { Args: never; Returns: string };
      _require_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] };
        Returns: string;
      };
      admin_assign_collector: {
        Args: { _collector: string; _pickup: string };
        Returns: undefined;
      };
      admin_cancel_payout: {
        Args: { _note: string; _payout: string };
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_collector_payout: {
        Args: { _collector: string };
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_partner_payout: {
        Args: { _partner: string };
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_decide_role_request: {
        Args: { _approve: boolean; _org?: string; _request: string };
        Returns: undefined;
      };
      admin_mark_payout_paid: {
        Args: {
          _method: string;
          _note: string;
          _payout: string;
          _reference: string;
        };
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_payout_balances: {
        Args: never;
        Returns: {
          amount_gmd: number;
          item_count: number;
          kind: string;
          payee_name: string;
          payee_user_id: string;
          quantity: number;
        }[];
      };
      admin_set_org_status: {
        Args: { _org: string; _status: string };
        Returns: undefined;
      };
      admin_set_redemption_status: {
        Args: { _id: string; _status: string };
        Returns: undefined;
      };
      admin_set_role: {
        Args: {
          _grant: boolean;
          _org?: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user: string;
        };
        Returns: undefined;
      };
      admin_set_setting: {
        Args: { _key: string; _value: number };
        Returns: undefined;
      };
      admin_set_user_active: {
        Args: { _active: boolean; _user: string };
        Returns: undefined;
      };
      admin_update_material: {
        Args: { _active: boolean; _id: string; _points: number };
        Returns: undefined;
      };
      admin_upsert_reward: {
        Args: {
          _active: boolean;
          _category: string;
          _cost: number;
          _id: string;
          _name: string;
          _partner: string;
          _stock: number;
          _value: number;
        };
        Returns: undefined;
      };
      book_pickup: {
        Args: {
          _address: string;
          _area: string;
          _bags: number;
          _client_request_id: string;
          _date: string;
          _frequency?: string;
          _material: string;
          _notes: string;
          _slot: string;
        };
        Returns: {
          accepted_kg: number | null;
          address: string;
          area: string;
          bags: number;
          batch_id: string | null;
          client_request_id: string | null;
          collector_id: string | null;
          collector_name: string | null;
          created_at: string;
          customer_name: string;
          frequency: string | null;
          id: string;
          material_id: string;
          notes: string | null;
          organization_id: string | null;
          owner_id: string;
          owner_type: string;
          phone: string;
          points_awarded: number | null;
          points_pending: number;
          preferred_date: string;
          qr_code: string;
          ref: string;
          schedule_id: string | null;
          slot: string;
          status: Database["public"]["Enums"]["pickup_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "pickups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_batch: {
        Args: { _pickup_ids: string[]; _processor_org: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          handed_over_at: string | null;
          handed_over_by: string | null;
          id: string;
          material_id: string;
          processor_name: string;
          processor_org_id: string;
          qr_code: string;
          ref: string;
          status: Database["public"]["Enums"]["batch_status"];
          total_kg: number;
        };
        SetofOptions: {
          from: "*";
          to: "batches";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      hand_over_batch: {
        Args: { _batch: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          handed_over_at: string | null;
          handed_over_by: string | null;
          id: string;
          material_id: string;
          processor_name: string;
          processor_org_id: string;
          qr_code: string;
          ref: string;
          status: Database["public"]["Enums"]["batch_status"];
          total_kg: number;
        };
        SetofOptions: {
          from: "*";
          to: "batches";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_org_member: {
        Args: { _org: string; _user?: string };
        Returns: boolean;
      };
      lookup_batch_code: { Args: { _code: string }; Returns: string };
      mark_notifications_read: { Args: { _ids?: string[] }; Returns: undefined };
      record_collection: {
        Args: {
          _client_request_id: string;
          _offline: boolean;
          _photo_path: string;
          _pickup: string;
          _weight: number;
        };
        Returns: {
          accepted: boolean;
          batch_id: string | null;
          client_request_id: string | null;
          collected_at: string;
          collector_id: string | null;
          hub_received_at: string | null;
          hub_received_by: string | null;
          id: string;
          offline_recorded: boolean;
          payout_id: string | null;
          photo_path: string | null;
          pickup_id: string;
          receipt_no: string | null;
          reject_reason: string | null;
          weight_kg: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "collections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      redeem_reward: {
        Args: { _client_request_id: string; _reward: string };
        Returns: {
          client_request_id: string | null;
          cost: number;
          created_at: string;
          id: string;
          name: string;
          partner: string | null;
          payout_id: string | null;
          ref: string;
          reward_id: string;
          status: string;
          user_id: string;
          value_gmd: number | null;
          voucher: string;
        };
        SetofOptions: {
          from: "*";
          to: "redemptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reject_pickup: {
        Args: {
          _client_request_id: string;
          _offline: boolean;
          _pickup: string;
          _reason: string;
        };
        Returns: {
          accepted: boolean;
          batch_id: string | null;
          client_request_id: string | null;
          collected_at: string;
          collector_id: string | null;
          hub_received_at: string | null;
          hub_received_by: string | null;
          id: string;
          offline_recorded: boolean;
          payout_id: string | null;
          photo_path: string | null;
          pickup_id: string;
          receipt_no: string | null;
          reject_reason: string | null;
          weight_kg: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "collections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_collector_payout: {
        Args: never;
        Returns: {
          amount_gmd: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          item_count: number;
          kind: string;
          method: string | null;
          note: string | null;
          paid_at: string | null;
          paid_by: string | null;
          partner: string | null;
          payee_name: string;
          payee_user_id: string | null;
          quantity: number;
          rate: number | null;
          ref: string;
          reference: string | null;
          requested_by: string | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_pickup_location: {
        Args: {
          _label: string;
          _lat: number;
          _lng: number;
          _pickup: string;
          _source: string;
        };
        Returns: undefined;
      };
      update_my_profile: {
        Args: {
          _address: string;
          _area: string;
          _full_name: string;
          _language: string;
          _phone: string;
          _sms_alerts: boolean;
        };
        Returns: {
          account_type: string;
          active: boolean;
          address: string;
          area: string;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          language: string;
          phone: string;
          sms_alerts: boolean;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_batch: {
        Args: {
          _actual: number;
          _batch: string;
          _grade: string;
          _note: string;
          _rejected: number;
        };
        Returns: {
          accepted_kg: number;
          actual_kg: number;
          batch_id: string;
          decision: Database["public"]["Enums"]["batch_decision"];
          grade: string;
          note: string | null;
          rejected_kg: number;
          verified_at: string;
          verified_by: string;
        };
        SetofOptions: {
          from: "*";
          to: "batch_verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_pickup_code: {
        Args: { _code: string; _pickup: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "resident" | "business" | "collector" | "hub" | "processor" | "admin";
      batch_decision: "accepted" | "partial" | "rejected";
      batch_status: "ready" | "in_transit" | "verified";
      coin_txn_type: "earned" | "pending" | "redeemed" | "forfeited";
      pickup_status: "scheduled" | "collected" | "batched" | "verified" | "rejected";
      request_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["resident", "business", "collector", "hub", "processor", "admin"],
      batch_decision: ["accepted", "partial", "rejected"],
      batch_status: ["ready", "in_transit", "verified"],
      coin_txn_type: ["earned", "pending", "redeemed", "forfeited"],
      pickup_status: ["scheduled", "collected", "batched", "verified", "rejected"],
      request_status: ["pending", "approved", "rejected"],
    },
  },
} as const;
