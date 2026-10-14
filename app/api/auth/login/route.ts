import { NextRequest, NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rate = checkRateLimit(`auth_login_${ip}`, { limit: 12, windowMs: 60 * 1000 });
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de tentatives de connexion. Veuillez patienter une minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { identifier, password, rememberMe } = body || {};

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Veuillez saisir votre identifiant (ou email) et votre mot de passe." },
        { status: 400 }
      );
    }

    const result = await loginUser(identifier, password, Boolean(rememberMe));
    if (!result.success || !result.sessionId) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const res = NextResponse.json({
      success: true,
      user: result.user,
    });

    res.cookies.set(SESSION_COOKIE_NAME, result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: result.maxAge,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la tentative de connexion." },
      { status: 500 }
    );
  }
}
