-- 任务 @提及（JSON 字符串数组，与 AppData.tasks[].mentions 对齐）
alter table public.tasks
  add column if not exists mentions jsonb default '[]'::jsonb;

create or replace function public.replace_user_app_data (p_user_id text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.task_edges where user_id = p_user_id;
  delete from public.layout_task_positions where user_id = p_user_id;
  delete from public.layout_group_rects where user_id = p_user_id;
  delete from public.layout_folder_rects where user_id = p_user_id;
  delete from public.task_group_tasks
    where group_id in (select id from public.task_groups where user_id = p_user_id);
  delete from public.task_groups where user_id = p_user_id;
  delete from public.task_tags
    where task_id in (select id from public.tasks where user_id = p_user_id);
  delete from public.tasks where user_id = p_user_id;
  delete from public.folders where user_id = p_user_id;
  delete from public.tags where user_id = p_user_id;

  insert into public.folders (id, user_id, name, color)
  select
    e->>'id',
    p_user_id,
    e->>'name',
    nullif(trim(e->>'color'), '')
  from jsonb_array_elements(coalesce(p_data->'folders', '[]'::jsonb)) as e;

  insert into public.tags (id, user_id, name, color)
  select
    e->>'id',
    p_user_id,
    e->>'name',
    nullif(trim(e->>'color'), '')
  from jsonb_array_elements(coalesce(p_data->'tags', '[]'::jsonb)) as e;

  insert into public.tasks (
    id,
    user_id,
    title,
    created_at,
    completed_at,
    result,
    folder_id,
    priority,
    due_at,
    progress_current,
    progress_total,
    abandoned_at,
    abandon_reason,
    spaced_repetition_enabled,
    mentions
  )
  select
    e->>'id',
    p_user_id,
    e->>'title',
    coalesce((e->>'createdAt')::timestamptz, now()),
    nullif(trim(e->>'completedAt'), '')::timestamptz,
    nullif(trim(e->>'result'), ''),
    nullif(trim(e->>'folderId'), ''),
    nullif(trim(e->>'priority'), ''),
    nullif(trim(e->>'dueAt'), '')::timestamptz,
    case
      when nullif(trim(e->>'progressCurrent'), '') is null then null
      else (e->>'progressCurrent')::integer
    end,
    case
      when nullif(trim(e->>'progressTotal'), '') is null then null
      else (e->>'progressTotal')::integer
    end,
    nullif(trim(e->>'abandonedAt'), '')::timestamptz,
    nullif(trim(e->>'abandonReason'), ''),
    coalesce((e->>'spacedRepetitionEnabled')::boolean, false),
    coalesce(e->'mentions', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_data->'tasks', '[]'::jsonb)) as e;

  insert into public.task_tags (task_id, tag_id)
  select
    e->>'id',
    x.v
  from jsonb_array_elements(coalesce(p_data->'tasks', '[]'::jsonb)) as e
  cross join lateral jsonb_array_elements_text(coalesce(e->'tagIds', '[]'::jsonb)) as x(v);

  insert into public.task_groups (id, user_id, name)
  select
    e->>'id',
    p_user_id,
    e->>'name'
  from jsonb_array_elements(coalesce(p_data->'groups', '[]'::jsonb)) as e;

  insert into public.task_group_tasks (group_id, task_id, sort_order)
  select
    g.elem->>'id',
    t.val,
    (t.ord::int - 1)
  from jsonb_array_elements(coalesce(p_data->'groups', '[]'::jsonb)) as g(elem)
  cross join lateral jsonb_array_elements_text(coalesce(g.elem->'taskIds', '[]'::jsonb))
    with ordinality as t(val, ord);

  insert into public.task_edges (id, user_id, source_task_id, target_task_id, label)
  select
    e->>'id',
    p_user_id,
    e->>'source',
    e->>'target',
    nullif(trim(e->>'label'), '')
  from jsonb_array_elements(coalesce(p_data->'edges', '[]'::jsonb)) as e;

  insert into public.layout_task_positions (user_id, task_id, x, y)
  select
    p_user_id,
    k,
    (v->>'x')::double precision,
    (v->>'y')::double precision
  from jsonb_each(coalesce(p_data->'layout'->'positions', '{}'::jsonb)) as t(k, v);

  insert into public.layout_group_rects (user_id, group_id, x, y, w, h)
  select
    p_user_id,
    k,
    (v->>'x')::double precision,
    (v->>'y')::double precision,
    (v->>'w')::double precision,
    (v->>'h')::double precision
  from jsonb_each(coalesce(p_data->'layout'->'groupRects', '{}'::jsonb)) as t(k, v);

  insert into public.layout_folder_rects (user_id, folder_key, x, y, w, h)
  select
    p_user_id,
    k,
    (v->>'x')::double precision,
    (v->>'y')::double precision,
    (v->>'w')::double precision,
    (v->>'h')::double precision
  from jsonb_each(coalesce(p_data->'layout'->'folderRects', '{}'::jsonb)) as t(k, v);
end;
$$;
