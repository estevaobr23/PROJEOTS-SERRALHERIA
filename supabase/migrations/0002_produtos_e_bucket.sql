-- AINDA NÃO APLICADA: o projeto Supabase desta área será criado depois.
-- ============================================================================
-- PRODUTOS (as 3 ofertas da Cakto) + BUCKET PRIVADO
-- ============================================================================
-- ESCADA DE PREÇO: na Cakto é UM produto (8992525f-e02b-4434-bc1b-e2d080a88772)
-- com TRÊS ofertas. As três chegam no webhook com o MESMO product.id e o MESMO
-- nome de produto — só offer.id e offer.name as distinguem. Por isso:
--   • uma linha por OFERTA;
--   • cakto_product_id = id da OFERTA (o webhook tenta o offer.id primeiro);
--   • name = nome da OFERTA, idêntico ao da Cakto (rede de segurança do
--     casamento por título — o webhook NÃO usa o nome do produto, que é igual
--     nas três e liberaria o completo para quem pagou o básico).
--
-- slug IDÊNTICO a lib/config/ofertas.ts (PLANOS). O que cada plano libera
-- (projetos / bônus) é derivado na aplicação, não aqui.
--
-- Bucket `fichas` é PRIVADO: a imagem só sai por URL assinada de 1h, gerada
-- pelas rotas /api/ficha|miniatura|download depois de sessão + entitlement.
-- ============================================================================

insert into products (slug, name, cakto_product_id) values
  ('calistenia-completo', 'Plano Completo',                   '65nvamg'),
  ('calistenia-basico',   'Plano Básico',                     'y7ff8v6'),
  ('calistenia-downsell', 'Plano Completo - Oferta Especial', '39fhwfu')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public)
values ('fichas', 'fichas', false)
on conflict (id) do nothing;
