import "server-only";
import { NextResponse } from "next/server";
import { possuiProjetos } from "@/lib/data/biblioteca";
import { projetoPorId } from "@/lib/config/projetos";
import { entregarArquivo } from "@/lib/dados/armazenamento";
import { acessoAberto } from "@/lib/auth/acesso-aberto";

/**
 * Entrega das fichas. TRÊS TRAVAS, nesta ordem:
 *
 *   1. sessão válida (requireCustomer, dentro de possuiProjetos);
 *   2. entitlement ativo de um plano que inclui os projetos — sem ele, 404
 *      (nunca 403);
 *   3. o id pedido está na LISTA REAL de projetos com ficha — fora dela, 404.
 *      Projeto que ainda não tem ficha dá 404, não imagem quebrada.
 *
 * Três entregas para o mesmo projeto:
 *   - `ficha`: o PNG ORIGINAL, byte a byte, para o visualizador (a nitidez da
 *     ficha é o produto);
 *   - `miniatura`: usada nos cards do catálogo. MESMA resolução e SEM PERDA
 *     (WebP lossless, pixel por pixel igual ao original) — decisão do dono:
 *     qualidade máxima, velocidade não importa. Se um dia o tráfego pesar
 *     (60 originais somam ~82 MB), é aqui que se volta a reduzir;
 *   - `download`: o original com Content-Disposition: attachment.
 */

const naoEncontrado = () => new NextResponse("Nao encontrado", { status: 404 });

export type TipoEntrega = "ficha" | "miniatura" | "download";

export async function entregarFicha(id: string, tipo: TipoEntrega): Promise<NextResponse> {
  if (!(await possuiProjetos())) return naoEncontrado();

  const projeto = projetoPorId(id);
  if (!projeto) return naoEncontrado();

  // Site aberto: só os originais estão em public/fichas (130 MB de miniaturas
  // a mais no repositório não compram nada) — o card usa o próprio original.
  if (tipo === "miniatura") return entregarArquivo(acessoAberto() ? projeto.ficha.caminho : projeto.miniatura.caminho);
  if (tipo === "download") return entregarArquivo(projeto.ficha.caminho, `${projeto.id}.png`);
  return entregarArquivo(projeto.ficha.caminho);
}
