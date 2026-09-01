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
--
-- IF YOU ALREADY RAN AN EARLIER VERSION OF THIS FILE: this version is safe
-- to run again in full — every statement uses "if not exists" / "or
-- replace" so it won't duplicate or break your existing data. This is the
-- easiest way to pick up the newer tables (home_content, contact_links,
-- contact_settings) and the widened 6-item cap.
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

-- Enforce max 6 items PER CATEGORY (2D Illustrations, 3D Modelling, and
-- Animation Showreel all capped at 6) at the database level, in addition
-- to the CMS UI blocking it, so the limit can't be bypassed accidentally.
create or replace function enforce_project_category_limit()
returns trigger as $$
begin
  if (select count(*) from projects where category = new.category) >= 6 then
    raise exception 'Maximum of 6 % projects allowed', new.category;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_2d_project_limit on projects;
drop trigger if exists trg_enforce_project_category_limit on projects;
create trigger trg_enforce_project_category_limit
  before insert on projects
  for each row execute function enforce_project_category_limit();

-- ----------------------------------------------------------------------------
-- HOME_CONTENT — single-row settings table for the Home page hero.
--   video_key   R2 object key for the looping background video (mp4)
--   tagline     the short line of text under the site title
-- Always exactly one row (id fixed to 1) — the CMS reads/writes that row.
-- ----------------------------------------------------------------------------
create table if not exists home_content (
  id int primary key default 1,
  video_key text,
  tagline text not null default 'Bringing imagined worlds to life through characters, creatures and visual storytelling',
  updated_at timestamptz not null default now(),
  constraint home_content_singleton check (id = 1)
);
insert into home_content (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- CONTACT_LINKS — the row of social/contact buttons on the Contact page.
--   label   button text, e.g. "Instagram"
--   url     where it goes, e.g. "https://instagram.com/..." or "mailto:..."
-- ----------------------------------------------------------------------------
create table if not exists contact_links (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Link',
  url text not null default '#',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CONTACT_SETTINGS — single-row settings for the resume/CV download button.
--   resume_key           R2 object key for the resume PDF
--   cv_key                R2 object key for the CV PDF
--   download_button_label  editable text on the button itself
-- Clicking the button on the live site triggers both files to download
-- (whichever of the two are actually set).
-- ----------------------------------------------------------------------------
create table if not exists contact_settings (
  id int primary key default 1,
  resume_key text,
  cv_key text,
  download_button_label text not null default 'Download Resume / CV',
  updated_at timestamptz not null default now(),
  constraint contact_settings_singleton check (id = 1)
);
insert into contact_settings (id) values (1) on conflict (id) do nothing;

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
-- file (image, model, resume, video, etc.), the old R2 object key gets
-- logged here instead of being deleted right away. The Trash tab in the
-- CMS reads this table so you can restore or permanently delete each item.
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

-- Allow source_id to be nullable for singleton tables (home_content /
-- contact_settings use a fixed int id, not a uuid) — trash entries for
-- those just won't have a source_id to restore via, which is fine since
-- restoring for those simply re-runs the update by table name.
alter table media_trash alter column source_id drop not null;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Public (anon) visitors: read-only on content tables, no access to admins
-- or media_trash at all.
-- Logged-in admins (present in the admins table): full read/write.
-- ============================================================================

alter table projects enable row level security;
alter table home_content enable row level security;
alter table contact_links enable row level security;
alter table contact_settings enable row level security;
alter table awards enable row level security;
alter table exhibitions enable row level security;
alter table exhibition_images enable row level security;
alter table media_trash enable row level security;
alter table admins enable row level security;

-- Helper: is the current logged-in user an admin?
-- COMMENT: this MUST be security definer. Without it, this function's own
-- query against `admins` triggers the RLS policy on `admins` below, which
-- itself calls is_admin() again — infinite recursion, surfacing as
-- Postgres's "stack depth limit exceeded" error on every single write.
-- security definer makes this specific lookup run with the function
-- owner's privileges (bypassing RLS) instead of the caller's, breaking
-- the loop.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Additional columns for the project detail page:
--   thumbnail_key   a separately-cropped image (fixed 4:5) used specifically
--                   for the gallery tile — kept distinct from image_key so
--                   the thumbnail crop and the detail-page hero image can
--                   show different framing of the same piece
--   linkedin_url     optional link to a related LinkedIn post, shown at the
--                     bottom of the project detail page
alter table projects add column if not exists thumbnail_key text;
alter table projects add column if not exists linkedin_url text;

-- ----------------------------------------------------------------------------
-- PROJECT_IMAGES — up to 3 extra "support" images shown on a project's
-- detail page (project-template.html), below the main hero image.
-- ----------------------------------------------------------------------------
create table if not exists project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  image_key text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table project_images enable row level security;

drop policy if exists "public read project_images" on project_images;
create policy "public read project_images" on project_images for select using (true);

drop policy if exists "admin write project_images" on project_images;
create policy "admin write project_images" on project_images for all
  using (is_admin()) with check (is_admin());

-- Public read access on content tables
drop policy if exists "public read projects" on projects;
create policy "public read projects" on projects for select using (true);

drop policy if exists "public read home_content" on home_content;
create policy "public read home_content" on home_content for select using (true);

drop policy if exists "public read contact_links" on contact_links;
create policy "public read contact_links" on contact_links for select using (true);

drop policy if exists "public read contact_settings" on contact_settings;
create policy "public read contact_settings" on contact_settings for select using (true);

drop policy if exists "public read awards" on awards;
create policy "public read awards" on awards for select using (true);

drop policy if exists "public read exhibitions" on exhibitions;
create policy "public read exhibitions" on exhibitions for select using (true);

drop policy if exists "public read exhibition_images" on exhibition_images;
create policy "public read exhibition_images" on exhibition_images for select using (true);

-- Admin-only write access on content tables
drop policy if exists "admin write projects" on projects;
create policy "admin write projects" on projects for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write home_content" on home_content;
create policy "admin write home_content" on home_content for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write contact_links" on contact_links;
create policy "admin write contact_links" on contact_links for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write contact_settings" on contact_settings;
create policy "admin write contact_settings" on contact_settings for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write awards" on awards;
create policy "admin write awards" on awards for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write exhibitions" on exhibitions;
create policy "admin write exhibitions" on exhibitions for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write exhibition_images" on exhibition_images;
create policy "admin write exhibition_images" on exhibition_images for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- ABOUT_CONTENT — single-row settings table for the About Me page's three
-- text sections. Soft skills is kept as free text (not a structured list)
-- since it doesn't need icons the way technical skills does.
-- ----------------------------------------------------------------------------
create table if not exists about_content (
  id int primary key default 1,
  background text not null default '',
  education text not null default '',
  soft_skills text not null default '',
  updated_at timestamptz not null default now(),
  constraint about_content_singleton check (id = 1)
);
insert into about_content (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- TECHNICAL_SKILLS — the looping software-icon marquee on the About Me
-- page. icon_key is optional — entries without one show a placeholder
-- square on the live site.
-- ----------------------------------------------------------------------------
create table if not exists technical_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Software',
  icon_key text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMMISSION_IMAGES — the simple scrolling image list on the Commission
-- page. caption is optional.
-- ----------------------------------------------------------------------------
create table if not exists commission_images (
  id uuid primary key default gen_random_uuid(),
  caption text,
  image_key text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table about_content enable row level security;
alter table technical_skills enable row level security;
alter table commission_images enable row level security;

drop policy if exists "public read about_content" on about_content;
create policy "public read about_content" on about_content for select using (true);

drop policy if exists "public read technical_skills" on technical_skills;
create policy "public read technical_skills" on technical_skills for select using (true);

drop policy if exists "public read commission_images" on commission_images;
create policy "public read commission_images" on commission_images for select using (true);

drop policy if exists "admin write about_content" on about_content;
create policy "admin write about_content" on about_content for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write technical_skills" on technical_skills;
create policy "admin write technical_skills" on technical_skills for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin write commission_images" on commission_images;
create policy "admin write commission_images" on commission_images for all
  using (is_admin()) with check (is_admin());

-- media_trash and admins tables: admin-only, no public access at all
drop policy if exists "admin only media_trash" on media_trash;
create policy "admin only media_trash" on media_trash for all
  using (is_admin()) with check (is_admin());

drop policy if exists "admin only admins table" on admins;
create policy "admin only admins table" on admins for all
  using (is_admin()) with check (is_admin());
