-- Contact Sheet: database setup for Supabase.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- One row per contact per user. The contact itself is stored as JSON so the app
-- can add fields later without database changes.
create table if not exists public.contacts (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,   -- tombstone so deletes sync to other devices
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists contacts_user_updated_idx on public.contacts (user_id, updated_at);

-- The server, not the device, decides updated_at (device clocks can be wrong).
create or replace function public.contacts_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before insert or update on public.contacts
  for each row execute function public.contacts_touch();

-- Row-level security: every person can only ever see and change their own contacts.
alter table public.contacts enable row level security;

drop policy if exists "read own contacts"   on public.contacts;
drop policy if exists "insert own contacts" on public.contacts;
drop policy if exists "update own contacts" on public.contacts;
drop policy if exists "delete own contacts" on public.contacts;

create policy "read own contacts"   on public.contacts for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own contacts" on public.contacts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own contacts" on public.contacts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own contacts" on public.contacts for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.contacts from anon;
grant select, insert, update, delete on public.contacts to authenticated;

-- Lets a signed-in person permanently delete their own account and all their
-- contacts (required for App Store apps that offer sign-up).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();   -- contacts go too (on delete cascade)
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
