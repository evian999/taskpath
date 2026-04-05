import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemoryStore, setMemoryStore } from "@/lib/memory-store";
import { loadAppDataForUser } from "@/lib/load-user-app-data";
import {
  isRedisConfigured,
  saveToRedis,
} from "@/lib/redis-store";
import { COOKIE, verifySessionToken } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { saveAppDataToSupabase } from "@/lib/supabase/app-data";
import { parseAppData } from "@/lib/validate";

function userStorePath(userId: string) {
  return join(process.cwd(), "data", "stores", `${userId}.json`);
}

async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await loadAppDataForUser(userId);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/data] GET failed:", e);
    if (isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "从数据库加载失败，请检查 Supabase 配置与 SQL 迁移是否已执行",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(getMemoryStore());
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const data = parseAppData(body);
    setMemoryStore(data);

    if (isSupabaseConfigured()) {
      try {
        await saveAppDataToSupabase(userId, data);
      } catch (e) {
        console.error("[api/data] Supabase save failed:", e);
        return NextResponse.json(
          { ok: false, error: "持久化失败（请检查 Supabase 与数据库函数）" },
          { status: 503 },
        );
      }
    } else if (isRedisConfigured()) {
      try {
        await saveToRedis(userId, data);
      } catch (e) {
        console.error("[api/data] Redis save failed:", e);
        return NextResponse.json(
          { ok: false, error: "持久化失败（请检查 Redis 配置）" },
          { status: 503 },
        );
      }
    }

    try {
      await mkdir(join(process.cwd(), "data", "stores"), { recursive: true });
      await writeFile(
        userStorePath(userId),
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch {
      /* Vercel 等环境无持久磁盘 */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
