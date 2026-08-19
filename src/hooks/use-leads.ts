"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  type QueryKey,
} from "@tanstack/react-query";

export type LeadWithStage = {
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
};

type OptimisticContext = {
  previous: [QueryKey, LeadWithStage[] | undefined][];
};

export function useLeads(filters?: {
  stage?: string;
  stale?: boolean;
  search?: string;
  archived?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.stage) params.set("stage", filters.stage);
  if (filters?.stale) params.set("stale", "true");
  if (filters?.search) params.set("search", filters.search);
  if (filters?.archived) params.set("archived", "true");

  return useQuery<LeadWithStage[]>({
    queryKey: ["leads", filters],
    queryFn: async () => {
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
}

function snapshotLeadLists(queryClient: ReturnType<typeof useQueryClient>) {
  const previous = queryClient.getQueriesData<LeadWithStage[]>({
    queryKey: ["leads"],
  }) as [QueryKey, LeadWithStage[] | undefined][];
  return { previous };
}

function restoreLeadLists(queryClient: ReturnType<typeof useQueryClient>, ctx?: OptimisticContext) {
  if (!ctx) return;
  for (const [key, data] of ctx.previous) {
    queryClient.setQueryData(key, data);
  }
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: {
      stage_id: string;
      name: string;
      company?: string;
      email?: string;
      phone?: string;
      source?: string;
      value?: number;
      notes?: string;
      tags?: string[];
    }) => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update lead");
      }
      return res.json();
    },
    onMutate: async ({ id, ...updates }): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const ctx = snapshotLeadLists(queryClient);
      const patch = updates as Partial<LeadWithStage>;

      queryClient.setQueriesData<LeadWithStage[]>({ queryKey: ["leads"] }, (old) =>
        old?.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
      );
      queryClient.setQueryData<Record<string, unknown>>(["lead", id], (old) =>
        old ? { ...old, ...patch } : old
      );
      return ctx;
    },
    onError: (_error, _vars, ctx) => restoreLeadLists(queryClient, ctx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete lead");
      }
      return res.json();
    },
    onMutate: async (id): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const ctx = snapshotLeadLists(queryClient);

      queryClient.setQueriesData<LeadWithStage[]>({ queryKey: ["leads"] }, (old) =>
        old?.filter((lead) => lead.id !== id)
      );
      return ctx;
    },
    onError: (_error, _vars, ctx) => restoreLeadLists(queryClient, ctx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}