import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes } from "node:crypto";
import { motor } from "@/lib/dados/motor";
import type { Customer } from "@/lib/supabase/types";
import { acessoAberto } from "@/lib/auth/acesso-aberto";

/** Quem "está logado" no acesso aberto: sem e-mail, sem nome, sem registro em lugar nenhum. */
export const VISITANTE: Customer = { id: "acesso-aberto", email: "", name: null, created_at: new Date(0).toISOString() };

/**
 * Login por e-mail, sem senha e sem confirmação: quem tem entitlement ativo
 * entra direto. Decisão fechada: atrito no login derruba entrega e gera
 * suporte. Não usa Supabase Auth: é uma tabela de
 * sessões própria, simples de auditar e revogar — no Supabase ou, enquanto ele
 * não existe, no arquivo do modo local (lib/dados/motor.ts).
 */

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_DAYS = 30;

/**
 * Atributos do cookie de sessão. Definidos UMA VEZ e usados tanto para gravar
 * quanto para apagar. NÃO duplique estes valores em outro arquivo.
 *
 * O navegador só reconhece duas instruções como "o mesmo cookie" se os
 * atributos baterem. Um Set-Cookie de apagamento sem SameSite=None é lido como
 * Lax e, em contexto cross-site (iframe de preview), o navegador DESCARTA a
 * instrução — o cookie sobrevive, vira laço de redirect e a tela do login fica
 * 100% branca.
 */
export function sessionCookieOptions() {
  const emProducao = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: true,
    sameSite: (emProducao ? "lax" : "none") as "lax" | "none",
    path: "/",
  };
}

/** Para APAGAR: os mesmos atributos, valor vazio e data no passado. */
export function sessionCookieRemocao() {
  return { ...sessionCookieOptions(), expires: new Date(0), maxAge: 0 };
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET nao configurado.");
  return secret;
}

/** O banco guarda só o hash: vazar a tabela não permite forjar sessão. */
function hashToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

/** Cria a sessão e grava o cookie httpOnly. Só de Server Action ou Route Handler. */
export async function createSession(
  customerId: string,
  meta: { userAgent?: string | null; ip?: string | null },
) {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await motor().criarSessao({
    customer_id: customerId,
    token_hash: hashToken(token),
    user_agent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
    expires_at: expiraEm.toISOString(),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    expires: expiraEm,
  });
}

/** Remove a sessão atual (banco + cookie). */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) await motor().apagarSessao(hashToken(token));

  // NÃO use cookieStore.delete(): manda um Set-Cookie pelado, sem os atributos
  // originais, e o navegador ignora a instrução em iframe. Sobrescrever com
  // valor vazio e os MESMOS atributos é o que apaga de fato.
  cookieStore.set(SESSION_COOKIE_NAME, "", sessionCookieRemocao());
}

/** Cliente autenticado da requisição atual, ou null. Deduplicado por requisição. */
export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  // Acesso aberto (só na máquina local): ninguém loga, todo mundo é "visitante".
  if (acessoAberto()) return VISITANTE;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const sessao = await motor().sessaoPorHash(hashToken(token));
  if (!sessao || new Date(sessao.expires_at) < new Date()) return null;

  return motor().clientePorId(sessao.customer_id);
});

/**
 * Igual a getCurrentCustomer, mas corta o caminho quando não há sessão.
 * A autorização nunca confia em id vindo do frontend: parte sempre da sessão.
 */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    // NÃO redirecione direto para /login aqui.
    //
    // O proxy faz checagem otimista (só olha se o cookie existe). Se o cookie
    // existe mas a sessão não vale mais, as duas camadas discordam:
    //   /inicio -> requireCustomer falha -> /login
    //   /login  -> proxy vê o cookie     -> /inicio -> ...infinito
    //
    // Página não pode apagar cookie (só Server Action ou Route Handler pode),
    // então mandamos para a rota que apaga de verdade.
    const cookieStore = await cookies();
    const temCookieOrfao = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    redirect(temCookieOrfao ? "/api/sessao-encerrada" : "/login");
  }
  return customer;
}

/**
 * Cliente elegível para login: precisa existir com esse e-mail E ter ao menos
 * um entitlement ativo. Quem não comprou não entra.
 */
export async function findLoginEligibleCustomer(email: string): Promise<Customer | null> {
  const customer = await motor().clientePorEmail(email.trim().toLowerCase());
  if (!customer) return null;

  const acessos = await motor().acessosAtivos(customer.id);
  if (acessos.length === 0) return null;

  return customer;
}
