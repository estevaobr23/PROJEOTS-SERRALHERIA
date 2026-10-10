# Área de membros — 60 Projetos de Equipamentos de Calistenia

Next 16 + (Supabase depois) + webhook Cakto. Veja `AGENTS.md` antes de mexer no código: esta versão do Next tem mudanças.

## O que NÃO está neste repositório (de propósito)
O repositório é público. **As 60 fichas (conteúdo pago) não estão aqui** — nem `.env.local`, nem a pasta `.dados-locais/`.
Elas moram no armazenamento privado: `.dados-locais/fichas/` no modo local, e no bucket privado `fichas` do Supabase depois.

## Rodar na sua máquina (modo local, sem Supabase)
```
npm install
# crie .env.local com SESSION_SECRET=<openssl rand -hex 32>  e  ACESSO_ABERTO=1  (veja .env.example)
npm run sincronizar     # copia as 60 fichas ORIGINAIS da pasta da página de vendas e gera os dados
npm run dev
```
`ACESSO_ABERTO=1` abre a área sem login e é **ignorado na Vercel**. Sem ele, o login é por e-mail
(`npm run liberar -- --email voce@x.com --plano completo|basico|downsell`).

## Testes
`npm run testar` — catálogo, tsc, build, acesso (login ligado) e medição de telas (celular + desktop).

## Para ir à Vercel (pendências)
1. Criar o projeto Supabase e aplicar `supabase/migrations/0001` e `0002`.
2. `npm run sincronizar` com as variáveis do Supabase → sobe as fichas ORIGINAIS ao bucket privado.
3. Publicar `supabase/functions/cakto-webhook` (`verify_jwt: false`) e criar o webhook na Cakto
   (produto `8992525f-e02b-4434-bc1b-e2d080a88772`, evento `purchase_approved`).
4. Variáveis na Vercel: `NEXT_PUBLIC_SUPABASE_URL` (não marcar Sensitive), `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
   **Não** definir `ACESSO_ABERTO`.
