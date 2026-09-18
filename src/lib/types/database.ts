export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          required_fields: string[];
          nov_company_summary: string | null;
          nov_offer_summary: string | null;
          nov_target_customer: string | null;
          nov_default_cta: string | null;
          nov_email_signoff: string | null;
          nov_preferred_tone: string;
          nov_be_concise: boolean;
          nov_avoid_pushy_language: boolean;
          nov_include_booking_prompt: boolean;
          smtp_host: string | null;
          smtp_port: number;
          smtp_user: string | null;
          smtp_pass_encrypted: string | null;
          email_from_name: string | null;
          email_signature: string | null;
          email_batch_size: number;
          email_batch_delay: number;
          email_hourly_cap: number;
          email_daily_cap: number;
          email_footer_address: string | null;
          email_reply_to: string | null;
          automations_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          required_fields?: string[];
          nov_company_summary?: string | null;
          nov_offer_summary?: string | null;
          nov_target_customer?: string | null;
          nov_default_cta?: string | null;
          nov_email_signoff?: string | null;
          nov_preferred_tone?: string;
          nov_be_concise?: boolean;
          nov_avoid_pushy_language?: boolean;
          nov_include_booking_prompt?: boolean;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_user?: string | null;
          smtp_pass_encrypted?: string | null;
          email_from_name?: string | null;
          email_signature?: string | null;
          email_batch_size?: number;
          email_batch_delay?: number;
          email_hourly_cap?: number;
          email_daily_cap?: number;
          email_footer_address?: string | null;
          email_reply_to?: string | null;
          automations_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          required_fields?: string[];
          nov_company_summary?: string | null;
          nov_offer_summary?: string | null;
          nov_target_customer?: string | null;
          nov_default_cta?: string | null;
          nov_email_signoff?: string | null;
          nov_preferred_tone?: string;
          nov_be_concise?: boolean;
          nov_avoid_pushy_language?: boolean;
          nov_include_booking_prompt?: boolean;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_user?: string | null;
          smtp_pass_encrypted?: string | null;
          email_from_name?: string | null;
          email_signature?: string | null;
          email_batch_size?: number;
          email_batch_delay?: number;
          email_hourly_cap?: number;
          email_daily_cap?: number;
          email_footer_address?: string | null;
          email_reply_to?: string | null;
          automations_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      stages: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          position: number;
          sla_days: number | null;
          is_closed: boolean;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          position: number;
          sla_days?: number | null;
          is_closed?: boolean;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          position?: number;
          sla_days?: number | null;
          is_closed?: boolean;
          color?: string | null;
          created_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          workspace_id: string;
          stage_id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          source: string | null;
          value: number | null;
          notes: string | null;
          tags: string[];
          last_activity_at: string;
          snoozed_until: string | null;
          reminder_sent_at: string | null;
          closed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          stage_id: string;
          name: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          value?: number | null;
          notes?: string | null;
          tags?: string[];
          last_activity_at?: string;
          snoozed_until?: string | null;
          reminder_sent_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          stage_id?: string;
          name?: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          value?: number | null;
          notes?: string | null;
          tags?: string[];
          last_activity_at?: string;
          snoozed_until?: string | null;
          reminder_sent_at?: string | null;
          closed_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_queue: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string;
          from_email: string;
          from_name: string | null;
          to_email: string;
          subject: string;
          body_html: string | null;
          body_text: string | null;
          scheduled_for: string;
          status: string;
          error: string | null;
          sent_at: string | null;
          created_at: string;
          attempts: number;
          claimed_at: string | null;
          source: string;
          enrollment_id: string | null;
          node_id: string | null;
          idempotency_key: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          lead_id: string;
          from_email: string;
          from_name?: string | null;
          to_email: string;
          subject: string;
          body_html?: string | null;
          body_text?: string | null;
          scheduled_for?: string;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
          attempts?: number;
          claimed_at?: string | null;
          source?: string;
          enrollment_id?: string | null;
          node_id?: string | null;
          idempotency_key?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          lead_id?: string;
          from_email?: string;
          from_name?: string | null;
          to_email?: string;
          subject?: string;
          body_html?: string | null;
          body_text?: string | null;
          scheduled_for?: string;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
          attempts?: number;
          claimed_at?: string | null;
          source?: string;
          enrollment_id?: string | null;
          node_id?: string | null;
          idempotency_key?: string | null;
        };
      };
      email_log: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string;
          to_email: string;
          subject: string;
          status: string;
          error: string | null;
          sent_at: string;
          source: string | null;
          enrollment_id: string | null;
          message_id: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          lead_id: string;
          to_email: string;
          subject: string;
          status?: string;
          error?: string | null;
          sent_at?: string;
          source?: string | null;
          enrollment_id?: string | null;
          message_id?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          lead_id?: string;
          to_email?: string;
          subject?: string;
          status?: string;
          error?: string | null;
          sent_at?: string;
          source?: string | null;
          enrollment_id?: string | null;
          message_id?: string | null;
        };
      };
      email_suppressions: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          reason: "unsubscribe" | "bounce" | "manual";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          reason: "unsubscribe" | "bounce" | "manual";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          reason?: "unsubscribe" | "bounce" | "manual";
          created_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string;
          type: "created" | "stage_changed" | "field_edited" | "note_added" | "reminder_sent" | "snoozed" | "closed" | "email_sent" | "archived" | "restored";
          payload: Json | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          lead_id: string;
          type: "created" | "stage_changed" | "field_edited" | "note_added" | "reminder_sent" | "snoozed" | "closed" | "email_sent" | "archived" | "restored";
          payload?: Json | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          lead_id?: string;
          type?: "created" | "stage_changed" | "field_edited" | "note_added" | "reminder_sent" | "snoozed" | "closed";
          payload?: Json | null;
          actor_id?: string | null;
          created_at?: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string;
          sent_at: string;
          due_at: string;
          email_id: string | null;
          status: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          lead_id: string;
          sent_at?: string;
          due_at: string;
          email_id?: string | null;
          status?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          lead_id?: string;
          sent_at?: string;
          due_at?: string;
          email_id?: string | null;
          status?: string | null;
        };
      };
    };
    Views: {
      stale_leads: {
        Row: {
          id: string;
          workspace_id: string;
          stage_id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          source: string | null;
          value: number | null;
          notes: string | null;
          tags: string[];
          last_activity_at: string;
          snoozed_until: string | null;
          reminder_sent_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
          stage_name: string;
          sla_days: number;
          due_at: string;
          owner_id: string;
        };
      };
      leads_sla_state: {
        Row: {
          id: string;
          workspace_id: string;
          stage_id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          source: string | null;
          value: number | null;
          notes: string | null;
          tags: string[];
          last_activity_at: string;
          snoozed_until: string | null;
          reminder_sent_at: string | null;
          closed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          stages: {
            name: string;
            sla_days: number | null;
            is_closed: boolean;
            color: string | null;
            position: number;
          };
          is_stale: boolean;
        };
      };
    };
    Functions: {
      claim_email_queue: {
        Args: { p_workspace_id: string; p_limit: number };
        Returns: Database["public"]["Tables"]["email_queue"]["Row"][];
      };
      email_queue_finalize: {
        Args: {
          p_id: string;
          p_outcome: "sent" | "failed" | "skipped" | "retry" | "release";
          p_error?: string | null;
          p_message_id?: string | null;
          p_retry_seconds?: number;
        };
        Returns: string;
      };
      suppress_email: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_reason: "unsubscribe" | "bounce" | "manual";
        };
        Returns: undefined;
      };
      get_dashboard_stats: {
        Args: {
          p_workspace_id: string;
          p_required_fields: string[];
        };
        Returns: {
          active_leads: number;
          stale_leads: number;
          incomplete_leads: number;
          added_this_week: number;
          pipeline_value: number;
        }[];
      };
    };
    Enums: {
      activity_type:
        | "created"
        | "stage_changed"
        | "field_edited"
        | "note_added"
        | "reminder_sent"
        | "snoozed"
        | "closed"
        | "email_sent"
        | "archived"
        | "restored"
        | "unsubscribed";
    };
  };
};
