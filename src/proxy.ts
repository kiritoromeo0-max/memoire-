import { NextRequest, NextResponse } from "next/server";

const MAX_API_BODY_BYTES = 256 * 1024;

function firstHeaderValue(request: NextRequest, name: string): string | null {
  return request.headers.get(name)?.split(",")[0].trim() || null;
}

function isRequestOrigin(request: NextRequest, origin: string): boolean {
  try {
    const parsedOrigin = new URL(origin);
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol)
      || parsedOrigin.origin === "null"
      || parsedOrigin.username
      || parsedOrigin.password
      || parsedOrigin.pathname !== "/"
      || parsedOrigin.search
      || parsedOrigin.hash
    ) {
      return false;
    }

    const forwardedHost = firstHeaderValue(request, "x-forwarded-host");
    const host = firstHeaderValue(request, "host");
    const forwardedProto = firstHeaderValue(request, "x-forwarded-proto");
    const protocol = forwardedProto
      ? `${forwardedProto.replace(/:$/, "")}:`
      : request.nextUrl.protocol;
    const expectedOrigins = new Set([request.nextUrl.origin]);

    for (const candidateHost of [forwardedHost, host]) {
      if (!candidateHost) continue;

      try {
        expectedOrigins.add(new URL(`${protocol}//${candidateHost}`).origin);
      } catch {
        // Ignore malformed forwarded host values.
      }
    }

    return expectedOrigins.has(parsedOrigin.origin);
  } catch {
    return false;
  }
}

async function bodyExceedsLimit(request: NextRequest): Promise<boolean> {
  const reader = request.clone().body?.getReader();
  if (!reader) return false;

  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return false;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_API_BODY_BYTES) {
      await reader.cancel();
      return true;
    }
  }
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const sameOrigin = fetchSite === "same-origin"
    || (!!origin && isRequestOrigin(request, origin));

  if (!sameOrigin) {
    return NextResponse.json(
      { error: "Origine de requête non autorisée", code: "ORIGIN_NOT_ALLOWED" },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return NextResponse.json({ error: "Corps de requête trop volumineux" }, { status: 413 });
  }
  if (await bodyExceedsLimit(request)) {
    return NextResponse.json({ error: "Corps de requête trop volumineux" }, { status: 413 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};