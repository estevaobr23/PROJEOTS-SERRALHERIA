import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getBiblioteca } from "@/lib/data/biblioteca";
import { PROJETOS, TOTAL_PROJETOS } from "@/lib/config/projetos";
import { CATEGORIAS } from "@/lib/config/categorias";
import { BONUS } from "@/lib/config/bonus";
import { NOME_PRODUTO } from "@/lib/config/ofertas";
import { urlMiniatura } from "@/lib/urls";
import { AvisoTecnico } from "@/app/_componentes/marca";
import { plural } from "@/lib/rotulos";

export const metadata: Metadata = { title: "Início" };

const primeiroNome = (nome: string | null) => nome?.trim().split(/\s+/)[0] ?? null;

export default async function Inicio() {
  const [cliente, { conteudos }] = await Promise.all([getCurrentCustomer(), getBiblioteca()]);
  const nome = primeiroNome(cliente?.name ?? null);
  const temBonus = conteudos.has("bonus");

  // Arte da capa: as três primeiras fichas da lista real, em miniatura.
  const capa = PROJETOS.slice(0, 3).map((p) => urlMiniatura(p.id));

  // Contagem por categoria vem da lista real — nenhum número digitado.
  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    total: PROJETOS.filter((p) => p.categoria.slug === c.slug).length,
  })).filter((c) => c.total > 0);

  const bonusPreparando = BONUS.some((b) => !b.href);

  return (
    <>
      <section className="saudacao">
        <span className="rotulo">Sua biblioteca</span>
        <h1>{nome ? `Olá, ${nome}!` : "Olá!"}</h1>
        <p>
          Escolha o equipamento pela categoria ou pesquise pelo código, nome ou exercício. Toque na
          ficha para ampliar e baixar.
        </p>
      </section>

      <div className="secao-titulo">
        <h2>Seus materiais</h2>
      </div>
      <div className="prateleira">
        <Link href="/projetos" className="capa">
          <div className="capa-arte" aria-hidden="true">
            {capa.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="eager" />
            ))}
            <span className="capa-selo">
              <span className="numero">{TOTAL_PROJETOS}</span> {plural(TOTAL_PROJETOS, "projeto liberado", "projetos liberados")}
            </span>
          </div>
          <div className="capa-corpo">
            <h3>{NOME_PRODUTO}</h3>
            <p>Fichas ilustradas com visão principal, detalhe construtivo, exercício, altura de uso e instalação.</p>
            <span className="capa-acao">Abrir projetos →</span>
          </div>
        </Link>
      </div>

      <div className="secao-titulo">
        <h2>Escolha pela categoria</h2>
      </div>
      <div className="atalhos">
        {porCategoria.map((c) => (
          <Link key={c.slug} className="atalho" href={`/projetos?categoria=${c.slug}`}>
            <strong>{c.nome}</strong>
            <span>
              <span className="numero">{c.total}</span> {plural(c.total, "projeto", "projetos")}
            </span>
          </Link>
        ))}
      </div>

      {temBonus && (
        <>
          <div className="secao-titulo">
            <h2>Seus bônus</h2>
          </div>
          <div className="atalhos">
            {BONUS.map((b) =>
              b.href ? (
                <a key={b.slug} className="atalho" href={b.href}>
                  <strong>{b.nome}</strong>
                  <span>{b.descricao}</span>
                </a>
              ) : (
                <div key={b.slug} className="atalho atalho-preparando">
                  <strong>{b.nome}</strong>
                  <span>{b.descricao}</span>
                  <span className="selo-preparando">Preparando</span>
                </div>
              ),
            )}
          </div>
          {bonusPreparando && (
            <p className="chegando">
              Os bônus estão sendo preparados. Eles já são seus — o acesso está registrado e não vence.
              Assim que ficarem prontos, aparecem aqui sozinhos, sem custo nenhum e sem você precisar
              fazer nada.
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <AvisoTecnico />
      </div>
    </>
  );
}
