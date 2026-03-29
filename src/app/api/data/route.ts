import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getMemoryStore, setMemoryStore } from "@/lib/memory-store";
import { parseAppData } from "@/lib/validate";

const STORE = join(process.cwd(), "data", "store.json");

async function ensureDataDir() {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
}

export async function GET() {
  try {
    await ensureDataDir();
    const buf = await readFile(STORE, "utf-8");
    const data = parseAppData(JSON.parse(buf));
    setMemoryStore(data);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(getMemoryStore());
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const data = parseAppData(body);
    setMemoryStore(data);
    try {
      await ensureDataDir();
      await writeFile(STORE, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      /* Vercel 等环境仅保留进程内内存 */
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
