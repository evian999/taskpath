import { mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * 本地 JSON 快照目录（无 Supabase/Redis 时使用）。
 *
 * 开发环境默认写到系统临时目录，避免写入仓库内 `data/stores` 触发 Turbopack
 * 文件监视 → 无休止 “Fast rebuild”。
 *
 * 可通过环境变量 FLEX_OFF_DATA_DIR 覆盖（任意环境）。
 */
export function userStoreDir(): string {
  if (process.env.FLEX_OFF_DATA_DIR?.trim()) {
    return process.env.FLEX_OFF_DATA_DIR.trim();
  }
  if (process.env.NODE_ENV === "development") {
    return join(tmpdir(), "flex-off-dev-stores");
  }
  return join(process.cwd(), "data", "stores");
}

export function userStorePath(userId: string): string {
  return join(userStoreDir(), `${userId}.json`);
}

/** 开发模式下仍尝试读取仓库内旧路径，便于迁移已有数据 */
export function userStorePathProjectLegacy(userId: string): string {
  return join(process.cwd(), "data", "stores", `${userId}.json`);
}

export async function ensureUserStoreDir(): Promise<void> {
  await mkdir(userStoreDir(), { recursive: true });
}

/** 本地 users.json；开发环境与任务快照同目录（临时盘），避免写入仓库触发 HMR */
export function usersJsonPath(): string {
  if (process.env.FLEX_OFF_USERS_FILE?.trim()) {
    return process.env.FLEX_OFF_USERS_FILE.trim();
  }
  if (process.env.NODE_ENV === "development") {
    return join(userStoreDir(), "_users.json");
  }
  return join(process.cwd(), "data", "users.json");
}

/** 开发时迁移：此前默认写在项目 data/users.json */
export function usersJsonPathProjectLegacy(): string {
  return join(process.cwd(), "data", "users.json");
}
