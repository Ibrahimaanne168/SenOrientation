import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationCode } from "@/lib/auth-store";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rate = checkRateLimit(`auth_verify_${ip}`, { limit: 15, windowMs: 60 * 1000 });
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez patienter une minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, code } = body || {};

    if (!email || !code) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre email et le code de vérification reçu." },
        { status: 400 }
      );
    }

    const result = await verifyRegistrationCode(email, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      registrationToken: result.registrationToken,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la vérification du code." },
      { status: 500 }
    );
  }
}
