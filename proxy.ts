import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { decrypt } from "@/lib/session"

const protectedRoutes = ["/dashboard", "/settings"]

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtected = protectedRoutes.some((route) =>
    path.startsWith(route)
  )
  const isPublicAuthRoute = path === "/login" || path === "/register"

  const sessionCookie = request.cookies.get("session")?.value
  const session = await decrypt(sessionCookie)

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isPublicAuthRoute && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
