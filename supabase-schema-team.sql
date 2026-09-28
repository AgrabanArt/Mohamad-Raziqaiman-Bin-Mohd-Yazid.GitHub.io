-- ============================================================
-- TMB STUDIO — Team members table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Additive — doesn't touch projects or site_settings.
-- ============================================================

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,

  name text not null default '',
  role text not null default '',       -- e.g. "Director<br>Lead 3D Generalist<br>Animator"

  photo_url text not null default '',
  photo_key text not null default '',  -- R2 object key, for delete

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run: this function may already exist from the projects schema.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create index if not exists team_members_sort_order_idx on team_members (sort_order);

drop trigger if exists trg_team_members_updated_at on team_members;
create trigger trg_team_members_updated_at
  before update on team_members
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table team_members enable row level security;

drop policy if exists "public read team members" on team_members;
create policy "public read team members"
  on team_members for select
  to anon
  using (true);

drop policy if exists "admin full access team members" on team_members;
create policy "admin full access team members"
  on team_members for all
  to authenticated
  using (true)
  with check (true);

-- ---------- Seed with the current 5 members ----------
insert into team_members (sort_order, name, role, photo_url)
select * from (values
  (0, 'MOHAMAD RAZIQAIMAN BIN MOHD YAZID', 'Director<br>Lead 3D Generalist<br>Animator', './assets/team/team-raziq.png'),
  (1, 'MOHAMMAD RIZAL BIN BENI', 'Founder<br>Game World Designer<br>Game Level Designer', './assets/team/team-rizal.png'),
  (2, 'MOHAMMAD IRFANLEE SHAWQI BIN JOHN', 'Graphic Designer<br>Environment Artist', './assets/team/team-irfan.png'),
  (3, 'AWANGKU MOHAMMAD ARIFF BIN MOHD AZRI', 'Project Coordinator<br>Programmer', './assets/team/team-ariff.png'),
  (4, 'MOHD FAZLIL BIN MOHD BILL', 'Lead Gameplay Programmer', './assets/team/team-fazlil.png')
) as seed(sort_order, name, role, photo_url)
where not exists (select 1 from team_members);
