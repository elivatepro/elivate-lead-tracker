import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-5 rounded-full bg-secondary/70 p-4 text-primary">{icon}</div>
      )}
      <h3 className="font-serif text-3xl tracking-[-0.03em] mb-2">{title}</h3>
      <p className="mb-6 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && (
        <Link href={action.href} className={buttonVariants({ className: "rounded-full px-5" })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
