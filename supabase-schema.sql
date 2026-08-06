-- ============================================================================
-- AgrabanArt CMS — Supabase schema
-- ============================================================================
-- HOW TO USE THIS FILE:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Open the SQL Editor in your Supabase dashboard
-- 3. Paste this entire file in and run it once
-- 4. Then go to Authentication -> Users and create yourself a user
--    (email + password) — this is what you'll log into the CMS with
-- 5. Copy the new user's UID (Authentication -> Users -> click your user)
--    and run this once, replacing the placeholder:
--      insert into admins (user_id) values ('paste-your-user-uid-here');
--    This is what grants your account write access — without this row,
--    your login will work but every CMS save/upload/delete will be
--    rejected by the RLS policies below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADMINS — allowlist of user IDs permitted to write data. Public visitors
-- are only ever granted read access; anyone not in this table who somehow
-- logs in still can't change anything.
-- ----------------------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- PROJECTS — covers all three Projects-page categories: 2d, 3d, animation.
--   category      '2d' | '3d' | 'animation'
--   image_key     R2 object key for a still image (2D pieces, 3D renders)
--   model_key     R2 object key for a .glb/.gltf file (3D interactive viewer)
--   youtube_id    the video ID from a YouTube URL (animation showreel only)
--   sort_order    controls display order within its category, lowest first
-- Not every column applies to every category — e.g. a '2d' row will only
-- ever use image_key, an 'animation' row will only ever use youtube_id.
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('2d', '3d', 'animation')),
  title text not null default 'Untitled Project',
  description text not null default '',
  image_key text,
  model_key text,
  youtube_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce max 6 items in the 2D Illustrations category at the database
-- level (in addition to the CMS UI blocking it) so the limit can't be
-- bypassed accidentally.
create or replace function enforce_2d_project_limit()
returns trigger as $$
begin
  if new.category = '2d' and (
    select count(*) from projects where category = '2d'
  ) >= 6 then
    raise exception 'Maximum of 6 2D Illustration projects allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_2d_project_limit on projects;
create trigger trg_enforce_2d_project_limit
  before insert on projects
  for each row execute function enforce_2d_project_limit();

-- ----------------------------------------------------------------------------
-- AWARDS — the Events & Achievements "Awards" section.
--   linked_exhibition_id  optional FK to the exhibition this award's
--                         "View related showcase" link should jump to
-- ----------------------------------------------------------------------------
create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Award',
  description text not null default '',
  year text not null default '',
  linked_exhibition_id uuid,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- EXHIBITIONS — the Events & Achievements "Exhibitions & Competitions"
-- section. Each row is one showcase block; its images live in
-- exhibition_images below.
-- ----------------------------------------------------------------------------
create table if not exists exhibitions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Exhibition',
  description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now that exhibitions exists, wire up the FK from awards.
alter table awards
  drop constraint if exists awards_linked_exhibition_id_fkey;
alter table awards
  add constraint awards_linked_exhibition_id_fkey
  foreign key (linked_exhibition_id) references exhibitions (id) on delete set null;

create table if not exists exhibition_images (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references exhibitions (id) on delete cascade,
  image_key text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- MEDIA_TRASH — soft-delete log. Whenever the CMS replaces or removes a
-- file (image, model, etc.), the old R2 object key gets logged here
-- instead of being deleted right away. The Trash tab in the CMS reads
-- this table so you can restore or permanently delete each item.
-- The actual R2 file is NOT deleted until you choose "Delete Permanently"
-- in the CMS — until then the file still physically exists in the bucket.
-- ----------------------------------------------------------------------------
create table if not exists media_trash (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null,
  original_filename text,
  source_table text not null,
  source_id uuid,
  source_column text not null,
  deleted_at timestamptz not null default now(),
  permanently_deleted boolean not null default false
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Public (anon) visitors: read-only on content tables, no access to admins
-- or media_trash at all.
-- Logged-in admins (present in the admins table): full read/write.
-- ============================================================================

alter table projects enable row level security;
alter table awards enable row level security;
alter table exhibitions enable row level security;
alter table exhibition_images enable row level security;
alter table media_trash enable row level security;
alter table admins enable row level security;

-- Helper: is the current logged-in user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql stable;

-- Public read access on content tables
create policy "public read projects" on projects for select using (true);
create policy "public read awards" on awards for select using (true);
create policy "public read exhibitions" on exhibitions for select using (true);
create policy "public read exhibition_images" on exhibition_images for select using (true);

-- Admin-only write access on content tables
create policy "admin write projects" on projects for all
  using (is_admin()) with check (is_admin());
create policy "admin write awards" on awards for all
  using (is_admin()) with check (is_admin());
create policy "admin write exhibitions" on exhibitions for all
  using (is_admin()) with check (is_admin());
create policy "admin write exhibition_images" on exhibition_images for all
  using (is_admin()) with check (is_admin());

-- media_trash and admins tables: admin-only, no public access at all
create policy "admin only media_trash" on media_trash for all
  using (is_admin()) with check (is_admin());
create policy "admin only admins table" on admins for all
  using (is_admin()) with check (is_admin());
