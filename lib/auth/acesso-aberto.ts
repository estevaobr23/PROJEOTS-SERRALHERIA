/**
 * ACESSO ABERTO — a área sem login, só o entregável em forma de site.
 *
 * Ligado por ACESSO_ABERTO=1 no .env.local. Enquanto ligado:
 *   • nenhuma tela pede e-mail; /login redireciona para /inicio;
 *   • quem abre o site vê TUDO do plano completo (projetos + bônus);
 *   • não existe sessão, cliente nem entitlement envolvido.
 *
 * ⚠️ SÓ NA SUA MÁQUINA. Na Vercel (process.env.VERCEL) esta chave é IGNORADA
 * e a área volta a exigir login: conteúdo pago nunca pode ficar aberto na
 * internet. Para voltar ao login em casa, apague ACESSO_ABERTO do .env.local.
 *
 * Sem `server-only` de propósito: o proxy.ts também lê isto.
 */
export const acessoAberto = () => process.env.ACESSO_ABERTO === "1" && !process.env.VERCEL;
