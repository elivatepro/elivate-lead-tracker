export type SmtpFailure = {
  // auth: credentials rejected — pause the workspace, don't burn attempts
  // retryable: timeouts, connection drops, 4xx — try again later
  // bounce: the mailbox/domain doesn't exist — permanent, suppress the address
  // permanent: other 5xx — permanent, don't suppress (could be a spam block)
  kind: "auth" | "retryable" | "bounce" | "permanent";
  message: string;
};

type SmtpErrorShape = {
  code?: string;
  responseCode?: number;
  response?: string;
  message?: string;
};

// Only synchronous rejections can be seen over SMTP; async bounce emails
// arrive in the mailbox and are invisible to us.
export function classifySmtpError(err: unknown): SmtpFailure {
  const e = (err ?? {}) as SmtpErrorShape;
  const message = e.message ?? String(err);
  const rc = typeof e.responseCode === "number" ? e.responseCode : undefined;

  if (
    e.code === "EAUTH" ||
    rc === 535 ||
    rc === 534 ||
    rc === 530 ||
    /invalid login|authentication failed|username and password not accepted/i.test(message)
  ) {
    return { kind: "auth", message };
  }

  if (rc !== undefined && rc >= 500) {
    const badMailbox = /\b5\.1\.[1-6]\b/.test(e.response ?? message);
    if ((rc === 550 || rc === 551 || rc === 553) && badMailbox) {
      return { kind: "bounce", message };
    }
    return { kind: "permanent", message };
  }

  return { kind: "retryable", message };
}
