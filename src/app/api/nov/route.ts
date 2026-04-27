import type {
  EasyInputMessage,
  ParsedResponse,
  ParsedResponseFunctionToolCall,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses";
import type { ResponseStream } from "openai/lib/responses/ResponseStream";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { createOpenAIClient, NOV_MODEL } from "@/lib/nov/openai";
import { takeNovRateLimit } from "@/lib/nov/rate-limit";
import { buildUserContext, NOV_SYSTEM_PROMPT } from "@/lib/nov/system-prompt";
import { NOV_TOOLS, runToolCall } from "@/lib/nov/tools";

type NovApiMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  leadRefs?: { id: string; name: string }[];
};

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

type FunctionCallOutputInput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export async function POST(req: Request) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) return new Response("Unauthorized", { status: 401 });

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const rateLimit = takeNovRateLimit(`${ctx.user.id}:${ip}`);
    if (!rateLimit.ok) {
      return new Response("Too many Nov requests", {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      });
    }

    const { messages, leadRefs } = (await req.json()) as {
      messages?: NovApiMessage[];
      leadRefs?: { id: string; name: string }[];
    };

    const openai = createOpenAIClient();

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (payload: Record<string, string>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const abortStream = () => {
          try {
            controller.close();
          } catch {}
        };

        req.signal.addEventListener("abort", abortStream);

        void (async () => {
          try {
            const input = buildInput(messages ?? []);
            const instructions = [NOV_SYSTEM_PROMPT, buildUserContext(ctx.workspace, leadRefs)].join(
              "\n\n"
            );

            let previousResponseId: string | undefined;
            let nextInput: EasyInputMessage[] | FunctionCallOutputInput[] =
              input;

            for (let round = 0; round < 8; round += 1) {
              const responseStream: ResponseStream = openai.responses.stream({
                model: NOV_MODEL,
                instructions,
                input: nextInput,
                previous_response_id: previousResponseId,
                parallel_tool_calls: false,
                tools: NOV_TOOLS,
              });

              responseStream.on("response.output_text.delta", (event: ResponseTextDeltaEvent) => {
                sendEvent({ type: "delta", text: event.delta });
              });

              const finalResponse: ParsedResponse<unknown> = await responseStream.finalResponse();
              previousResponseId = finalResponse.id;

              const toolCalls = finalResponse.output.filter(isCompletedFunctionCall);

              if (toolCalls.length === 0) {
                sendEvent({ type: "done" });
                break;
              }

              nextInput = await Promise.all(
                toolCalls.map(async (toolCall: ParsedResponseFunctionToolCall) => {
                  const result = await runToolCall(toolCall, ctx);

                  return {
                    type: "function_call_output" as const,
                    call_id: toolCall.call_id,
                    output: JSON.stringify(result),
                  };
                })
              );
            }
          } catch (error) {
            if (!req.signal.aborted) {
              sendEvent({
                type: "error",
                text: error instanceof Error ? error.message : "Nov request failed",
              });
            }
          } finally {
            req.signal.removeEventListener("abort", abortStream);
            abortStream();
          }
        })();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message.includes("OPENAI_API_KEY")
        ? "Server AI is not configured. Add OPENAI_API_KEY to the environment and restart the app."
        : "Nov is temporarily unavailable. Check the server configuration and try again.";

    return new Response(message, { status: 500 });
  }
}

function isCompletedFunctionCall(
  item: ParsedResponse<unknown>["output"][number]
): item is ParsedResponseFunctionToolCall {
  return item.type === "function_call" && item.status === "completed";
}

function buildInput(messages: NovApiMessage[]): EasyInputMessage[] {
  return messages.map((message) => {
    const leadContext =
      message.leadRefs && message.leadRefs.length > 0
        ? `Tagged leads: ${message.leadRefs.map((lead) => `${lead.name} (${lead.id})`).join(", ")}\n\n`
        : "";

    return {
      type: "message",
      role: message.role,
      content: `${leadContext}${message.content}`,
    };
  });
}
