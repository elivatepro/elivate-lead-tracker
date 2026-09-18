import { isAuthorizedCron } from "@/lib/cron-auth";
import { processEmailQueue } from "@/lib/email/queue";

export const maxDuration = 60;

// Drains due emails from the queue. Called every minute by pg_cron (POST) and,
// until that's proven, hourly by the GitHub Action (GET). Both are safe to run
// together: rows are claimed atomically, so nothing is sent twice.
async function handle(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    return Response.json(await processEmailQueue());
  } catch (err) {
    console.error("process-email-queue failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Queue processing failed" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
