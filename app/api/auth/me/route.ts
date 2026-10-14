import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUser(sessionId);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}
