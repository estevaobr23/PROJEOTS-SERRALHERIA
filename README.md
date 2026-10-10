# Área de membros — 60 Projetos de Equipamentos de Calistenia

Next 16 + (Supabase depois) + webhook Cakto. Veja `AGENTS.md` antes de mexer no código: esta versão do Next tem mudanças.

## Modo atual: SITE ABERTO (sem login, sem Supabase)
`lib/config/modo.ts` → `SITE_ABERTO = true`. A área é só o entregável em forma de site: **qualquer pessoa com o endereço
vê os 60 projetos e os 4 bônus e baixa as fichas.** Nada de banco, e-mail ou variável de ambiente — na Vercel basta o deploy.
As 60 fichas originais ficam em `public/fichas/ficha/` (neste repositório) e são servidas direto.
Para voltar ao login por e-mail: `SITE_ABERTO = false` + configurar o Supabase (seção abaixo).

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
