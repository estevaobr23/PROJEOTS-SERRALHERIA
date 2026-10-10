"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIAS } from "@/lib/config/categorias";
import { urlMiniatura } from "@/lib/urls";
import {
  CHAVE_LISTA_NAVEGACAO,
  CHAVE_ULTIMA_BUSCA,
  lerPreferencia,
  gravarPreferencia,
  normalizarBusca,
} from "@/lib/rotulos";

export interface ProjetoResumo {
  id: string;
  numero: string;
  nome: string;
  categoria: string;
  categoriaNome: string;
  exercicio: string;
  altura: string | null;
  instalacao: string | null;
}

type Feed = "normal" | "duplo";
const CHAVE_FEED = "projetos:feed";

/** "Parede ou chão" → "parede-ou-chao": o valor do filtro na URL. */
const paraSlug = (t: string) => normalizarBusca(t).replace(/\s+/g, "-");

/**
 * Os filtros moram na URL (?categoria=&altura=&instalacao=&q=), não em estado:
 * o botão voltar do celular devolve a pessoa exatamente à lista que ela via, e
 * um atalho da Início ("/projetos?categoria=paralelas") já chega filtrado.
 *
 * O FEED (Normal × Duplo) é preferência da pessoa, não da busca: mora no
 * localStorage. É lido em useEffect, NUNCA no inicializador do useState — o
 * servidor não tem localStorage e o primeiro render precisa bater com o HTML.
 *
 * As opções de cada filtro são DERIVADAS da lista real de projetos, com a
 * contagem ao lado: opção que não existe não aparece.
 */
export function Catalogo({ projetos }: { projetos: ProjetoResumo[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [feed, setFeed] = useState<Feed>("normal");

  useEffect(() => {
    const salvo = lerPreferencia(CHAVE_FEED);
    if (salvo === "normal" || salvo === "duplo") setFeed(salvo);
  }, []);

  function escolherFeed(f: Feed) {
    setFeed(f);
    gravarPreferencia(CHAVE_FEED, f);
  }

  const categoria = busca.get("categoria");
  const altura = busca.get("altura");
  const instalacao = busca.get("instalacao");

  // BUSCA POR TEXTO. O que a pessoa digita vive em estado local (a tecla tem de
  // aparecer na hora) e a lista filtra a cada letra; a URL (?q=) é só um espelho,
  // gravado com atraso, para o "voltar" devolver a busca.
  const [texto, setTexto] = useState(() => busca.get("q") ?? "");
  const ultimoQ = useRef(busca.get("q") ?? "");

  useEffect(() => {
    const q = busca.get("q") ?? "";
    if (q !== ultimoQ.current) {
      ultimoQ.current = q;
      setTexto(q);
    }
  }, [busca]);

  useEffect(() => {
    const q = texto.trim();
    if (q === ultimoQ.current) return;
    const t = setTimeout(() => {
      ultimoQ.current = q;
      // lê a URL de agora (não a do render): um filtro clicado nesse meio-tempo não se perde
      const novo = new URLSearchParams(window.location.search);
      if (q) novo.set("q", q);
      else novo.delete("q");
      const qs = novo.toString();
      router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [texto, router, caminho]);

  const palavras = useMemo(() => normalizarBusca(texto).split(" ").filter(Boolean), [texto]);

  // Texto pesquisável de cada projeto, montado uma vez: código + nome + exercício + categoria.
  const textos = useMemo(
    () =>
      new Map(
        projetos.map((p) => [
          p.id,
          normalizarBusca([p.id, `ref ${p.numero}`, p.numero, p.nome, p.exercicio, p.categoriaNome].join(" ")),
        ]),
      ),
    [projetos],
  );

  const contar = (campo: "categoria" | "altura" | "instalacao") => {
    const mapa = new Map<string, { slug: string; nome: string; total: number }>();
    for (const p of projetos) {
      const nome = campo === "categoria" ? p.categoriaNome : p[campo];
      if (!nome) continue;
      const slug = campo === "categoria" ? p.categoria : paraSlug(nome);
      const atual = mapa.get(slug) ?? { slug, nome, total: 0 };
      atual.total++;
      mapa.set(slug, atual);
    }
    return mapa;
  };

  const opcoesCategoria = useMemo(() => {
    const m = contar("categoria");
    // na ordem editorial de categorias.ts, não na ordem em que aparecem
    return CATEGORIAS.map((c) => m.get(c.slug)).filter((o): o is NonNullable<typeof o> => Boolean(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opcoesAltura = useMemo(() => [...contar("altura").values()], [projetos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opcoesInstalacao = useMemo(() => [...contar("instalacao").values()], [projetos]);

  const filtrados = useMemo(
    () =>
      projetos.filter(
        (p) =>
          (!categoria || p.categoria === categoria) &&
          (!altura || (p.altura && paraSlug(p.altura) === altura)) &&
          (!instalacao || (p.instalacao && paraSlug(p.instalacao) === instalacao)) &&
          palavras.every((w) => textos.get(p.id)?.includes(w)),
      ),
    [projetos, categoria, altura, instalacao, palavras, textos],
  );

  const algumFiltro = Boolean(categoria || altura || instalacao || palavras.length);

  // Guarda a busca (para o "voltar") e a LISTA FILTRADA (para as setas da
  // página do projeto andarem só entre o que ela estava vendo).
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_ULTIMA_BUSCA, busca.toString());
      sessionStorage.setItem(CHAVE_LISTA_NAVEGACAO, JSON.stringify(filtrados.map((p) => p.id)));
    } catch {
      /* modo privado / storage bloqueado: voltar e setas usam a lista inteira */
    }
  }, [busca, filtrados]);

  function alternar(chave: string, valor: string) {
    const novo = new URLSearchParams(window.location.search);
    if (novo.get(chave) === valor) novo.delete(chave);
    else novo.set(chave, valor);
    const qs = novo.toString();
    router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  }

  function limpar() {
    ultimoQ.current = "";
    setTexto("");
    router.replace(caminho, { scroll: false });
  }

  const grupos = [
    { chave: "categoria", nome: "Categoria", opcoes: opcoesCategoria, atual: categoria, classe: "filtro-categoria" },
    { chave: "altura", nome: "Altura de uso", opcoes: opcoesAltura, atual: altura, classe: "" },
    { chave: "instalacao", nome: "Instalação", opcoes: opcoesInstalacao, atual: instalacao, classe: "" },
  ];

  return (
    <>
      <section className="filtros" aria-label="Filtros">
        <div className="pesquisa">
          <svg className="pesquisa-lupa" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="pesquisa-campo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pesquisar: REF-09, paralela, mergulho…"
            aria-label="Pesquisar projetos"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {texto && (
            <button type="button" className="pesquisa-limpar" onClick={() => setTexto("")} aria-label="Apagar a pesquisa">
              ×
            </button>
          )}
        </div>

        {grupos.map((g) => (
          <div key={g.chave} className={`filtro ${g.classe}`}>
            <span className="filtro-nome" id={`f-${g.chave}`}>
              {g.nome}
            </span>
            <div className="opcoes" role="group" aria-labelledby={`f-${g.chave}`}>
              {g.opcoes.map((o) => (
                <button
                  key={o.slug}
                  type="button"
                  className="opcao"
                  aria-pressed={g.atual === o.slug}
                  onClick={() => alternar(g.chave, o.slug)}
                >
                  {o.nome}
                  <span className="numero">{o.total}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="filtros-rodape">
          <span className="contagem" aria-live="polite">
            <strong>{filtrados.length}</strong> {filtrados.length === 1 ? "projeto encontrado" : "projetos encontrados"}
          </span>
          <button type="button" className="limpar" onClick={limpar} disabled={!algumFiltro}>
            Limpar filtros
          </button>
          <div className="seletor-feed" role="group" aria-label="Como ver os projetos">
            <button type="button" aria-pressed={feed === "normal"} onClick={() => escolherFeed("normal")}>
              <IconeNormal /> Normal
            </button>
            <button type="button" aria-pressed={feed === "duplo"} onClick={() => escolherFeed("duplo")}>
              <IconeDuplo /> Duplo
            </button>
          </div>
        </div>
      </section>

      {filtrados.length === 0 ? (
        <div className="vazio">
          <h2>Nenhum projeto encontrado</h2>
          <p>{palavras.length ? "Confira o que foi digitado ou tire algum filtro." : "Tire algum filtro para ver mais opções."}</p>
          <button type="button" className="botao botao-claro" onClick={limpar} style={{ marginTop: 10 }}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className={`grade-projetos feed-${feed}`} data-feed={feed}>
          {filtrados.map((p, i) => (
            <Link key={p.id} href={`/projetos/${p.id}`} className="card">
              <div className="card-imagem">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlMiniatura(p.id)}
                  alt={`Ficha ${p.id}: ${p.nome}`}
                  width={1672}
                  height={941}
                  loading={i < 4 ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>
              <div className="card-corpo">
                <span className="card-tipo">
                  <span className="card-num">{p.id}</span> {p.categoriaNome}
                </span>
                <h3>{p.nome}</h3>
                <div className="card-dados">
                  {p.altura && <span className="chip">Altura: {p.altura}</span>}
                  {p.instalacao && <span className="chip">{p.instalacao}</span>}
                </div>
                <span className="card-acao">Abrir projeto →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function IconeNormal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="12" height="5" rx="1.2" fill="currentColor" />
      <rect x="2" y="9" width="12" height="5" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function IconeDuplo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
    </svg>
  );
}
