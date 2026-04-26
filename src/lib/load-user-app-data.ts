import { readFile } from "fs/promises";
import { join } from "path";
import { getMemoryStore, setMemoryStore } from "@/lib/memory-store";
import {
  isRedisConfigured,
  loadFromRedis,
} from "@/lib/redis-store";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  loadAppDataFromSupabase,
} from "@/lib/supabase/app-data";
import { loadTaskHttpPrefsFromSupabase } from "@/lib/supabase/task-http-prefs";
import { parseAppData } from "@/lib/validate";
import type { AppData } from "@/lib/types";
import {
  userStorePath,
  userStorePathProjectLegacy,
} from "@/lib/user-store-path";

const STORE_LEGACY = join(process.cwd(), "data", "store.json");

function mergeTaskHttpPrefs(
  data: AppData,
  taskHttp?: import("@/lib/types").TaskHttpApiPreferences,
): AppData {
  if (!taskHttp) return data;
  return {
    ...data,
    preferences: {
      ...data.preferences,
      taskHttpApi: taskHttp,
    },
  };
}

/** 从当前存储后端加载指定用户的 AppData（不写 cookie） */
export async function loadAppDataForUser(userId: string): Promise<AppData> {
  if (isSupabaseConfigured()) {
    try {
      const data = await loadAppDataFromSupabase(userId);
      const th = await loadTaskHttpPrefsFromSupabase(userId);
      const merged = mergeTaskHttpPrefs(data, th);
      setMemoryStore(merged);
      return merged;
    } catch (e) {
      console.error("[loadAppDataForUser] Supabase load failed:", e);
      throw e;
    }
  }

  if (isRedisConfigured()) {
    const fromRedis = await loadFromRedis(userId);
    if (fromRedis) {
      setMemoryStore(fromRedis);
      return fromRedis;
    }
  }

  const localPaths =
    process.env.NODE_ENV === "development"
      ? [userStorePath(userId), userStorePathProjectLegacy(userId)]
      : [userStorePath(userId)];
  for (const p of localPaths) {
    try {
      const buf = await readFile(p, "utf-8");
      const data = parseAppData(JSON.parse(buf));
      setMemoryStore(data);
      return data;
    } catch {
      /* try next path */
    }
  }

  try {
    const buf = await readFile(STORE_LEGACY, "utf-8");
    const data = parseAppData(JSON.parse(buf));
    setMemoryStore(data);
    return data;
  } catch {
    /* no legacy file */
  }

  return getMemoryStore();
}
