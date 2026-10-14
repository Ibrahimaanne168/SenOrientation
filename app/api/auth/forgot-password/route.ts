import { NextRequest, NextResponse } from "next/server";
import { initiatePasswordReset } from "@/lib/auth-store";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rate = checkRateLimit(`auth_forgot_${ip}`, { limit: 5, windowMs: 60 * 1000 });
    if (!rate.success) {
      return NextResponse.json(
        { error: "Veuillez patienter avant de faire une nouvelle demande." },
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

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      "http://localhost:3000";

    const cleanOrigin = origin.replace(/\/+$/, "");
    const result = await initiatePasswordReset(email, cleanOrigin);

    // Toujours renvoyer une réponse neutre pour ne pas divulguer l'existence du compte
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la demande de réinitialisation." },
      { status: 500 }
    );
  }
}
