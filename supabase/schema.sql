-- ============================================================
-- ZENN OS — schema Supabase (Postgres)
-- Colunas em snake_case espelham os tipos de src/types/index.ts
-- (a camada src/services/supabaseProvider.ts converte camelCase <-> snake_case).
-- Execute no SQL Editor do Supabase e defina VITE_DATA_PROVIDER=supabase.
-- ============================================================

create table if not exists public.leads (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  name text not null,
  category text not null default '',
  address text not null default '',
  city text not null default '',
  phone text,
  rating numeric(2,1),
  reviews_count integer not null default 0,
  website text,
  google_maps_url text,
  facebook text,
  instagram text,
  status text not null default 'novo'
    check (status in ('novo','qualificado','contatado','respondeu','negociacao','cliente','perdido')),
  source text not null default 'manual',
  place_id text unique,
  notes text not null default '',
  client_id text,
  last_contact_at timestamptz
);

create table if not exists public.clients (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  company text not null,
  contact_name text not null default '',
  phone text,
  email text,
  instagram text,
  city text not null default '',
  category text not null default '',
  status text not null default 'onboarding' check (status in ('ativo','onboarding','pausado','encerrado')),
  contracted_value numeric(12,2) not null default 0,
  lead_id text references public.leads(id) on delete set null,
  notes text not null default ''
);

-- Observação: leads.client_id é uma referência "leve" (texto), sem FK no banco,
-- para evitar dependência circular com clients.lead_id (senão a inserção em lote
-- e a conversão lead→cliente quebrariam). O relacionamento é gerido pelo app.
alter table public.leads drop constraint if exists leads_client_id_fkey;

create table if not exists public.projects (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  name text not null,
  client_id text not null references public.clients(id) on delete cascade,
  description text not null default '',
  value numeric(12,2) not null default 0,
  deadline date,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'backlog'
    check (status in ('backlog','planejamento','desenvolvimento','revisao','aguardando_cliente','concluido'))
);

create table if not exists public.tasks (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  deadline date,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  assignee text not null default '',
  status text not null default 'a_fazer' check (status in ('a_fazer','em_andamento','concluida'))
);

create table if not exists public.transactions (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  client_id text references public.clients(id) on delete set null,
  project_id text references public.projects(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('receita','despesa')),
  status text not null check (status in ('pago','pendente')),
  date date not null,
  paid_at timestamptz,
  method text not null default 'pix' check (method in ('pix','boleto','cartao','transferencia','dinheiro'))
);

create table if not exists public.payments (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  transaction_id text not null references public.transactions(id) on delete cascade,
  client_id text references public.clients(id) on delete set null,
  amount numeric(12,2) not null,
  method text not null,
  paid_at timestamptz not null
);

create table if not exists public.activities (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  type text not null,
  message text not null,
  entity_type text not null,
  entity_id text
);

create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_city_idx on public.leads(city);
create index if not exists projects_client_idx on public.projects(client_id);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists transactions_client_idx on public.transactions(client_id);
create index if not exists transactions_date_idx on public.transactions(date);
create index if not exists activities_created_idx on public.activities(created_at desc);

-- ============================================================
-- Row Level Security: somente MEMBROS AUTORIZADOS acessam.
--
-- Não basta exigir "authenticated": o cadastro público do Supabase Auth
-- costuma ficar aberto, então qualquer pessoa criaria uma conta, confirmaria
-- o próprio e-mail e leria toda a base. O acesso é liberado apenas para quem
-- está em public.app_members.
-- ============================================================
create table if not exists public.app_members (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

alter table public.app_members enable row level security;

-- Cada membro vê apenas o próprio registro. Não existe policy de escrita,
-- então ninguém se auto-adiciona: só o service_role (painel) inclui membros.
drop policy if exists app_members_self_read on public.app_members;
create policy app_members_self_read on public.app_members
  for select to authenticated
  using (auth.uid() = user_id);

-- SECURITY DEFINER para consultar app_members sem esbarrar na RLS dela.
create or replace function public.is_app_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_members m where m.user_id = auth.uid());
$$;

revoke all on function public.is_app_member() from public;
grant execute on function public.is_app_member() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'leads','clients','projects','tasks','transactions','payments','activities','app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format('drop policy if exists "members_all" on public.%I', t);
    execute format(
      'create policy "members_all" on public.%I for all to authenticated '
      'using (public.is_app_member()) with check (public.is_app_member())', t);
  end loop;
end $$;

-- Para liberar uma pessoa nova (rode no SQL Editor do Supabase):
--   insert into public.app_members (user_id, email)
--   select id, email from auth.users where email = 'pessoa@empresa.com';
