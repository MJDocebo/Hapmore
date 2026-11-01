-- ════════════════════════════════════════════════════════════════════════════
--  str(notes) — Supabase schema
--  (Internal identifiers such as the `hapmore` storage bucket and the `hapmore.app` login domain keep
--   their original names so existing projects, files and logins keep working after the rename.)
--  Run this whole file once in Supabase → SQL Editor → New query → Run.
--  It is idempotent: re-running it is safe (tables are kept, policies are re-created).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────── helpers ───────────────────────────────
create or replace function public.hm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────── folders ───────────────────────────────
-- Courses, projects and research topics (kind). One row = one sidebar folder.
create table if not exists public.folders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null default 'course' check (kind in ('course', 'project', 'research')),
  name         text not null default '',
  code         text,                       -- e.g. "CS 6210"
  term         text,                       -- e.g. "Fall 2026"
  icon         text,                       -- native emoji or "custom:<uuid>"
  cover        jsonb,                      -- { kind: gradient|color|image, value?, path?, posY }
  quick_notes  jsonb,                      -- TipTap document
  position     double precision not null default 0,
  collapsed    boolean not null default false,
  background   jsonb,                      -- page gradient override; null = follow the kind default in settings
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists folders_user_idx on public.folders (user_id, kind, position);
-- Upgrade existing projects (safe to re-run)
alter table public.folders add column if not exists background jsonb;

-- ─────────────────────────────── notes ───────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id   uuid not null references public.folders (id) on delete cascade,
  type        text not null default 'standard' constraint notes_type_check check (type in ('standard', 'four_zone', 'pdf')),
  title       text not null default '',
  subtitle    text,
  icon        text,
  cover       jsonb,
  tags        text[] not null default '{}',
  page_width  text check (page_width in ('normal', 'wide', 'full')),  -- null = follow the user's setting
  -- standard: TipTap doc  |  four_zone: { layout, primary, zones: [{ id, title, emoji, color, collapsed, doc }] }
  -- pdf: { pdf: { path, name, size }, doc: TipTap doc, split }
  content     jsonb,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Upgrade existing projects (safe to re-run)
alter table public.notes add column if not exists page_width text check (page_width in ('normal', 'wide', 'full'));
alter table public.notes drop constraint if exists notes_type_check;
alter table public.notes add constraint notes_type_check check (type in ('standard', 'four_zone', 'pdf'));

create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists notes_folder_idx on public.notes (folder_id, position);
create index if not exists notes_tags_idx on public.notes using gin (tags);

-- ─────────────────────────────── tasks ───────────────────────────────
-- Tasks, deadlines and reminders. folder_id null = general (Home page).
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id   uuid references public.folders (id) on delete cascade,
  title       text not null,
  kind        text not null default 'task' check (kind in ('task', 'deadline', 'reminder')),
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks (user_id, done, due_date);
create index if not exists tasks_folder_idx on public.tasks (folder_id);

-- ─────────────────────────────── annotations ───────────────────────────────
-- Margin notes attached to a block (block_id = data-block-id inside the note's content).
create table if not exists public.annotations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id           uuid not null references public.notes (id) on delete cascade,
  block_id          text,
  quote             text,
  body              text not null default '',
  show_on_overview  boolean not null default false,
  resolved          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists annotations_note_idx on public.annotations (note_id);
create index if not exists annotations_overview_idx on public.annotations (user_id) where show_on_overview and not resolved;

-- ─────────────────────────────── custom emojis ───────────────────────────────
create table if not exists public.custom_emojis (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (name ~ '^[a-z0-9_+-]{1,40}$'),
  storage_path  text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

-- ─────────────────────────────── user settings ───────────────────────────────
-- Theme, typography, color presets, custom text styles, 4-zone defaults.
create table if not exists public.user_settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────── updated_at triggers ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['folders', 'notes', 'tasks', 'annotations', 'user_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.hm_touch_updated_at()', t, t);
  end loop;
end $$;

-- ─────────────────────────────── row level security ───────────────────────────────
-- Every row is private to its owner. Inserts/updates must also point at the owner's own parents.
alter table public.folders       enable row level security;
alter table public.notes         enable row level security;
alter table public.tasks         enable row level security;
alter table public.annotations   enable row level security;
alter table public.custom_emojis enable row level security;
alter table public.user_settings enable row level security;

-- folders
drop policy if exists "folders: owner read"   on public.folders;
drop policy if exists "folders: owner insert" on public.folders;
drop policy if exists "folders: owner update" on public.folders;
drop policy if exists "folders: owner delete" on public.folders;
create policy "folders: owner read"   on public.folders for select to authenticated using (user_id = (select auth.uid()));
create policy "folders: owner insert" on public.folders for insert to authenticated with check (user_id = (select auth.uid()));
create policy "folders: owner update" on public.folders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "folders: owner delete" on public.folders for delete to authenticated using (user_id = (select auth.uid()));

-- notes
drop policy if exists "notes: owner read"   on public.notes;
drop policy if exists "notes: owner insert" on public.notes;
drop policy if exists "notes: owner update" on public.notes;
drop policy if exists "notes: owner delete" on public.notes;
create policy "notes: owner read" on public.notes for select to authenticated using (user_id = (select auth.uid()));
create policy "notes: owner insert" on public.notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid()))
  );
create policy "notes: owner update" on public.notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid()))
  );
create policy "notes: owner delete" on public.notes for delete to authenticated using (user_id = (select auth.uid()));

-- tasks
drop policy if exists "tasks: owner read"   on public.tasks;
drop policy if exists "tasks: owner insert" on public.tasks;
drop policy if exists "tasks: owner update" on public.tasks;
drop policy if exists "tasks: owner delete" on public.tasks;
create policy "tasks: owner read" on public.tasks for select to authenticated using (user_id = (select auth.uid()));
create policy "tasks: owner insert" on public.tasks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (folder_id is null or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())))
  );
create policy "tasks: owner update" on public.tasks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (folder_id is null or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())))
  );
create policy "tasks: owner delete" on public.tasks for delete to authenticated using (user_id = (select auth.uid()));

-- annotations
drop policy if exists "annotations: owner read"   on public.annotations;
drop policy if exists "annotations: owner insert" on public.annotations;
drop policy if exists "annotations: owner update" on public.annotations;
drop policy if exists "annotations: owner delete" on public.annotations;
create policy "annotations: owner read" on public.annotations for select to authenticated using (user_id = (select auth.uid()));
create policy "annotations: owner insert" on public.annotations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid()))
  );
create policy "annotations: owner update" on public.annotations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid()))
  );
create policy "annotations: owner delete" on public.annotations for delete to authenticated using (user_id = (select auth.uid()));

-- custom emojis
drop policy if exists "emojis: owner all" on public.custom_emojis;
create policy "emojis: owner all" on public.custom_emojis for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and split_part(storage_path, '/', 1) = (select auth.uid())::text);

-- user settings
drop policy if exists "settings: owner all" on public.user_settings;
create policy "settings: owner all" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Privileges: signed-in users only; the anon role gets nothing.
revoke all on public.folders, public.notes, public.tasks, public.annotations, public.custom_emojis, public.user_settings from anon;
grant select, insert, update, delete on public.folders, public.notes, public.tasks, public.annotations, public.custom_emojis, public.user_settings to authenticated;

-- ─────────────────────────────── storage ───────────────────────────────
-- Private bucket for images, covers, custom emojis and PDFs. Paths: <user-id>/<images|covers|emojis|pdfs>/<uuid>.<ext>
-- 50 MB per file (PDFs; images are still capped at 10 MB by the app). Supabase's free plan also caps uploads at 50 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hapmore', 'hapmore', false, 52428800,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/bmp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hapmore: owner read"   on storage.objects;
drop policy if exists "hapmore: owner insert" on storage.objects;
drop policy if exists "hapmore: owner update" on storage.objects;
drop policy if exists "hapmore: owner delete" on storage.objects;
create policy "hapmore: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'hapmore' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hapmore: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'hapmore' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hapmore: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'hapmore' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'hapmore' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hapmore: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'hapmore' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ════════════════════════════════════════════════════════════════════════════
--  Users: str(notes) has no public sign-up. Create accounts in
--  Authentication → Users → Add user → "Create new user"
--    email:    <username>@hapmore.app     (must match VITE_USERNAME_DOMAIN)
--    password: …                          ✔ Auto Confirm User
--  …or run:  node scripts/create-user.mjs <username> <password>   (uses the service-role key)
--  Then disable sign-ups: Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
-- ════════════════════════════════════════════════════════════════════════════
