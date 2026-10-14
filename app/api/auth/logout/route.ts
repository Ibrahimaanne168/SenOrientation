import { NextRequest, NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  revokeSession(sessionId);

  const res = NextResponse.json({ success: true, message: "Déconnexion réussie." });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
