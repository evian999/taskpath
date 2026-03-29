import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/session";
import { verifyCredentials } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username ?? "";
    const password = body.password ?? "";
    const user = await verifyCredentials(username, password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "用户名或密码错误" },
        { status: 401 },
      );
    }
    const token = await signSession(user.username, user.id);
    const res = NextResponse.json({ ok: true, username: user.username });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "请求无效" }, { status: 400 });
  }
}
