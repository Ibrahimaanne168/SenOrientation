import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/chat";

  // Protection contre Open Redirect : s'assurer que next commence par "/" et pas "//"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/chat";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Redirection vers login en cas d'erreur ou d'absence de code
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
