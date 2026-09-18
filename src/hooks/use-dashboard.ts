"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";

export type DashboardData = {
  activeLeads: number;
  staleLeads: number;
  incompleteLeads: number;
  addedThisWeek: number;
  pipelineValue: number;
};

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json() as Promise<DashboardData>;
    },
  });
}

export function useDashboard() {
  return useQuery(dashboardQueryOptions());
}
