import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, updateStudentProfile, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUser(sessionId);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json({
    user,
    profile: user.profile,
    completeness: user.profileCompleteness,
  });
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUser(sessionId);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await updateStudentProfile(user.id, body || {});

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du profil." },
      { status: 500 }
    );
  }
}
