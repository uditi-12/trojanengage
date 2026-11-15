import { NextResponse, type NextRequest } from "next/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

// Student pages require a login. The signature is verified by every API route; this edge check only
// decides whether to bounce to /login — and slides the cookie expiry so students stay signed in.
export function middleware(req: NextRequest) {
  const raw = req.cookies.get("trojanengage_session")?.value ?? "";
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  const isStudentPage = /^\/(student|feedback|checkin)(\/|$)/.test(req.nextUrl.pathname);
  if (isStudentPage && !value.startsWith("student:")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (raw) res.cookies.set("trojanengage_session", raw, { path: "/", httpOnly: true, sameSite: "lax", maxAge: ONE_YEAR });
  return res;
}

export const config = { matcher: ["/student/:path*", "/feedback/:path*", "/checkin/:path*", "/event/:path*", "/"] };
