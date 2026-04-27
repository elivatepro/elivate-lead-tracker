"use client";

import { PageHeader } from "@/components/layout/page-header";

export function Header({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      actions={actions}
    />
  );
}
