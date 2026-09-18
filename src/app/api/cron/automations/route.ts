import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAutomationTick } from "@/lib/automations/engine";

export const maxDuration = 60;

// Advances due automation enrollments. Called every minute by pg_cron (POST)
// when there is work. `?dry=1` reports what a tick would do without claiming
// or committing anything.
async function handle(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dry = new URL(req.url).searchParams.has("dry");

  try {
    return Response.json(await runAutomationTick({ dry }));
  } catch (err) {
    console.error("automations tick failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Automation tick failed" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
