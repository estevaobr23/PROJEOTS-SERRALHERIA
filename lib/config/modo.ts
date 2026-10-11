/**
 * SITE ABERTO — interruptor da área de membros.
 *
 *   false (ATUAL) = LOGIN POR E-MAIL, sem senha: só entra quem tem compra
 *                   aprovada (entitlement ativo no Supabase). Fichas saem do
 *                   bucket privado por URL assinada de 1h.
 *   true          = site aberto: sem login, qualquer pessoa com o endereço vê
 *                   tudo e baixa as fichas de public/fichas (decisão temporária
 *                   de 10/10/2026, já desligada).
 *
 * A variável ACESSO_ABERTO sobrepõe: "0" fecha (os testes usam), "1" abre.
 */
export const SITE_ABERTO = false;
