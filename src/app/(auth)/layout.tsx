import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="mb-8 flex items-center gap-3">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={42}
            height={42}
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              LeadTracker
            </h1>
            <p className="text-sm text-muted-foreground">by Elivate</p>
          </div>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
