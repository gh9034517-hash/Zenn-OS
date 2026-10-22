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

-- ============================================================
-- Espaços separados (Pessoal, Trabalho...) com finanças próprias.
-- Zenn Works continua usando as tabelas acima.
-- ============================================================
create table if not exists public.spaces (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  name text not null,
  kind text not null default 'pessoal' check (kind in ('pessoal','empresa')),
  position integer not null default 0
);

create table if not exists public.wallets (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  name text not null,
  kind text not null default 'banco' check (kind in ('banco','caixa','cartao','investimento')),
  initial_balance numeric(14,2) not null default 0,
  archived boolean not null default false
);

-- Lançamentos: receitas e despesas de cada espaço.
-- link_id liga os dois lados de uma transferência ou de "meu pagamento";
-- is_transfer = movimento entre carteiras (não conta como receita/despesa).
create table if not exists public.entries (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  type text not null check (type in ('receita','despesa')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null default '',
  date date not null,
  status text not null check (status in ('pago','pendente')),
  paid_at timestamptz,
  wallet_id text references public.wallets(id) on delete set null,
  method text not null default 'pix' check (method in ('pix','boleto','cartao','transferencia','dinheiro')),
  counterparty text not null default '',
  notes text not null default '',
  recurring_id text,
  link_id text,
  is_transfer boolean not null default false,
  installment text
);

-- Contas fixas: geram um lançamento pendente por mês (last_generated = YYYY-MM).
create table if not exists public.recurrings (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  type text not null check (type in ('receita','despesa')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null default '',
  day integer not null default 5 check (day between 1 and 31),
  wallet_id text references public.wallets(id) on delete set null,
  method text not null default 'pix' check (method in ('pix','boleto','cartao','transferencia','dinheiro')),
  counterparty text not null default '',
  active boolean not null default true,
  start_month text not null,
  last_generated text
);

create table if not exists public.budgets (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  category text not null,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  unique (space_id, category)
);

create table if not exists public.goals (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  name text not null,
  target numeric(14,2) not null check (target > 0),
  saved numeric(14,2) not null default 0,
  deadline date
);

create table if not exists public.reminders (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  notes text not null default ''
);

create index if not exists entries_space_date_idx on public.entries(space_id, date);
create index if not exists wallets_space_idx on public.wallets(space_id);
create index if not exists recurrings_space_idx on public.recurrings(space_id);
create index if not exists reminders_space_idx on public.reminders(space_id);

do $$
declare t text;
begin
  foreach t in array array['spaces','wallets','entries','recurrings','budgets','goals','reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members_all" on public.%I', t);
    execute format(
      'create policy "members_all" on public.%I for all to authenticated '
      'using (public.is_app_member()) with check (public.is_app_member())', t);
  end loop;
end $$;

insert into public.spaces (id, name, kind, position) values
  ('pessoal', 'Pessoal', 'pessoal', 1),
  ('trabalho', 'Trabalho', 'empresa', 2)
on conflict (id) do nothing;

-- ============================================================
-- Serviços (móveis, fretes...) e acesso por espaço
-- ============================================================
create table if not exists public.jobs (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  kind text not null default 'movel' check (kind in ('movel','frete','outro')),
  title text not null,
  client text not null default '',
  phone text,
  address text not null default '',
  description text not null default '',
  value numeric(14,2) not null default 0,
  cost_estimate numeric(14,2) not null default 0,
  deadline date,
  status text not null default 'orcamento' check (status in ('orcamento','aprovado','andamento','entregue','cancelado')),
  notes text not null default ''
);
create index if not exists jobs_space_idx on public.jobs(space_id);
alter table public.entries add column if not exists job_id text references public.jobs(id) on delete set null;
create index if not exists entries_job_idx on public.entries(job_id);

-- O administrador (app_members) vê tudo. Outras contas (clientes, família)
-- veem só os espaços liberados: editor lança e edita; leitor só vê.
create table if not exists public.space_members (
  space_id text not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'editor' check (role in ('editor','leitor')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_members enable row level security;
create policy space_members_read on public.space_members for select to authenticated
  using (public.is_app_member() or user_id = auth.uid());
create policy space_members_admin_remove on public.space_members for delete to authenticated using (public.is_app_member());
create policy space_members_admin_change on public.space_members for update to authenticated
  using (public.is_app_member()) with check (public.is_app_member());

create or replace function public.can_read_space(sid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_member()
      or exists (select 1 from public.space_members m where m.space_id = sid and m.user_id = auth.uid());
$$;

create or replace function public.can_write_space(sid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_app_member()
      or exists (select 1 from public.space_members m where m.space_id = sid and m.user_id = auth.uid() and m.role = 'editor');
$$;

-- Regras por espaço: a política members_all de cada tabela passa a ler com
-- can_read_space e gravar com can_write_space; políticas restritivas impedem
-- quem só lê de alterar ou apagar. Espaços: só o administrador cria/altera.
alter policy members_all on public.spaces using (public.can_read_space(id)) with check (public.is_app_member());
create policy spaces_admin_update on public.spaces as restrictive for update to authenticated using (public.is_app_member());
create policy spaces_admin_delete on public.spaces as restrictive for delete to authenticated using (public.is_app_member());

do $$
declare t text;
begin
  foreach t in array array['wallets','entries','recurrings','budgets','goals','reminders'] loop
    execute format('alter policy members_all on public.%I using (public.can_read_space(space_id)) with check (public.can_write_space(space_id))', t);
    execute format('create policy write_update on public.%I as restrictive for update to authenticated using (public.can_write_space(space_id))', t);
    execute format('create policy write_delete on public.%I as restrictive for delete to authenticated using (public.can_write_space(space_id))', t);
  end loop;
end $$;

alter table public.jobs enable row level security;
create policy members_all on public.jobs for all to authenticated using (public.can_read_space(space_id)) with check (public.can_write_space(space_id));
create policy write_update on public.jobs as restrictive for update to authenticated using (public.can_write_space(space_id));
create policy write_delete on public.jobs as restrictive for delete to authenticated using (public.can_write_space(space_id));

-- Liberar acesso por e-mail (só o administrador). A pessoa cria a conta antes.
create or replace function public.grant_space_access(p_email text, p_space_id text, p_role text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_email text;
begin
  if not public.is_app_member() then
    raise exception 'Só o administrador pode liberar acesso.' using errcode = '42501';
  end if;
  if p_role not in ('editor','leitor') then
    raise exception 'Permissão inválida.';
  end if;
  if not exists (select 1 from public.spaces where id = p_space_id) then
    raise exception 'Espaço não encontrado.';
  end if;
  select u.id, u.email into v_user, v_email from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    raise exception 'conta_nao_encontrada' using errcode = 'P0002';
  end if;
  insert into public.space_members (space_id, user_id, email, role)
  values (p_space_id, v_user, v_email, p_role)
  on conflict (space_id, user_id) do update set role = excluded.role, email = excluded.email;
  return json_build_object('user_id', v_user, 'email', v_email);
end;
$$;
grant execute on function public.grant_space_access(text, text, text) to authenticated;

-- ============================================================
-- Checklist dos serviços (quadro) e estoque (chapas, fita, ferragens)
-- ============================================================
alter table public.jobs add column if not exists checklist jsonb not null default '[]'::jsonb;

create table if not exists public.stock_items (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  name text not null,
  kind text not null default 'chapa' check (kind in ('chapa','fita','ferragem','outro')),
  unit text not null default 'un',
  qty numeric(14,2) not null default 0,
  min_qty numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  supplier text not null default '',
  supplier_phone text,
  notes text not null default ''
);
create index if not exists stock_items_space_idx on public.stock_items(space_id);

-- Cada entrada (+) ou saída (−) do estoque; qty do item é o saldo.
create table if not exists public.stock_moves (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean default false,
  space_id text not null references public.spaces(id) on delete cascade,
  item_id text not null references public.stock_items(id) on delete cascade,
  delta numeric(14,2) not null,
  reason text not null default 'ajuste' check (reason in ('compra','uso','ajuste','perda')),
  job_id text references public.jobs(id) on delete set null,
  date date not null default current_date,
  note text not null default ''
);
create index if not exists stock_moves_item_idx on public.stock_moves(item_id);

alter table public.stock_items enable row level security;
alter table public.stock_moves enable row level security;
create policy members_all on public.stock_items for all to authenticated using (public.can_read_space(space_id)) with check (public.can_write_space(space_id));
create policy write_update on public.stock_items as restrictive for update to authenticated using (public.can_write_space(space_id));
create policy write_delete on public.stock_items as restrictive for delete to authenticated using (public.can_write_space(space_id));
create policy members_all on public.stock_moves for all to authenticated using (public.can_read_space(space_id)) with check (public.can_write_space(space_id));
create policy write_update on public.stock_moves as restrictive for update to authenticated using (public.can_write_space(space_id));
create policy write_delete on public.stock_moves as restrictive for delete to authenticated using (public.can_write_space(space_id));
