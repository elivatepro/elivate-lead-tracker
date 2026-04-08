"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRightLeft,
  Pencil,
  MessageSquare,
  Bell,
  Clock,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";

type DashboardData = {
  activeLeads: number;
  staleLeads: number;
  incompleteLeads: number;
  addedThisWeek: number;
  pipelineValue: number;
  recentActivities: {
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
    created_at: string;
    leads: { name: string } | null;
  }[];
};

function formatActivityText(activity: DashboardData["recentActivities"][0]) {
  const leadName = activity.leads?.name ?? "Unknown lead";
  switch (activity.type) {
    case "created":
      return `${leadName} was added`;
    case "stage_changed":
      return `${leadName} moved to ${(activity.payload?.to as string) ?? "?"}`;
    case "field_edited":
      return `${leadName} was updated`;
    case "note_added":
      return `Note added on ${leadName}`;
    case "reminder_sent":
      return `Reminder sent for ${leadName}`;
    case "snoozed":
      return `${leadName} snoozed`;
    default:
      return `${leadName}: ${activity.type}`;
  }
}

function ActivityIcon({ type }: { type: string }) {
  const iconClass = "h-3.5 w-3.5";
  switch (type) {
    case "created":
      return <Plus className={iconClass} />;
    case "stage_changed":
      return <ArrowRightLeft className={iconClass} />;
    case "field_edited":
      return <Pencil className={iconClass} />;
    case "note_added":
      return <MessageSquare className={iconClass} />;
    case "reminder_sent":
      return <Bell className={iconClass} />;
    case "snoozed":
      return <Clock className={iconClass} />;
    default:
      return <Activity className={iconClass} />;
  }
}

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-[1200px]">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            Your pipeline at a glance.
          </p>
          <NewLeadDialog />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="Active leads"
            value={isLoading ? "--" : data?.activeLeads ?? 0}
            description="In your pipeline"
            href="/leads"
            accent="#ff7f4f"
          />
          <StatCard
            title="Stale leads"
            value={isLoading ? "--" : data?.staleLeads ?? 0}
            description="Past follow-up SLA"
            href="/leads/stale"
            accent="#dc2626"
          />
          <StatCard
            title="Incomplete"
            value={isLoading ? "--" : data?.incompleteLeads ?? 0}
            description="Missing required fields"
            accent="#c4960a"
          />
          <StatCard
            title="Added this week"
            value={isLoading ? "--" : data?.addedThisWeek ?? 0}
            description="New leads captured"
            accent="#16a34a"
          />
          <StatCard
            title="Pipeline value"
            value={
              isLoading
                ? "--"
                : `$${(data?.pipelineValue ?? 0).toLocaleString()}`
            }
            description="Total deal value"
            accent="#1a1714"
          />
        </div>

        {/* Recent activity */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-serif text-lg mb-1">Recent activity</h2>
            <p className="text-[11px] text-muted-foreground/60 mb-4">
              Latest actions across your pipeline
            </p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading...
              </p>
            ) : !data?.recentActivities?.length ? (
              <EmptyState
                icon={<Activity className="h-10 w-10" />}
                title="No activity yet"
                description="Once you add your first lead, every action -- stage changes, notes, follow-ups -- shows up here."
                action={{
                  label: "Add your first lead",
                  href: "/leads",
                }}
              />
            ) : (
              <div className="space-y-0">
                {data.recentActivities.map((activity, i) => (
                  <div
                    key={activity.id}
                    className={`flex items-center gap-3 py-2.5 ${
                      i < data.recentActivities.length - 1
                        ? "border-b border-border/40"
                        : ""
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-secondary/80 flex items-center justify-center shrink-0 text-muted-foreground">
                      <ActivityIcon type={activity.type} />
                    </div>
                    <p className="text-[13px] flex-1">
                      {formatActivityText(activity)}
                    </p>
                    <span className="text-[11px] text-muted-foreground/50 shrink-0 ml-4 tabular-nums">
                      {timeAgo(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
