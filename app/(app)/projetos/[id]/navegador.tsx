"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Projeto } from "@/lib/config/projetos";
import { CHAVE_LISTA_NAVEGACAO, gravarPreferencia, lerPreferencia } from "@/lib/rotulos";
import { urlDownloadFicha, urlFicha } from "@/lib/urls";
import { bitola, nomeDoModelo } from "@/lib/formato";
import { Visualizador } from "@/app/_componentes/visualizador";
import { PlantaDimensoes } from "@/app/_componentes/planta-dimensoes";
import { AvisoTecnico } from "@/app/_componentes/marca";
import { VoltarAoCatalogo } from "./voltar";

type ModoCelular = "carrossel" | "vertical";
const CHAVE_MODO = "projetos:navegacao";

/**
 * NAVEGAÇÃO ENTRE PROJETOS — a página do projeto vira um "passador".
 *
 *   • PC: setas grandes nas laterais da ficha + ← → do teclado.
 *   • Celular, CARROSSEL: arrasta a ficha para o lado (scroll-snap nativo).
 *   • Celular, VERTICAL: os painéis um embaixo do outro, rolando.
 *
 * A LISTA é a que a pessoa estava vendo no catálogo (filtrada, na ordem), lida
 * do sessionStorage. Sem ela (link direto, aba nova), vale o catálogo inteiro.
 *
 * No carrossel só a ficha atual e as vizinhas são montadas; as outras são
 * caixas vazias do mesmo tamanho — a ficha original pesa ~1,4 MB.
 *
 * O PAINEL (molde: "Por dentro de um projeto" da página de vendas): cabeçalho,
 * › Projeto (a ficha), › Dimensões (só quando o modelo de referência informa a
 * área de segurança), faixa de dados e o botão de baixar.
 */
export function NavegadorProjetos({ todos, idInicial }: { todos: Projeto[]; idInicial: string }) {
  const inicial = todos.find((p) => p.id === idInicial)!;
  const [lista, setLista] = useState<Projeto[]>([inicial]);
  const [atualId, setAtualId] = useState(idInicial);
  const [modo, setModo] = useState<ModoCelular>("carrossel");
  const [celular, setCelular] = useState(false);
  const [expandida, setExpandida] = useState(false);

  const trilhoRef = useRef<HTMLDivElement>(null);
  const indiceRef = useRef(0);

  // ── a lista que a pessoa estava vendo ───────────────────────────────────
  useEffect(() => {
    let ids: string[] | null = null;
    try {
      const cru = sessionStorage.getItem(CHAVE_LISTA_NAVEGACAO);
      if (cru) ids = JSON.parse(cru);
    } catch {
      /* storage bloqueado */
    }
    const porId = new Map(todos.map((p) => [p.id, p]));
    const filtrada = (ids ?? []).map((id) => porId.get(id)).filter((p): p is Projeto => Boolean(p));
    setLista(filtrada.some((p) => p.id === idInicial) ? filtrada : todos);
    setExpandida(true);

    const salvo = lerPreferencia(CHAVE_MODO);
    if (salvo === "carrossel" || salvo === "vertical") setModo(salvo);

    const mq = matchMedia("(max-width: 899px)");
    const aplicar = () => setCelular(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [todos, idInicial]);

  const vertical = celular && modo === "vertical";
  const indice = Math.max(0, lista.findIndex((p) => p.id === atualId));
  const atual = lista[indice] ?? inicial;
  indiceRef.current = indice;

  const posicao = expandida ? indice + 1 : todos.findIndex((p) => p.id === idInicial) + 1;
  const total = expandida ? lista.length : todos.length;

  // ── endereço e título acompanham o projeto atual ────────────────────────
  useEffect(() => {
    if (!expandida) return;
    const alvo = `/projetos/${atual.id}`;
    if (location.pathname !== alvo) history.replaceState(null, "", alvo);
    document.title = `${atual.id} · ${atual.nome} · 60 Projetos de Calistenia`;
  }, [atual, expandida]);

  // ── posiciona o trilho / o feed no projeto atual, ANTES da pintura ──────
  useLayoutEffect(() => {
    if (!expandida) return;
    if (vertical) {
      document.getElementById(`projeto-${atualId}`)?.scrollIntoView({ block: "start" });
    } else if (trilhoRef.current) {
      const t = trilhoRef.current;
      t.scrollTo({ left: indiceRef.current * t.clientWidth, behavior: "instant" as ScrollBehavior });
    }
    // só quando a lista chega ou o modo muda — não a cada troca de projeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandida, vertical, lista]);

  // ── a largura do trilho muda (coluna de dimensões entra/sai no PC, giro do
  //    celular): reencaixa no projeto atual. Sem isso a posição antiga,
  //    medida na largura antiga, apontaria para OUTRO projeto. ───────────────
  useEffect(() => {
    const t = trilhoRef.current;
    if (!t || vertical) return;
    let largura = t.clientWidth;
    const obs = new ResizeObserver(() => {
      if (Math.abs(t.clientWidth - largura) < 1) return;
      largura = t.clientWidth;
      t.scrollTo({ left: indiceRef.current * largura, behavior: "instant" as ScrollBehavior });
    });
    obs.observe(t);
    return () => obs.disconnect();
  }, [vertical, expandida]);

  // ── carrossel: descobre o projeto pela posição da rolagem ───────────────
  useEffect(() => {
    const t = trilhoRef.current;
    if (!t || vertical || !expandida) return;
    let espera: ReturnType<typeof setTimeout>;
    const aoRolar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const i = Math.round(t.scrollLeft / t.clientWidth);
        const p = lista[i];
        if (p && p.id !== atualId) setAtualId(p.id);
      }, 90);
    };
    t.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      t.removeEventListener("scroll", aoRolar);
      clearTimeout(espera);
    };
  }, [lista, atualId, vertical, expandida]);

  // ── feed vertical: o painel que ocupa a tela vira o atual ───────────────
  useEffect(() => {
    if (!vertical || !expandida) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visivel?.target.getAttribute("data-id");
        if (id) setAtualId(id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    document.querySelectorAll(".cartao-vertical").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [vertical, expandida, lista]);

  const irPara = useCallback(
    (i: number) => {
      const p = lista[i];
      if (!p) return;
      const t = trilhoRef.current;
      if (t && !vertical) {
        t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" });
      }
      setAtualId(p.id);
    },
    [lista, vertical],
  );

  // ── teclado no PC: ← → passam de projeto (fora do visor de zoom) ────────
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (vertical || document.querySelector(".visor")) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") irPara(indiceRef.current + 1);
      if (e.key === "ArrowLeft") irPara(indiceRef.current - 1);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [irPara, vertical]);

  function escolherModo(m: ModoCelular) {
    setModo(m);
    gravarPreferencia(CHAVE_MODO, m);
  }

  const anterior = lista[indice - 1];
  const proximo = lista[indice + 1];

  return (
    <div>
      <div className="proj-barra">
        <VoltarAoCatalogo />
        <span className="proj-posicao" aria-live="polite">
          Projeto <b className="numero">{posicao}</b> de <span className="numero">{total}</span>
        </span>
        <div className="seletor-modo" role="group" aria-label="Como passar os projetos">
          <button type="button" aria-pressed={!vertical} onClick={() => escolherModo("carrossel")}>
            Carrossel
          </button>
          <button type="button" aria-pressed={vertical} onClick={() => escolherModo("vertical")}>
            Vertical
          </button>
        </div>
      </div>

      {vertical ? (
        <div className="feed-vertical">
          {lista.map((p) => (
            <article key={p.id} id={`projeto-${p.id}`} data-id={p.id} className="cartao-vertical pj">
              <Cabecalho p={p} nivel="h2" />
              <div className={`pj-body${p.referencia?.zona ? " com-dimensoes" : ""}`}>
                <div className="pj-col">
                  <h3>
                    <em>›</em>Projeto
                  </h3>
                  <Visualizador
                    src={urlFicha(p.id)}
                    largura={p.ficha.largura}
                    altura={p.ficha.altura}
                    alt={`Ficha ${p.id}: ${p.nome}`}
                    titulo={`${p.id} · ${p.nome}`}
                    rotuloAmpliar="Ampliar"
                    carregamento="lazy"
                    giroAutomatico
                  />
                </div>
                <BlocoDimensoes p={p} />
              </div>
              <Faixa p={p} />
              <Acoes p={p} />
            </article>
          ))}
          <div className="feed-fim">
            <AvisoTecnico />
          </div>
        </div>
      ) : (
        <>
          <article className="pj">
            <Cabecalho p={atual} nivel="h1" />
            <div className={`pj-body${atual.referencia?.zona ? " com-dimensoes" : ""}`}>
              <div className="pj-col">
                <h3>
                  <em>›</em>Projeto
                </h3>
                <div className="palco-projetos">
                  <button
                    type="button"
                    className="seta seta-esq"
                    onClick={() => irPara(indice - 1)}
                    disabled={!anterior}
                    aria-label={anterior ? `Projeto anterior: ${anterior.id}` : "Não há projeto anterior"}
                  >
                    <IconeSeta />
                  </button>

                  <div className="trilho" ref={trilhoRef}>
                    {lista.map((p, i) => (
                      <div key={p.id} className="slide" aria-hidden={p.id !== atual.id}>
                        {Math.abs(i - indice) <= 1 ? (
                          <Visualizador
                            src={urlFicha(p.id)}
                            largura={p.ficha.largura}
                            altura={p.ficha.altura}
                            alt={`Ficha ${p.id}: ${p.nome}`}
                            titulo={`${p.id} · ${p.nome}`}
                            rotuloAmpliar="Ampliar ficha"
                            giroAutomatico
                          />
                        ) : (
                          <div className="slide-vazio" style={{ aspectRatio: `${p.ficha.largura} / ${p.ficha.altura}` }} />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="seta seta-dir"
                    onClick={() => irPara(indice + 1)}
                    disabled={!proximo}
                    aria-label={proximo ? `Próximo projeto: ${proximo.id}` : "Não há próximo projeto"}
                  >
                    <IconeSeta />
                  </button>
                </div>
                <p className="dica-arraste">Arraste a ficha para o lado para trocar de projeto</p>
              </div>
              <BlocoDimensoes p={atual} />
            </div>
            <Faixa p={atual} />
            <Acoes p={atual} />
          </article>

          <nav className="vizinhos" aria-label="Outros projetos">
            {anterior ? (
              <button type="button" className="vizinho" onClick={() => irPara(indice - 1)}>
                <span>← Anterior</span>
                <strong>
                  {anterior.id} · {anterior.nome}
                </strong>
              </button>
            ) : (
              <span />
            )}
            {proximo && (
              <button type="button" className="vizinho vizinho-prox" onClick={() => irPara(indice + 1)}>
                <span>Próximo →</span>
                <strong>
                  {proximo.id} · {proximo.nome}
                </strong>
              </button>
            )}
          </nav>

          <div style={{ marginTop: 22 }}>
            <AvisoTecnico />
          </div>
        </>
      )}
    </div>
  );
}

function Cabecalho({ p, nivel }: { p: Projeto; nivel: "h1" | "h2" }) {
  const Titulo = nivel;
  return (
    <header className="pj-head">
      <span className="pj-code">{p.id}</span>
      <Titulo className="pj-nome">{p.nome}</Titulo>
      <Link className="pj-fam" href={`/projetos?categoria=${p.categoria.slug}`}>
        {p.categoria.nome}
      </Link>
    </header>
  );
}

/** Só aparece quando o modelo de referência informa a área de segurança. Sem dado, sem bloco. */
function BlocoDimensoes({ p }: { p: Projeto }) {
  if (!p.referencia?.zona) return null;
  return (
    <div className="pj-col">
      <h3>
        <em>›</em>Dimensões de referência
      </h3>
      <PlantaDimensoes id={p.id} referencia={p.referencia} />
    </div>
  );
}

/** "Mergulho em barra reta: a pessoa sobe…" → título antes dos dois-pontos, detalhe depois. */
function partirExercicio(texto: string) {
  const i = texto.indexOf(":");
  if (i < 0 || i > 90) return { titulo: texto, detalhe: null };
  const detalhe = texto.slice(i + 1).trim();
  return { titulo: texto.slice(0, i).trim(), detalhe: detalhe.charAt(0).toUpperCase() + detalhe.slice(1) };
}

function Faixa({ p }: { p: Projeto }) {
  const exercicio = p.exercicio ? partirExercicio(p.exercicio) : null;
  const tubo = p.referencia?.tuboBarras;
  return (
    <div className="pj-info">
      {exercicio && (
        <div>
          <small>Exercício</small>
          <b>{exercicio.titulo}</b>
          {exercicio.detalhe && <span>{exercicio.detalhe}</span>}
        </div>
      )}
      {p.alturaUso && (
        <div>
          <small>Altura de uso</small>
          <b>{p.alturaUso.rotulo}</b>
          {p.alturaUso.detalhe && <span>{p.alturaUso.detalhe}</span>}
        </div>
      )}
      {p.instalacao && (
        <div>
          <small>Instalação</small>
          <b>{p.instalacao.rotulo}</b>
          {p.instalacao.detalhe && <span>{p.instalacao.detalhe}</span>}
        </div>
      )}
      {tubo && p.referencia && (
        <div>
          <small>Tubo de referência</small>
          <b>{bitola(tubo)}</b>
          <span>Tubo das barras do modelo {nomeDoModelo(p.referencia)} — referência de mercado.</span>
        </div>
      )}
    </div>
  );
}

function Acoes({ p }: { p: Projeto }) {
  return (
    <div className="pj-acoes">
      <a href={urlDownloadFicha(p.id)} className="botao" download>
        <IconeBaixar /> Baixar esta ficha
      </a>
      <span className="dica">PNG em alta resolução, para guardar no celular ou imprimir.</span>
    </div>
  );
}

function IconeSeta() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeBaixar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
