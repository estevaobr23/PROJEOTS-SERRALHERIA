/** Rótulos e preferências usados tanto no servidor quanto no navegador. */

/** Onde o "voltar" da página do projeto encontra os filtros que ela deixou. */
export const CHAVE_ULTIMA_BUSCA = "projetos:ultima-busca";

/** A lista FILTRADA do feed, na ordem — é por ela que as setas andam. */
export const CHAVE_LISTA_NAVEGACAO = "projetos:lista";

/** Para a pesquisa: minúsculo, sem acento, espaços simples. "Força" casa com "forca". */
export const normalizarBusca = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** localStorage com try/catch na leitura E na escrita: storage bloqueado não derruba a tela. */
export function lerPreferencia(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarPreferencia(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* modo privado: vale só nesta visita */
  }
}
