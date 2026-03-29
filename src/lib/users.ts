import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { hashPassword, verifyPassword } from "@/lib/password";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
};

const USERS_FILE = join(process.cwd(), "data", "users.json");

/** 默认账户（本地种子与 Vercel 环境变量可覆盖） */
export const DEFAULT_USERNAME = process.env.DEFAULT_AUTH_USERNAME ?? "evain";
export const DEFAULT_PASSWORD = process.env.DEFAULT_AUTH_PASSWORD ?? "990423";

let memoryUsers: UserRecord[] | null = null;

function builtinUser(): UserRecord {
  return {
    id: "user-evain",
    username: DEFAULT_USERNAME,
    passwordHash: hashPassword(DEFAULT_PASSWORD),
  };
}

function ensureBuiltin(users: UserRecord[]): UserRecord[] {
  if (users.some((u) => u.username === DEFAULT_USERNAME)) return users;
  return [...users, builtinUser()];
}

async function ensureDataDir() {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
}

async function tryWriteDisk(users: UserRecord[]) {
  try {
    await ensureDataDir();
    await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch {
    /* 只读文件系统（如 Vercel）仅使用内存 */
  }
}

function parseUsers(raw: unknown): UserRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (u): u is UserRecord =>
        u &&
        typeof u === "object" &&
        typeof (u as UserRecord).id === "string" &&
        typeof (u as UserRecord).username === "string" &&
        typeof (u as UserRecord).passwordHash === "string",
    )
    .map((u) => ({
      id: u.id,
      username: u.username,
      passwordHash: u.passwordHash,
    }));
}

export async function readUsers(): Promise<UserRecord[]> {
  if (memoryUsers) return memoryUsers;

  try {
    const buf = await readFile(USERS_FILE, "utf-8");
    let users = ensureBuiltin(parseUsers(JSON.parse(buf)));
    memoryUsers = users;
    await tryWriteDisk(users);
    return users;
  } catch {
    const users = ensureBuiltin([]);
    memoryUsers = users;
    await tryWriteDisk(users);
    return users;
  }
}

async function persistUsers(users: UserRecord[]) {
  memoryUsers = users;
  await tryWriteDisk(users);
}

export async function findUserByUsername(
  username: string,
): Promise<UserRecord | undefined> {
  const users = await readUsers();
  return users.find((u) => u.username === username);
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await findUserByUsername(username.trim());
  if (!user) return null;
  if (verifyPassword(password, user.passwordHash)) return user;
  return null;
}

export async function createUser(
  username: string,
  password: string,
): Promise<{ ok: true; user: UserRecord } | { ok: false; error: string }> {
  const trimmed = username.trim();
  if (trimmed.length < 2) return { ok: false, error: "用户名至少 2 个字符" };
  if (password.length < 6) return { ok: false, error: "密码至少 6 位" };
  const users = await readUsers();
  if (users.some((u) => u.username === trimmed)) {
    return { ok: false, error: "该用户名已被注册" };
  }
  const user: UserRecord = {
    id: crypto.randomUUID(),
    username: trimmed,
    passwordHash: hashPassword(password),
  };
  await persistUsers([...users, user]);
  return { ok: true, user };
}
