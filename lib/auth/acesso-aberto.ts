import { SITE_ABERTO } from "@/lib/config/modo";

/**
 * ACESSO ABERTO — a área sem login, só o entregável em forma de site.
 *
 * Quem decide é lib/config/modo.ts (SITE_ABERTO), no código, para valer igual
 * na sua máquina e na Vercel sem configurar nada no painel. A variável de
 * ambiente ACESSO_ABERTO sobrepõe: "0" fecha (a bateria de testes força isso
 * para testar o login), "1" abre.
 *
 * Enquanto aberto:
 *   • nenhuma tela pede e-mail; /login redireciona para /inicio;
 *   • quem abre o site vê TUDO do plano completo (projetos + bônus);
 *   • não existe sessão, cliente nem entitlement — nem banco;
 *   • as fichas saem de public/fichas/ (ver lib/dados/armazenamento.ts).
 *
 * Sem `server-only` de propósito: o proxy.ts também lê isto.
 */
export const acessoAberto = () => {
  const v = process.env.ACESSO_ABERTO;
  if (v === "0") return false;
  if (v === "1") return true;
  return SITE_ABERTO;
};
