import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, destroySession, sessionCookieRemocao } from "@/lib/auth/session";

/**
 * Saída de emergência para cookie de sessão órfão. NÃO É OPCIONAL — sem esta
 * rota a área trava em tela branca assim que a primeira sessão expira.
 *
 * O proxy.ts faz checagem OTIMISTA: só verifica se o cookie existe, sem tocar
 * no banco (roda em toda rota, inclusive prefetch). Quando o cookie existe mas
 * a sessão não vale mais, as duas camadas discordam e entram em laço:
 *
 *   /inicio -> requireCustomer() falha -> /login
 *   /login  -> proxy vê o cookie       -> /inicio
 *   ...infinito, e o navegador desiste com a tela em branco.
 *
 * Página não pode apagar cookie (só Server Action ou Route Handler pode), então
 * requireCustomer() manda para cá: aqui o cookie morre de verdade e aí sim o
 * /login é alcançável, porque o proxy deixa de ver sessão.
 */
export async function GET(request: NextRequest) {
  await destroySession();

  const url = new URL("/login", request.url);
  url.searchParams.set("erro", "sessao_expirada");

  const resposta = NextResponse.redirect(url, { status: 303 });

  // Redundante de propósito: se destroySession falhar por qualquer motivo, o
  // cookie ainda morre aqui e o laço não volta.
  // Tem que ser `set` com os atributos originais, NÃO `delete`.
  resposta.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieRemocao());
  return resposta;
}
