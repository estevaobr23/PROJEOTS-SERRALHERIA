# Área de membros — 60 Projetos de Equipamentos de Calistenia

Next 16 + (Supabase depois) + webhook Cakto. Veja `AGENTS.md` antes de mexer no código: esta versão do Next tem mudanças.

## Modo atual: LOGIN POR E-MAIL (Supabase)
`lib/config/modo.ts` → `SITE_ABERTO = false`. Só entra quem tem compra aprovada; sem senha. Compra/reembolso chegam pelo
webhook da Cakto (Edge Function `cakto-webhook` no projeto Supabase `serralheiros-membros`). As fichas ficam no bucket
privado `fichas` (URL assinada de 1h). `public/fichas` só é usado se `SITE_ABERTO = true`.

## Rodar na sua máquina (modo local, sem Supabase)
```
npm install
# (opcional) .env.local com SESSION_SECRET=<openssl rand -hex 32> — só é usado com login ligado
npm run sincronizar     # copia as 60 fichas ORIGINAIS da pasta da página de vendas para public/fichas e gera os dados
npm run dev
```
Com `SITE_ABERTO = false` o login é por e-mail
(`npm run liberar -- --email voce@x.com --plano completo|basico|downsell`).

## Testes
`npm run testar` — catálogo, tsc, build, acesso (login ligado) e medição de telas (celular + desktop).

## Para ligar o login de verdade (Supabase) — fica para depois
1. Criar o projeto Supabase e aplicar `supabase/migrations/0001` e `0002`.
2. `npm run sincronizar` com as variáveis do Supabase → sobe as fichas ORIGINAIS ao bucket privado.
3. Publicar `supabase/functions/cakto-webhook` (`verify_jwt: false`) e criar o webhook na Cakto
   (produto `8992525f-e02b-4434-bc1b-e2d080a88772`, evento `purchase_approved`).
4. Variáveis na Vercel: `NEXT_PUBLIC_SUPABASE_URL` (não marcar Sensitive), `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
   Trocar `SITE_ABERTO` para `false` em `lib/config/modo.ts`.
