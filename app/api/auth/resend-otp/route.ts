import { NextRequest, NextResponse } from "next/server";
import { resendVerificationCode } from "@/lib/auth-store";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rate = checkRateLimit(`auth_resend_${ip}`, { limit: 5, windowMs: 60 * 1000 });
    if (!rate.success) {
      return NextResponse.json(
        { error: "Veuillez patienter avant de renvoyer un nouveau code." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body || {};

    if (!email) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre adresse email." },
        { status: 400 }
      );
    }

    const result = await resendVerificationCode(email);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors du renvoi du code." },
      { status: 500 }
    );
  }
}
