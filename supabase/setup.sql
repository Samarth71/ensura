-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run

create table if not exists train_positions (
  id bigint generated always as identity primary key,
  train_no text not null,
  lat double precision not null,
  lng double precision not null,
  reported_at timestamptz not null default now()
);

create index if not exists idx_train_positions_train_no_time
  on train_positions (train_no, reported_at desc);

-- Auto-clean old points so the table doesn't grow forever (keeps last 2 hours)
create or replace function delete_old_train_positions() returns trigger as $$
begin
  delete from train_positions where reported_at < now() - interval '2 hours';
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cleanup_positions on train_positions;
create trigger trg_cleanup_positions
  after insert on train_positions
  execute function delete_old_train_positions();

-- Row Level Security: anyone can read recent positions, anyone can report
-- their own position. No update/delete from the client — only the cleanup
-- trigger removes old rows. This keeps it safe to use the public anon key
-- directly from the browser.
alter table train_positions enable row level security;

drop policy if exists "public read" on train_positions;
create policy "public read" on train_positions
  for select using (true);

drop policy if exists "public insert" on train_positions;
create policy "public insert" on train_positions
  for insert with check (
    train_no ~ '^[0-9]{4,5}$'
    and lat between -90 and 90
    and lng between -180 and 180
  );
