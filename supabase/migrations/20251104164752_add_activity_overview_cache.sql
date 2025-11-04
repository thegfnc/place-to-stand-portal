create table public.activity_overview_cache (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	timeframe_days smallint not null check (timeframe_days in (7, 14, 28)),
	summary text not null,
	cached_at timestamptz not null default timezone('utc', now()),
	expires_at timestamptz not null,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now())
);

create unique index activity_overview_cache_user_timeframe_idx
	on public.activity_overview_cache (user_id, timeframe_days);

create index activity_overview_cache_expires_at_idx
	on public.activity_overview_cache (expires_at);

create trigger activity_overview_cache_set_updated_at
before update on public.activity_overview_cache
for each row
execute function public.set_updated_at();

alter table public.activity_overview_cache enable row level security;

create policy "Users can view their cached activity overview"
	on public.activity_overview_cache
	for select
	using (auth.uid() = user_id);

create policy "Users can insert their cached activity overview"
	on public.activity_overview_cache
	for insert
	with check (auth.uid() = user_id);

create policy "Users can update their cached activity overview"
	on public.activity_overview_cache
	for update
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy "Users can delete their cached activity overview"
	on public.activity_overview_cache
	for delete
	using (auth.uid() = user_id);
