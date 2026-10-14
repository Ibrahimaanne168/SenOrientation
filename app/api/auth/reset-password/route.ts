import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword, confirmPassword } = body || {};

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Veuillez renseigner le nouveau mot de passe et sa confirmation." },
        { status: 400 }
      );
    }

    const result = await resetPasswordWithToken(token, newPassword, confirmPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du mot de passe." },
      { status: 500 }
    );
  }
}
