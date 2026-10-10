import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { acessoAberto } from "@/lib/auth/acesso-aberto";

const SESSION_COOKIE_NAME = "session_token";

/** Rotas que abrem sem sessão. */
const ROTAS_PUBLICAS = ["/login"];

/**
 * Checagem otimista: só olha o cookie, sem tocar no banco — o proxy roda em
 * toda rota, inclusive prefetch. A validação real acontece no layout
 * autenticado, via getCurrentCustomer().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Acesso aberto (só na máquina local): não há login. Quem cair em /login vai
  // direto para a área, e nenhuma rota exige cookie.
  if (acessoAberto()) {
    if (ROTAS_PUBLICAS.includes(pathname)) return NextResponse.redirect(new URL("/inicio", request.url));
    return NextResponse.next();
  }

  const temCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const rotaPublica = ROTAS_PUBLICAS.includes(pathname);

  if (!temCookie && !rotaPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Quem já tem cookie não precisa ver o login — MENOS quando chega de
  // /api/sessao-encerrada, que veio justamente dizer que a sessão morreu. Sem
  // esta exceção, um cookie que se recusa a sumir fecha o laço:
  //
  //   /login -> (proxy vê cookie) -> /inicio -> (sessão inválida)
  //          -> /api/sessao-encerrada -> /login?erro=... -> /inicio -> ...
  //
  // ...até o navegador desistir e pintar a tela de branco. Já aconteceu.
  const chegouDeSessaoEncerrada = request.nextUrl.searchParams.has("erro");

  if (temCookie && ROTAS_PUBLICAS.includes(pathname) && !chegouDeSessaoEncerrada) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Ignora estáticos de /public: senão a busca interna do Next para otimizar
  // imagem (que vai sem cookie de sessão) recebe um redirect pro /login em vez
  // do arquivo, e a otimização falha com "not a valid image".
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$).*)",
  ],
};
