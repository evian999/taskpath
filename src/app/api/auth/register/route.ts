import { NextResponse } from "next/server";
import { DEFAULT_USERNAME, createUser } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      inviteCode?: string;
    };
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const inviteCode = body.inviteCode ?? "";
    if (username === DEFAULT_USERNAME) {
      return NextResponse.json(
        { ok: false, error: "该用户名为系统保留账户" },
        { status: 400 },
      );
    }
    const result = await createUser(username, password, inviteCode);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "请求无效" }, { status: 400 });
  }
}
