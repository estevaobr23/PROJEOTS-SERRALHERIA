/**
 * Núcleo do motor de acesso — as 6 tabelas do Supabase.
 *
 * ⚠️ ESTE PROJETO USA CAKTO, NÃO WIAPY.
 * A coluna de casamento é `cakto_product_id` (o `data.product.id` do evento
 * `purchase_approved`). Quem grava é a Edge Function `cakto-webhook`, em
 * supabase/functions/. O app só LÊ essas tabelas — a única em que ele escreve
 * é `sessions`.
 */

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  slug: string;
  /** idêntico ao nome do produto na Cakto — é a rede de segurança do
   *  casamento por título quando o id não bate */
  name: string;
  cakto_product_id: string | null;
  created_at: string;
}

/** Escrito pelo webhook: 'paid' em purchase_approved, 'refunded' em refund,
 *  'chargedback' em chargeback. 'pending' nunca é gravado hoje (a Cakto só
 *  chama o webhook em compra aprovada), mas fica no tipo por segurança. */
export type PurchaseStatus = "paid" | "pending" | "refunded" | "chargedback";

export interface Purchase {
  id: string;
  customer_id: string;
  transaction_id: string;
  status: PurchaseStatus;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  created_at: string;
}

export type EntitlementStatus = "active" | "revoked";

/** Acesso liberado de um cliente a um produto. É isto que o app lê.
 *  O app só considera acesso quando status === 'active' — 'revoked' cobre
 *  reembolso e chargeback; o motivo fica em `revoke_reason`. */
export interface Entitlement {
  id: string;
  customer_id: string;
  product_id: string;
  status: EntitlementStatus;
  /** null enquanto ativo; timestamp do corte quando revogado pelo webhook */
  revoked_at: string | null;
  /** 'refund' | 'chargeback' | motivo livre de um ajuste manual */
  revoke_reason: string | null;
  created_at: string;
}

/** Sessão de login por e-mail (sem senha). */
export interface Session {
  id: string;
  customer_id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
}
