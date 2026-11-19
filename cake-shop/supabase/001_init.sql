-- 1인CEO 운영노트 - 회원제 전환 스키마
--
-- 설계 원칙
--  1) 가게마다 자기 자료만 보이게 (Row Level Security)
--  2) 구독이 끝나면 "쓰기"만 막고 "읽기/내보내기"는 계속 허용
--     (사장님들의 영업 자료를 인질로 잡지 않기 위해)
--  3) 무료 체험 종료일·구독 종료일은 본인이 못 바꾸게 (결제 서버만 변경 가능)

-- ───────────────────────── 가게(회원) ─────────────────────────
create table if not exists public.shops (
  id               uuid primary key references auth.users(id) on delete cascade,
  shop_name        text        not null default '내 가게',
  owner_name       text,
  owner_phone      text,
  trial_ends_at    timestamptz not null default (now() + interval '3 months'),
  subscribed_until timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.shops is '회원(가게) 프로필과 구독 상태';
comment on column public.shops.trial_ends_at is '가입일로부터 3개월 무료 체험 종료 시점';
comment on column public.shops.subscribed_until is '결제로 확보한 이용 종료 시점 (결제 서버만 변경)';

-- ─────────────────── 업무 자료 (주문·메뉴·재고 …) ───────────────────
-- 앱이 쓰는 컬렉션 구조를 그대로 옮긴 표. 클라이언트가 만든 id 를 그대로 보관해
-- 오프라인에서 만든 자료도 충돌 없이 합쳐집니다.
create table if not exists public.records (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  collection text        not null,
  rec_id     text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, rec_id),
  constraint records_collection_chk check (
    collection in ('orders','menus','inventory','ingredients','recipes','options','photos')
  )
);
create index if not exists records_sync_idx on public.records (user_id, updated_at desc);

-- ─────────────────── 설정 / 알림 문구 ───────────────────
create table if not exists public.app_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb       not null default '{}'::jsonb,
  templates  jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────── 결제 기록 ───────────────────
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  amount              integer     not null,
  status              text        not null default 'pending'
                      check (status in ('pending','paid','failed','canceled','refunded')),
  provider            text,
  provider_payment_id text,
  period_start        timestamptz,
  period_end          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

-- ───────────────────────── 이용 권한 판단 ─────────────────────────
create or replace function public.has_active_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.shops s
     where s.id = uid
       and (now() < s.trial_ends_at
            or (s.subscribed_until is not null and now() < s.subscribed_until))
  );
$$;
comment on function public.has_active_access is '무료 체험 중이거나 구독이 살아 있으면 true';

-- ─────────── 가입하면 가게 프로필을 자동으로 만들어 줍니다 ───────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shops (id, shop_name, owner_name, owner_phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'shop_name'), ''), '내 가게'),
    nullif(trim(new.raw_user_meta_data->>'owner_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'owner_phone'), '')
  )
  on conflict (id) do nothing;

  insert into public.app_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────── 체험/구독 종료일은 본인이 못 고치게 막습니다 ───────
create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.trial_ends_at    := old.trial_ends_at;
    new.subscribed_until := old.subscribed_until;
    new.created_at       := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shops_protect_subscription on public.shops;
create trigger shops_protect_subscription
  before update on public.shops
  for each row execute function public.protect_subscription_columns();

-- ───────────────────────── RLS ─────────────────────────
alter table public.shops        enable row level security;
alter table public.records      enable row level security;
alter table public.app_settings enable row level security;
alter table public.payments     enable row level security;

-- shops: 내 가게만 보고 고칠 수 있음 (구독 컬럼은 위 트리거가 지킴)
drop policy if exists shops_select_own on public.shops;
create policy shops_select_own on public.shops
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists shops_update_own on public.shops;
create policy shops_update_own on public.shops
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- records: 읽기는 언제나 가능(자료 내보내기 보장), 쓰기는 이용 기간 안에서만
drop policy if exists records_select_own on public.records;
create policy records_select_own on public.records
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists records_insert_own on public.records;
create policy records_insert_own on public.records
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

drop policy if exists records_update_own on public.records;
create policy records_update_own on public.records
  for update to authenticated
  using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())))
  with check (user_id = (select auth.uid()));

drop policy if exists records_delete_own on public.records;
create policy records_delete_own on public.records
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

-- app_settings: 동일 규칙
drop policy if exists settings_select_own on public.app_settings;
create policy settings_select_own on public.app_settings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists settings_insert_own on public.app_settings;
create policy settings_insert_own on public.app_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

drop policy if exists settings_update_own on public.app_settings;
create policy settings_update_own on public.app_settings
  for update to authenticated
  using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())))
  with check (user_id = (select auth.uid()));

-- payments: 내 결제 내역 보기만. 기록은 결제 서버(service_role)만 남깁니다.
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
