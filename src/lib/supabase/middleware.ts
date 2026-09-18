import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT signature locally against a cached JWKS
  // (this project uses asymmetric signing keys) instead of making a
  // network round trip to Supabase Auth on every request like getUser()
  // does. It also refreshes the session first if the token is close to
  // expiring, same as getUser() would.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims
    ? { id: claimsData.claims.sub, email: claimsData.claims.email }
    : null;

  // Public routes that don't require auth
  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/snooze") ||
    request.nextUrl.pathname.startsWith("/api/cron") ||
    request.nextUrl.pathname.startsWith("/auth/callback");

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup") ||
      request.nextUrl.pathname.startsWith("/forgot-password"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Forward the identity we just verified to Server Functions/Route
  // Handlers via a trusted header, so getAuthenticatedContext() doesn't
  // have to verify the JWT a second time. Strip any client-supplied
  // value first so this can never be spoofed — it's always overwritten
  // (or cleared) from our own fresh getClaims() result above.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-ltz-user-id");
  requestHeaders.delete("x-ltz-user-email");
  if (user) {
    requestHeaders.set("x-ltz-user-id", user.id);
    requestHeaders.set("x-ltz-user-email", user.email ?? "");
  }

  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });

  return finalResponse;
}
