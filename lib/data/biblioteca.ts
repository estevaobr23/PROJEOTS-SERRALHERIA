import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth/session";
import { motor } from "@/lib/dados/motor";
import { acessoAberto } from "@/lib/auth/acesso-aberto";
import { planoPorSlug, type Conteudo, type Plano } from "@/lib/config/ofertas";

/**
 * Junta os entitlements do motor com os planos do código: o que é dela.
 *
 * Só entitlement com status 'active' conta — 'revoked' (reembolso/chargeback)
 * some daqui, e com ele o acesso às telas e às imagens.
 *
 * Quem comprou o básico e depois o completo tem DOIS entitlements: vale a soma.
 */

export interface Biblioteca {
  planos: Plano[];
  /** a união do `inclui` de todos os planos ativos */
  conteudos: Set<Conteudo>;
  /** slugs comprados que NÃO têm plano no catálogo — ela paga e não vê nada */
  semCatalogo: string[];
}

/** Deduplicado por requisição: layout, página e rotas de arquivo chamam isto. */
export const getBiblioteca = cache(async (): Promise<Biblioteca> => {
  const customer = await requireCustomer();

  // Acesso aberto (só na máquina local, ver lib/auth/acesso-aberto.ts): sem
  // entitlement para consultar — o visitante vê tudo do plano completo.
  if (acessoAberto()) {
    const completo = planoPorSlug("calistenia-completo")!;
    return { planos: [completo], conteudos: new Set(completo.inclui), semCatalogo: [] };
  }

  const acessos = await motor().acessosAtivos(customer.id);

  const planos: Plano[] = [];
  const conteudos = new Set<Conteudo>();
  const semCatalogo: string[] = [];

  for (const { slug } of acessos) {
    const plano = planoPorSlug(slug);
    if (!plano) {
      // Comprou e não existe plano para mostrar. Nunca deixe passar calado.
      console.error(`[biblioteca] entitlement sem plano no catalogo | slug=${slug}`);
      semCatalogo.push(slug);
      continue;
    }
    planos.push(plano);
    for (const c of plano.inclui) conteudos.add(c);
  }

  return { planos, conteudos, semCatalogo };
});

/** Versão sem notFound(), para rota de API que responde 404 por conta própria. */
export async function possui(conteudo: Conteudo): Promise<boolean> {
  const { conteudos } = await getBiblioteca();
  return conteudos.has(conteudo);
}

/**
 * Porta de entrada de toda tela de conteúdo: sessão E entitlement.
 * 404, nunca 403 — 403 confirma que o conteúdo existe.
 */
export async function exigir(conteudo: Conteudo): Promise<void> {
  if (!(await possui(conteudo))) notFound();
}

export const exigirProjetos = () => exigir("projetos");
export const possuiProjetos = () => possui("projetos");
export const possuiBonus = () => possui("bonus");
