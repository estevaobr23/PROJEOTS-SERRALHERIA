"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

interface Props {
  src: string;
  largura: number;
  altura: number;
  alt: string;
  /** aparece na barra do visor */
  titulo: string;
  /** texto do botão sobre a miniatura */
  rotuloAmpliar?: string;
  /** "lazy" no feed vertical: só baixa a prancha quando ela chega perto da tela */
  carregamento?: "lazy" | "eager";
  /**
   * false desliga o giro automático por completo (fica sempre "nao"): serve
   * para conteúdo que já nasce em pé, como uma cartinha retrato — girar uma
   * imagem que já está no sentido da tela não ajuda em nada. Default true
   * (comportamento original, para pranchas deitadas).
   */
  giroAutomatico?: boolean;
}

type Giro = "auto" | "sim" | "nao";

/**
 * VISUALIZADOR DA FICHA (veio da área de casas, que usa pranchas 16:9 iguais) — o ponto que decide se o produto serve no celular.
 *
 * A prancha é 16:9 e cheia de detalhe pequeno (cotas, área de cada ambiente).
 * Numa tela em pé, com largura 100%, ela vira uma faixa de 220px de altura:
 * ilegível. Três decisões resolvem isso:
 *
 * 1. TELA CHEIA ao tocar. Fundo branco, barra fina, a prancha ocupa o resto.
 *
 * 2. GIRO AUTOMÁTICO: com o celular em pé, a prancha é desenhada deitada (90°)
 *    e ocupa a ALTURA da tela — ~1,8× maior que de pé, sem a pessoa precisar
 *    girar o aparelho. Se ela girar o celular, a tela fica deitada e o giro sai
 *    sozinho. O botão "Girar" força para um lado ou outro.
 *
 * 3. A IMAGEM É DESENHADA NO TAMANHO NATIVO (1672 px) e REDUZIDA pela escala
 *    inicial até caber. Ampliar é voltar em direção à escala 1 — o navegador
 *    rasteriza a camada na resolução real do arquivo, e a prancha não borra no
 *    zoom (o Safari borra quando se amplia uma imagem desenhada pequena).
 *
 * Pinça, arrastar e toque duplo vêm da react-zoom-pan-pinch. O botão voltar do
 * Android FECHA o visor (pushState) em vez de sair da página.
 */
export function Visualizador({
  src,
  largura,
  altura,
  alt,
  titulo,
  rotuloAmpliar = "Ampliar",
  carregamento = "eager",
  giroAutomatico = true,
}: Props) {
  const [aberto, setAberto] = useState(false);

  const abrir = useCallback(() => {
    setAberto(true);
    // Tela cheia de verdade onde existe (Android): some a barra do navegador.
    // Precisa partir do gesto do usuário — por isso está aqui e não num efeito.
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen && matchMedia("(pointer: coarse)").matches) {
        el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }
    } catch {
      /* iOS não tem Fullscreen API para elementos: o visor fixo já resolve */
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className="prancha"
        onClick={abrir}
        style={{ ["--proporcao" as string]: `${largura} / ${altura}` }}
        aria-label={`${rotuloAmpliar}: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={largura} height={altura} decoding="async" loading={carregamento} draggable={false} />
        <span className="prancha-dica" aria-hidden="true">
          <IconeLupa /> {rotuloAmpliar}
        </span>
      </button>

      {aberto && (
        <Visor
          src={src}
          largura={largura}
          altura={altura}
          alt={alt}
          titulo={titulo}
          giroAutomatico={giroAutomatico}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function Visor({
  src,
  largura,
  altura,
  alt,
  titulo,
  giroAutomatico = true,
  onFechar,
}: Omit<Props, "rotuloAmpliar" | "carregamento"> & { onFechar: () => void }) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  const [palco, setPalco] = useState<{ w: number; h: number } | null>(null);
  const [giro, setGiro] = useState<Giro>("auto");
  const [carregada, setCarregada] = useState(false);
  const [dicaVisivel, setDicaVisivel] = useState(true);

  // Ref, não dependência: o pai recria a função a cada render, e o efeito do
  // histórico NÃO pode rodar de novo (empurraria outra entrada no histórico).
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  }, [onFechar]);

  // Fechar: se o visor empurrou uma entrada no histórico, volta nela (o
  // popstate fecha). Assim botão "Fechar" e botão voltar do celular dão no mesmo.
  const fechar = useCallback(() => {
    if (history.state?.visor) history.back();
    else onFecharRef.current();
  }, []);

  useEffect(() => {
    history.pushState({ ...(history.state ?? {}), visor: true }, "");
    const aoVoltar = () => onFecharRef.current();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("popstate", aoVoltar);
    window.addEventListener("keydown", aoTeclar);

    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("popstate", aoVoltar);
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAntes;
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      } catch {
        /* sem Fullscreen API */
      }
    };
  }, [fechar]);

  // Mede o palco — o MESMO elemento do primeiro ao último render — e remede ao
  // girar o celular ou redimensionar a janela.
  useEffect(() => {
    const el = palcoRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setPalco((atual) =>
        atual && Math.abs(atual.w - r.width) < 1 && Math.abs(atual.h - r.height) < 1 ? atual : { w: r.width, h: r.height },
      );
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDicaVisivel(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const deitada = largura > altura;
  const emPe = palco ? palco.h > palco.w * 1.05 : false;
  const girada = giro === "auto" ? giroAutomatico && deitada && emPe : giro === "sim";

  // Dimensões do conteúdo no tamanho NATIVO (ver item 3 do comentário acima).
  const cw = girada ? altura : largura;
  const ch = girada ? largura : altura;
  const ajuste = palco ? Math.min(palco.w / cw, palco.h / ch) : 1;
  // Até ~4× a resolução nativa: além disso não há detalhe novo a revelar.
  const maximo = Math.max(ajuste * 6, 4);

  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label={titulo}>
      <BarraVisor
        titulo={titulo}
        girada={girada}
        mostrarGirar={giroAutomatico || deitada}
        onGirar={() => setGiro(girada ? "nao" : "sim")}
        onMais={() => zoomRef.current?.zoomIn(0.6)}
        onMenos={() => zoomRef.current?.zoomOut(0.6)}
        onAjustar={() => zoomRef.current?.centerView(ajuste)}
        onFechar={fechar}
      />
      <div className="visor-palco" ref={palcoRef}>
        {palco && (
          <TransformWrapper
            ref={zoomRef}
            // Remonta ao girar ou mudar o tamanho do palco: a escala de ajuste muda.
            key={`${girada}-${Math.round(palco.w)}x${Math.round(palco.h)}`}
            initialScale={ajuste}
            minScale={ajuste}
            maxScale={maximo}
            centerOnInit
            centerZoomedOut
            limitToBounds
            wheel={{ step: 0.12 }}
            pinch={{ step: 8 }}
            doubleClick={{ mode: "toggle", step: 1.2 }}
          >
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <div style={{ width: cw, height: ch, position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  width={largura}
                  height={altura}
                  draggable={false}
                  onLoad={() => setCarregada(true)}
                  style={{
                    position: "absolute",
                    width: largura,
                    height: altura,
                    left: (cw - largura) / 2,
                    top: (ch - altura) / 2,
                    transform: girada ? "rotate(90deg)" : undefined,
                  }}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
        {!carregada && <div className="visor-carregando">Carregando a ficha…</div>}
        <div className="visor-dica" style={{ opacity: dicaVisivel ? 1 : 0 }} aria-hidden="true">
          Dois dedos para ampliar · toque duplo aproxima
        </div>
      </div>
    </div>
  );
}

function BarraVisor(props: {
  titulo: string;
  girada: boolean;
  mostrarGirar?: boolean;
  onGirar: () => void;
  onMais: () => void;
  onMenos: () => void;
  onAjustar: () => void;
  onFechar: () => void;
}) {
  return (
    <div className="visor-barra">
      <span className="visor-titulo">{props.titulo}</span>
      {props.mostrarGirar !== false && (
        <button type="button" className="visor-botao" aria-pressed={props.girada} onClick={props.onGirar} title="Girar">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="rotulo-botao">Girar</span>
        </button>
      )}
      <button type="button" className="visor-botao" onClick={props.onMenos} aria-label="Diminuir">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="visor-botao" onClick={props.onMais} aria-label="Ampliar">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="visor-botao" onClick={props.onAjustar} title="Ver a ficha inteira">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="rotulo-botao">Inteira</span>
      </button>
      <button type="button" className="visor-botao visor-fechar" onClick={props.onFechar} aria-label="Fechar">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function IconeLupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
