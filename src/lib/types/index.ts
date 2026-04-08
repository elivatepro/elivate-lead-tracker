import type { Database } from "./database";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Stage = Database["public"]["Tables"]["stages"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
export type StageInsert = Database["public"]["Tables"]["stages"]["Insert"];
export type StageUpdate = Database["public"]["Tables"]["stages"]["Update"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];
