import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionCookieValue, verifySessionToken } from "@/lib/session";
import { ensureUserInviteToken } from "@/lib/users";

async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = readSessionCookieValue((name) => jar.get(name));
  if (!token) return null;
  try {
    const { sub } = await verifySessionToken(token);
    return sub;
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    const inviteToken = await ensureUserInviteToken(userId);
    return NextResponse.json({ inviteToken });
  } catch {
    return NextResponse.json({ error: "无法生成邀请码" }, { status: 500 });
  }
}
