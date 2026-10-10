-- AINDA NÃO APLICADA: o projeto Supabase desta área será criado depois (decisão de 10/10/2026).
-- ============================================================================
-- MOTOR DA ÁREA DE MEMBROS — schema base (gateway: Cakto)
-- ============================================================================
-- Aplique isto em TODO projeto novo, sem alterar. As constraints UNIQUE não são
-- detalhe: são elas que garantem a idempotência do webhook.
--
-- RLS fica habilitado SEM policies de propósito: isso é deny-all para anon e
-- authenticated. Todo acesso acontece no servidor com a service_role key, que
-- ignora RLS. Não existe cliente Supabase no browser neste app.
-- ============================================================================

create table customers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,   -- sempre gravado trim() + lowercase
  name       text,
  created_at timestamptz not null default now()
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  cakto_product_id text not null unique,  -- id externo; o webhook autocorrige
  created_at       timestamptz not null default now()
);

create table purchases (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id),
  transaction_id text not null unique,
  status         text not null,
  created_at     timestamptz not null default now()
);

create table purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id),
  product_id  uuid not null references products(id),
  created_at  timestamptz not null default now(),
  unique (purchase_id, product_id)
);

create table entitlements (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id),
  product_id   uuid not null references products(id),
  status       text not null default 'active',  -- 'active' | 'revoked'
  revoked_at   timestamptz,
  revoke_reason text,
  created_at   timestamptz not null default now(),
  unique (customer_id, product_id)
);

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  token_hash  text not null unique,
  user_agent  text,
  ip          text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index entitlements_customer_idx   on entitlements(customer_id);
create index purchases_customer_idx      on purchases(customer_id);
create index purchase_items_purchase_idx on purchase_items(purchase_id);
create index sessions_expires_idx        on sessions(expires_at);

alter table customers      enable row level security;
alter table products       enable row level security;
alter table purchases      enable row level security;
alter table purchase_items enable row level security;
alter table entitlements   enable row level security;
alter table sessions       enable row level security;

comment on table customers    is 'Compradores da área de membros (identidade = email)';
comment on table products     is 'Catálogo; name deve bater com o título na Cakto';
comment on table purchases    is 'Transações; transaction_id = data.id da Cakto (idempotência)';
comment on table entitlements is 'Acessos liberados — é isto que o app lê';

-- Os produtos (as 3 ofertas da Cakto) entram em 0002_produtos_e_bucket.sql.
