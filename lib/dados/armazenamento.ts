import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { modoLocal } from "./motor";
import { acessoAberto } from "@/lib/auth/acesso-aberto";
import { PASTA_LOCAL } from "./motor-local";

/**
 * Onde os arquivos moram, e como saem:
 *
 *   • site aberto (lib/config/modo.ts) → public/fichas/ do próprio site, 302 para lá;
 *   • senão, a mesma escolha do motor (lib/dados/motor.ts):
 *
 *   • supabase → bucket PRIVADO `fichas` + URL assinada de 1h + 302. Os bytes
 *                não passam pela Vercel e um link colado num grupo morre sozinho.
 *   • local    → .dados-locais/fichas/, lido do disco e devolvido pela própria
 *                rota (que já passou pelas 3 travas de lib/data/entrega.ts).
 *
 * O `caminho` vem SEMPRE de lib/config/arquivos.json, nunca da URL: não há
 * como pedir um arquivo fora da lista.
 */

export const BUCKET = "fichas";

const VALIDADE_SEGUNDOS = 3600;
/** reaproveita a mesma assinatura antes de vencer, com 10 min de folga */
const REUSO_MS = (VALIDADE_SEGUNDOS - 600) * 1000;

/**
 * Cache de URLs assinadas por instância. Uma URL ESTÁVEL é o que faz o
 * navegador reaproveitar a imagem do próprio cache; reassinando a cada pedido
 * a URL muda, o cache nunca acerta e a ficha é baixada de novo toda vez.
 */
const assinadas = new Map<string, { url: string; expiraEm: number }>();

async function assinar(caminho: string, download?: string): Promise<string | null> {
  const chaveCache = download ? `${caminho}::${download}` : caminho;
  const guardada = assinadas.get(chaveCache);
  if (guardada && guardada.expiraEm > Date.now()) return guardada.url;

  const { data, error } = await createServiceClient()
    .storage.from(BUCKET)
    .createSignedUrl(caminho, VALIDADE_SEGUNDOS, download ? { download } : undefined);

  if (error || !data?.signedUrl) return null;

  assinadas.set(chaveCache, { url: data.signedUrl, expiraEm: Date.now() + REUSO_MS });
  return data.signedUrl;
}

const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Entrega o arquivo. Com `download`, o navegador abre o diálogo de salvar
 * (Content-Disposition: attachment) em vez de mostrar a imagem.
 */
export async function entregarArquivo(caminho: string, download?: string): Promise<NextResponse> {
  // SITE ABERTO: sem banco e sem bucket. As fichas são arquivos estáticos em
  // public/fichas/ (no repositório), e a rota só aponta para elas. O download
  // com nome de arquivo fica por conta do atributo `download` do link.
  if (acessoAberto()) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: `/fichas/${caminho}`, "Cache-Control": "public, max-age=3600" },
    });
  }

  if (modoLocal()) {
    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(PASTA_LOCAL, BUCKET, caminho));
    } catch {
      return new NextResponse("Arquivo nao encontrado", { status: 404 });
    }
    const resposta = new NextResponse(new Uint8Array(bytes), { status: 200 });
    resposta.headers.set("Content-Type", TIPOS[path.extname(caminho)] ?? "application/octet-stream");
    resposta.headers.set("Cache-Control", "private, max-age=3600");
    resposta.headers.set("X-Content-Type-Options", "nosniff");
    if (download) resposta.headers.set("Content-Disposition", `attachment; filename="${download}"`);
    return resposta;
  }

  const url = await assinar(caminho, download);
  if (!url) return new NextResponse("Arquivo nao encontrado no storage", { status: 404 });

  const resposta = NextResponse.redirect(url, { status: 302 });
  // O redirect NUNCA entra em cache: sessão encerrada para de abrir imagem no
  // pedido seguinte. Quem fica em cache é a imagem, do outro lado.
  resposta.headers.set("Cache-Control", "private, no-store");
  resposta.headers.set("X-Content-Type-Options", "nosniff");
  return resposta;
}
