-- 任务 HTTP API：按 token 反查用户（与 AppData.preferences 同步）
create table if not exists public.user_preferences (
  user_id text primary key,
  task_http_api_enabled boolean not null default false,
  task_http_api_token text unique
);

create index if not exists idx_user_preferences_task_http_token
  on public.user_preferences (task_http_api_token)
  where task_http_api_token is not null;
