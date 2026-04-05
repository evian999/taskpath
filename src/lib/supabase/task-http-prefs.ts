import type { TaskHttpApiPreferences } from "@/lib/types";
import { getSupabaseAdmin } from "./admin";

export async function loadTaskHttpPrefsFromSupabase(
  userId: string,
): Promise<TaskHttpApiPreferences | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return undefined;
  const { data, error } = await sb
    .from("user_preferences")
    .select("task_http_api_enabled,task_http_api_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[loadTaskHttpPrefsFromSupabase]", error.message);
    return undefined;
  }
  if (!data) return undefined;
  const row = data as {
    task_http_api_enabled: boolean;
    task_http_api_token: string | null;
  };
  return {
    enabled: Boolean(row.task_http_api_enabled),
    token: row.task_http_api_token ?? "",
  };
}

export async function saveTaskHttpPrefsToSupabase(
  userId: string,
  prefs: TaskHttpApiPreferences | undefined,
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const enabled = prefs?.enabled === true;
  const token = prefs?.token?.trim() ?? "";
  const { error } = await sb.from("user_preferences").upsert(
    {
      user_id: userId,
      task_http_api_enabled: enabled,
      task_http_api_token: enabled && token ? token : null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function findUserIdByTaskHttpTokenSupabase(
  token: string,
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("user_preferences")
    .select("user_id")
    .eq("task_http_api_token", token)
    .eq("task_http_api_enabled", true)
    .maybeSingle();
  if (error) {
    console.warn("[findUserIdByTaskHttpTokenSupabase]", error.message);
    return null;
  }
  if (!data) return null;
  return (data as { user_id: string }).user_id;
}
