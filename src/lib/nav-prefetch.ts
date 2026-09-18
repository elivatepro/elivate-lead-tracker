"use client";

import { useQueryClient } from "@tanstack/react-query";
import { leadsQueryOptions } from "@/hooks/use-leads";
import { stagesQueryOptions } from "@/hooks/use-stages";
import { tagsQueryOptions } from "@/hooks/use-tags";
import { dashboardQueryOptions } from "@/hooks/use-dashboard";

// Reuses the exact query options each destination page fetches on mount,
// so a hover-triggered prefetch always lands in the same cache entry the
// page's own hook reads — and is a no-op if that data is already fresh.
export function useNavPrefetch() {
  const queryClient = useQueryClient();

  return function prefetchForHref(href: string) {
    switch (href) {
      case "/":
        queryClient.prefetchQuery(dashboardQueryOptions());
        queryClient.prefetchQuery(leadsQueryOptions());
        break;
      case "/today":
        queryClient.prefetchQuery(leadsQueryOptions());
        break;
      case "/leads":
        queryClient.prefetchQuery(leadsQueryOptions());
        queryClient.prefetchQuery(stagesQueryOptions());
        break;
      case "/leads/list":
        queryClient.prefetchQuery(leadsQueryOptions());
        queryClient.prefetchQuery(stagesQueryOptions());
        queryClient.prefetchQuery(tagsQueryOptions());
        break;
      case "/leads/stale":
        queryClient.prefetchQuery(leadsQueryOptions({ stale: true }));
        break;
    }
  };
}
