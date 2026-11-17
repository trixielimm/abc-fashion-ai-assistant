import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";
import { PRESENTATION_MODE } from "@/lib/demo/config";

export async function proxy(request: NextRequest) {
  if (PRESENTATION_MODE) return NextResponse.next({ request });
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
