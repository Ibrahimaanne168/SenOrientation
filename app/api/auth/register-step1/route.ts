import { NextRequest, NextResponse } from "next/server";
import { initiateRegistration } from "@/lib/auth-store";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rate = checkRateLimit(`auth_reg1_${ip}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter une minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { fullName, email } = body || {};

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre nom complet et votre adresse email." },
        { status: 400 }
      );
    }

    const result = await initiateRegistration(fullName, email);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'envoi du code." },
      { status: 500 }
    );
  }
}
