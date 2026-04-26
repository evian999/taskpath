-- Flex-Off 使用 __inbox__ / __archive__ / __recent_deleted__ 等虚拟 folder_id，
-- 这些键不会作为行出现在 folders 表中；tasks.folder_id 上的外键会导致归档等任务无法写入。
alter table public.tasks drop constraint if exists tasks_folder_id_fkey;
