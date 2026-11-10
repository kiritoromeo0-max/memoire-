import { NextRequest, NextResponse } from "next/server";
import { clearAnonymousCookie, requireAuthenticatedUser, revokeAnonymousCredential } from "@/lib/anonymous-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await revokeAnonymousCredential(auth);
  return clearAnonymousCookie(NextResponse.json({ success: true }));
}