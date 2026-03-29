import type { AppData } from "./types";
import { emptyAppData } from "./types";
import { parseAppData } from "./validate";

let cached: AppData | null = null;

export function getMemoryStore(): AppData {
  if (!cached) cached = emptyAppData();
  return cached;
}

export function setMemoryStore(data: AppData) {
  cached = data;
}

export function hydrateMemoryFromUnknown(raw: unknown) {
  cached = parseAppData(raw);
}
