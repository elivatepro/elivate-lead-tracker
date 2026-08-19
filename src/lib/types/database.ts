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
          scheduled_for: string;
          status: string;
          error: string | null;
          sent_at: string | null;
          created_at: string;
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
          scheduled_for?: string;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
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
          scheduled_for?: string;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
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
    };
    Functions: Record<string, never>;
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
        | "restored";
    };
  };
};
