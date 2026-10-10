import type { Referencia } from "@/lib/config/projetos";

/** 5000 → "5,00 m". Só troca de unidade: o número vem de dimensoes-fabricantes.json. */
export const metros = (mm: number) =>
  `${(mm / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

export const metrosQuadrados = (m2: number) =>
  `${m2.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;

/** "Ø40x3mm" → "Ø40 × 3 mm" — só espaçamento, o valor é o da fonte. */
export const bitola = (t: string) => t.replace(/(\d)\s*x\s*(\d)/gi, "$1 × $2").replace(/(\d)\s*mm/gi, "$1 mm");

/** Como o modelo de referência aparece escrito: "Benito JSW02 (Parallel Bars x2)". */
export function nomeDoModelo(r: Referencia): string {
  if (r.fabricante === "Benito") return `Benito ${r.codigo} (${r.modelo})`;
  // Kompan/SKOR já trazem o fabricante no nome: "Combi Steps FSW219 (Kompan)"
  return r.fabricante && !r.modelo.includes(r.fabricante) ? `${r.fabricante} — ${r.modelo}` : r.modelo;
}
