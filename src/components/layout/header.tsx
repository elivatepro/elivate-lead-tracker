"use client";

import { PageHeader } from "@/components/layout/page-header";

export function Header({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return <PageHeader title={title} actions={actions} />;
}