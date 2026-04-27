"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { LeadDetailContent } from "@/components/leads/lead-detail-content";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <>
      <Header
        eyebrow="Lead detail"
        title="Full record"
        subtitle="Edit the record inline, keep follow-up state visible, and add notes without leaving the page."
        actions={
          <Button variant="outline" className="rounded-[3px]" render={<Link href="/leads" />}>
            <ArrowLeft className="h-4 w-4" />
            Back to pipeline
          </Button>
        }
      />
      <LeadDetailContent leadId={id} mode="full" />
    </>
  );
}
