import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  usersJsonPath,
  usersJsonPathProjectLegacy,
} from "@/lib/user-store-path";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  /** 供他人注册时填写的邀请码（首次在设置中展示时生成） */
  inviteToken?: string;
};

/** 无用户数据时的种子账户（可用环境变量覆盖） */
export const DEFAULT_USERNAME = process.env.DEFAULT_AUTH_USERNAME ?? "evian";
export const DEFAULT_PASSWORD = process.env.DEFAULT_AUTH_PASSWORD ?? "990423";

let memoryUsers: UserRecord[] | null = null;

function builtinUser(): UserRecord {
  return {
    id: "user-evian",
    username: DEFAULT_USERNAME,
    passwordHash: hashPassword(DEFAULT_PASSWORD),
  };
}

function ensureBuiltin(users: UserRecord[]): UserRecord[] {
  if (users.some((u) => u.username === DEFAULT_USERNAME)) return users;
  return [...users, builtinUser()];
}

async function tryWriteDisk(users: UserRecord[]) {
  try {
    const target = usersJsonPath();
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(users, null, 2), "utf-8");
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
    .map((u) => {
      const raw = u as UserRecord & { inviteToken?: string };
      return {
        id: raw.id,
        username: raw.username,
        passwordHash: raw.passwordHash,
        ...(typeof raw.inviteToken === "string" && raw.inviteToken
          ? { inviteToken: raw.inviteToken }
          : {}),
      };
    });
}

async function readUsersFromDiskPaths(): Promise<UserRecord[] | null> {
  const paths =
    process.env.NODE_ENV === "development"
      ? [usersJsonPath(), usersJsonPathProjectLegacy()]
      : [usersJsonPath()];
  for (const p of paths) {
    try {
      const buf = await readFile(p, "utf-8");
      return parseUsers(JSON.parse(buf));
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function readUsers(): Promise<UserRecord[]> {
  if (memoryUsers) return memoryUsers;

  const parsed = await readUsersFromDiskPaths();
  if (parsed) {
    const users = ensureBuiltin(parsed);
    memoryUsers = users;
    /** 仅在补全内置账户等实际变更时落盘，避免无意义 write 触发 HMR 死循环 */
    if (users !== parsed) {
      await tryWriteDisk(users);
    }
    return users;
  }

  const users = ensureBuiltin([]);
  memoryUsers = users;
  await tryWriteDisk(users);
  return users;
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

function randomInviteSegment() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 注册用：环境变量 REGISTER_INVITE_CODES（逗号分隔）或任一已用户 inviteToken */
export async function isInviteCodeValid(code: string): Promise<boolean> {
  const c = code.trim();
  if (!c) return false;
  const fromEnv =
    process.env.REGISTER_INVITE_CODES?.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean) ??
    [];
  if (fromEnv.includes(c)) return true;
  const users = await readUsers();
  return users.some((u) => u.inviteToken === c);
}

export async function ensureUserInviteToken(userId: string): Promise<string> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error("用户不存在");
  let token = users[idx]!.inviteToken;
  if (!token) {
    token = `inv-${randomInviteSegment()}`;
    const next = [...users];
    next[idx] = { ...next[idx]!, inviteToken: token };
    await persistUsers(next);
  }
  return token;
}

export async function createUser(
  username: string,
  password: string,
  inviteCode: string,
): Promise<{ ok: true; user: UserRecord } | { ok: false; error: string }> {
  const trimmed = username.trim();
  if (trimmed.length < 2) return { ok: false, error: "用户名至少 2 个字符" };
  if (password.length < 6) return { ok: false, error: "密码至少 6 位" };
  if (!(await isInviteCodeValid(inviteCode))) {
    return { ok: false, error: "邀请码无效" };
  }
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
