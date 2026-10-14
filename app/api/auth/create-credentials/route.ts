import { NextRequest, NextResponse } from "next/server";
import { completeRegistration, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registrationToken, username, password, confirmPassword, rememberMe } = body || {};

    if (!registrationToken || !username || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Veuillez renseigner tous les champs obligatoires." },
        { status: 400 }
      );
    }

    const result = await completeRegistration(
      registrationToken,
      username,
      password,
      confirmPassword,
      Boolean(rememberMe)
    );

    if (!result.success || !result.sessionId) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
      { error: "Une erreur est survenue lors de la création de vos identifiants." },
      { status: 500 }
    );
  }
}
