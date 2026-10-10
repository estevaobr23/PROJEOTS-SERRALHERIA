import type { Referencia } from "@/lib/config/projetos";
import { metros, metrosQuadrados, nomeDoModelo } from "@/lib/formato";

/**
 * PLANTA VISTA DE CIMA — a área livre de segurança, no estilo da aba
 * "Dimensions" da Benito (molde: o SVG da REF-09 na página de vendas).
 *
 * REGRA (não negociável): todo número vem de `referencia`, que vem de
 * dimensoes-fabricantes.json via `npm run sincronizar`. São medidas de um
 * modelo equivalente de OUTRO fabricante, e A × B é a área LIVRE ao redor do
 * equipamento — não o tamanho da peça. Por isso:
 *   • o retângulo tracejado é desenhado na proporção REAL de A × B;
 *   • o equipamento NÃO é desenhado: a fonte não traz a planta dele, e
 *     desenhá-lo seria geometria inventada. Fica só a marca do centro;
 *   • os afastamentos internos (o "1500" da página de vendas) não estão na
 *     fonte, então não aparecem;
 *   • cada ícone só aparece se o dado existir.
 * Sem `zona`, quem chama não renderiza este bloco.
 */

const L = 520;
const ALT = 400;
// caixa onde a zona é encaixada (sobra espaço para as cotas à esquerda e em cima)
const CX = 92;
const CY = 78;
const CW = 404;
const CH = 292;

export function PlantaDimensoes({ id, referencia }: { id: string; referencia: Referencia }) {
  const zona = referencia.zona;
  if (!zona) return null;

  const escala = Math.min(CW / zona.aMm, CH / zona.bMm);
  const w = zona.aMm * escala;
  const h = zona.bMm * escala;
  const x0 = CX + (CW - w) / 2;
  const y0 = CY + (CH - h) / 2;
  const rx = Math.min(w, h) * 0.41;
  const meioX = x0 + w / 2;
  const meioY = y0 + h / 2;
  const marcador = `seta-${id}`;

  const yCotaA = y0 - 26;
  const xCotaB = x0 - 26;

  return (
    <>
      <svg
        className="pj-plan"
        viewBox={`0 0 ${L} ${ALT}`}
        role="img"
        aria-label={`Planta vista de cima: área livre de segurança de ${metros(zona.aMm)} por ${metros(zona.bMm)} ao redor do equipamento (medida de referência de outro fabricante)`}
      >
        <defs>
          <marker id={marcador} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#0f1a33" />
          </marker>
        </defs>
        <g fontFamily="var(--fonte), Montserrat, system-ui, sans-serif">
          {/* cota A */}
          <path d={`M${x0} ${y0 - 6}V${yCotaA - 8}M${x0 + w} ${y0 - 6}V${yCotaA - 8}`} stroke="#0f1a33" strokeWidth="1" />
          <path
            d={`M${x0 + 4} ${yCotaA}H${x0 + w - 4}`}
            stroke="#0f1a33"
            strokeWidth="1.4"
            markerStart={`url(#${marcador})`}
            markerEnd={`url(#${marcador})`}
          />
          <text x={meioX} y={yCotaA - 9} textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f1a33">
            A = {metros(zona.aMm)}
          </text>

          {/* cota B */}
          <path d={`M${x0 - 6} ${y0}H${xCotaB - 8}M${x0 - 6} ${y0 + h}H${xCotaB - 8}`} stroke="#0f1a33" strokeWidth="1" />
          <path
            d={`M${xCotaB} ${y0 + 4}V${y0 + h - 4}`}
            stroke="#0f1a33"
            strokeWidth="1.4"
            markerStart={`url(#${marcador})`}
            markerEnd={`url(#${marcador})`}
          />
          <text
            x={xCotaB - 9}
            y={meioY}
            textAnchor="middle"
            fontSize="17"
            fontWeight="800"
            fill="#0f1a33"
            transform={`rotate(-90 ${xCotaB - 9} ${meioY})`}
          >
            B = {metros(zona.bMm)}
          </text>

          {/* área livre de segurança */}
          <rect
            x={x0}
            y={y0}
            width={w}
            height={h}
            rx={rx}
            fill="rgba(14,165,233,.06)"
            stroke="#7d8aa3"
            strokeWidth="1.6"
            strokeDasharray="9 7"
          />

          {/* só a marca do centro: o equipamento não é desenhado (ver comentário acima) */}
          <path d={`M${meioX - 12} ${meioY}H${meioX + 12}M${meioX} ${meioY - 12}V${meioY + 12}`} stroke="#13233f" strokeWidth="2" />
          <text x={meioX} y={meioY + 30} textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1.5" fill="#566079">
            EQUIPAMENTO
          </text>
        </g>
      </svg>

      <div className="pj-stats">
        <div>
          <svg viewBox="0 0 30 30" fill="none" stroke="#13233f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="24" height="24" rx="3" />
            <text x="15" y="19" textAnchor="middle" fontSize="8" fontWeight="800" fill="#13233f" stroke="none">
              A×B
            </text>
          </svg>
          <b>
            {metros(zona.aMm)} × {metros(zona.bMm)}
          </b>
          <small>área livre (A × B)</small>
        </div>
        {referencia.areaM2 !== null && (
          <div>
            <svg viewBox="0 0 30 30" fill="none" stroke="#13233f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="24" height="24" rx="3" />
              <path d="M9 21V13a4 4 0 0 1 4-4h8v6a6 6 0 0 1-6 6z" strokeDasharray="2.5 2" />
            </svg>
            <b>{metrosQuadrados(referencia.areaM2)}</b>
            <small>área de segurança</small>
          </div>
        )}
        {referencia.quedaMm !== null && (
          <div>
            <svg viewBox="0 0 30 30" fill="none" stroke="#13233f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="24" height="24" rx="3" />
              <path d="M8 15l6-5 6 5M10 14v7h8v-7" />
              <path d="M23 9v13M21 11l2-2 2 2M21 20l2 2 2-2" />
            </svg>
            <b>{metros(referencia.quedaMm)}</b>
            <small>altura de queda livre</small>
          </div>
        )}
        {referencia.usuarios !== null && (
          <div>
            <svg viewBox="0 0 30 30" fill="none" stroke="#13233f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="24" height="24" rx="3" />
              <circle cx="15" cy="10" r="2.6" />
              <path d="M10 14h10M15 13v9M12 22l3-4 3 4" />
            </svg>
            <b>{referencia.usuarios}</b>
            <small>{referencia.usuarios === 1 ? "usuário por vez" : "usuários ao mesmo tempo"}</small>
          </div>
        )}
      </div>

      <p className="pj-fonte">
        <strong>Medidas de referência</strong> do modelo equivalente {nomeDoModelo(referencia)}, de outro
        fabricante. A e B são a área livre de segurança ao redor do equipamento — não são medidas de corte.
      </p>
    </>
  );
}
