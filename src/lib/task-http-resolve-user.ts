import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { Redis } from "@upstash/redis";
import { parseAppData } from "@/lib/validate";
import { isRedisConfigured } from "@/lib/redis-store";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { findUserIdByTaskHttpTokenSupabase } from "@/lib/supabase/task-http-prefs";

/** Upstash `scan` 标准返回；显式标注可避免 TS 在游标循环里循环推断为 implicit any */
type RedisScanPage = [string, string[]];

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function findUserIdByTokenRedisScan(token: string): Promise<string | null> {
  const r = redisClient();
  if (!r) return null;
  let cursor: string | number = 0;
  for (;;) {
    const scanResult: RedisScanPage = await r.scan(cursor, {
      match: "algo-todo:v1:*",
      count: 100,
    });
    const nextCursor = scanResult[0];
    const keys = scanResult[1];
    for (const key of keys) {
      const raw = await r.get(key);
      if (raw == null) continue;
      const str = typeof raw === "string" ? raw : JSON.stringify(raw);
      let data: ReturnType<typeof parseAppData>;
      try {
        data = parseAppData(JSON.parse(str));
      } catch {
        continue;
      }
      const th = data.preferences?.taskHttpApi;
      if (th?.enabled && th.token === token) {
        const userId = key.replace("algo-todo:v1:", "");
        return userId || null;
      }
    }
    if (nextCursor === "0") break;
    cursor = nextCursor;
  }
  return null;
}

async function findUserIdByTokenFiles(token: string): Promise<string | null> {
  const dir = join(process.cwd(), "data", "stores");
  try {
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const userId = f.slice(0, -".json".length);
      try {
        const buf = await readFile(join(dir, f), "utf-8");
        const data = parseAppData(JSON.parse(buf));
        const th = data.preferences?.taskHttpApi;
        if (th?.enabled && th.token === token) return userId;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 根据任务 HTTP API token 解析 userId（需该用户已开启开关且 token 匹配）
 */
export async function findUserIdByTaskHttpToken(
  token: string,
): Promise<string | null> {
  const t = token.trim();
  if (t.length < 8) return null;

  if (isSupabaseConfigured()) {
    const uid = await findUserIdByTaskHttpTokenSupabase(t);
    if (uid) return uid;
  }

  if (isRedisConfigured()) {
    const uid = await findUserIdByTokenRedisScan(t);
    if (uid) return uid;
  }

  return findUserIdByTokenFiles(t);
}
