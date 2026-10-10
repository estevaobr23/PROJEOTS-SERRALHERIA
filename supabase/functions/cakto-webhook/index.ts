import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * cakto-webhook — motor de liberacao E revogacao de acesso
 *
 * ⚠️ ADAPTADO PARA CAKTO. O motor `wiapy-webhook` da skill NAO serve aqui.
 * Quatro diferencas de contrato, e as duas primeiras causam falha SILENCIOSA:
 *
 *   | pergunta            | Wiapy                    | Cakto                       |
 *   |---------------------|--------------------------|-----------------------------|
 *   | como autentica      | header Authorization     | campo `body.secret`         |
 *   | como sei que pagou  | payment.status === paid  | `event === purchase_approved` |
 *   | onde estao produtos | array products[]         | objeto unico data.product   |
 *   | prazo               | —                        | 8 segundos, senao reenvia   |
 *
 * ⚠️ QUEM DECIDE O QUE FAZER E O `event`, NUNCA O `status`. No payload da Cakto
 * o `data.status` pode chegar defasado dentro de um evento. Ler o status aqui
 * age na hora errada — ou nao age nunca.
 *
 * TRES EVENTOS TRATADOS (todos chegam no mesmo endpoint):
 *   - purchase_approved  -> LIBERA  (upsert customer/purchase/item/entitlement)
 *   - refund             -> REVOGA  (entitlement.status='revoked', reason='refund')
 *   - chargeback         -> REVOGA  (entitlement.status='revoked', reason='chargeback')
 * Qualquer outro evento (pix_gerado, checkout_abandonment, ...) responde 200 e
 * nao faz nada — 200 evita reenvio inutil.
 *
 * REVOGACAO nao apaga nada: nem customer, nem purchase, nem purchase_item. So
 * marca entitlement.status='revoked' + revoked_at + revoke_reason. O app decide
 * acesso por status='active' (lib/auth/session.ts, lib/data/biblioteca.ts),
 * entao isso ja tira login e entrega de conteudo. Reativar depois e possivel
 * sem perder historico.
 *
 * AREA "60 Projetos de Calistenia": ESCADA DE PRECO — 1 produto na Cakto com
 * 3 ofertas (completo, basico, downsell), cada OFERTA uma linha em `products`.
 * O `product.id` e o `product.name` chegam IGUAIS nas tres; so `offer.id` e
 * `offer.name` as distinguem. Por isso o casamento usa SO a oferta, tanto no id
 * quanto no titulo — casar pelo produto daria o completo a quem pagou o
 * basico. A revogacao NAO precisa desse desempate:
 * localiza a compra pelo transaction_id, revoga os entitlements dos produtos
 * daquela compra, e um reembolso do combo tira o pacote inteiro — que e o certo.
 *
 * PRAZO: a Cakto reenvia (ate 5x) se passar de 8 segundos. Caminho feliz e uma
 * sequencia curta de upserts, sem retry interno e sem espera.
 *
 * Fora de escopo: cancelamento de assinatura, subscription, reembolso parcial.
 *
 * LOGS: nunca registram e-mail, nome, telefone, documento, IP, user-agent nem
 * o secret. Titulo de produto e publico, pode logar.
 */

/** Comparacao em tempo constante — evita descobrir o secret por timing. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ba.length ^ bb.length;
  const max = Math.max(ba.length, bb.length);
  for (let i = 0; i < max; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Normaliza titulo pra comparacao: trim + minusculas + espacos colapsados. */
function normalizeTitle(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// deno-lint-ignore no-explicit-any
type Db = ReturnType<typeof createClient<any, any, any>>;

Deno.serve(async (req: Request) => {
  const reqId = crypto.randomUUID();
  const t0 = Date.now();

  // ---- 1. Metodo -----------------------------------------------------------
  if (req.method !== "POST") {
    console.log(`[${reqId}] metodo rejeitado: ${req.method}`);
    return json(405, { error: "method_not_allowed" });
  }

  const SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  if (!SECRET) {
    console.error(`[${reqId}] CAKTO_WEBHOOK_SECRET nao configurado no ambiente`);
    return json(500, { error: "server_misconfigured" });
  }

  // ---- 2. JSON -----------------------------------------------------------
  // Na Cakto o secret vem DENTRO do corpo, entao o parse acontece antes da
  // autenticacao. E o inverso da Wiapy.
  // deno-lint-ignore no-explicit-any
  let body: any;
  const raw = await req.text();
  try {
    body = JSON.parse(raw);
  } catch {
    console.log(`[${reqId}] 400 — JSON invalido (bytes=${raw.length})`);
    return json(400, { error: "invalid_json" });
  }

  // ---- 3. Autenticacao: body.secret -------------------------------------
  const enviado = texto(body?.secret);
  if (!enviado || !safeEqual(enviado, SECRET)) {
    console.log(`[${reqId}] 401 — secret ausente ou invalido (len=${enviado?.length ?? 0})`);
    return json(401, { error: "unauthorized" });
  }

  // ---- 4. Roteamento por `event` --------------------------------------
  const evento = texto(body?.event);
  const dados = body?.data ?? {};

  console.log(`[${reqId}] evento=${evento ?? "-"} | status=${texto(dados?.status) ?? "-"}`);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error(`[${reqId}] ambiente sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY`);
    return json(500, { error: "server_misconfigured" });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    if (evento === "purchase_approved") {
      return await liberar(db, reqId, t0, dados);
    }
    if (evento === "refund" || evento === "chargeback") {
      return await revogar(db, reqId, t0, evento, dados);
    }
    // pix_gerado, checkout_abandonment, subscription_*, etc. — nada a fazer.
    return json(200, { received: true, processed: false, reason: "event_ignored", event: evento });
  } catch (e) {
    // Nunca vaza o payload no erro — so a mensagem tecnica.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${reqId}] erro inesperado: ${msg}`);
    return json(500, { error: "internal_error" });
  }
});

// ============================================================================
// LIBERAR — evento purchase_approved
// ============================================================================
// deno-lint-ignore no-explicit-any
async function liberar(db: Db, reqId: string, t0: number, dados: any): Promise<Response> {
  const transactionId = texto(dados?.id);
  if (!transactionId) {
    console.error(`[${reqId}] nao processado — data.id ausente`);
    return json(200, { received: true, processed: false, reason: "missing_transaction_id" });
  }

  // ---- Comprador -------------------------------------------------------
  const emailCru = dados?.customer?.email;
  const email = typeof emailCru === "string" ? emailCru.trim().toLowerCase() : "";
  const nome = texto(dados?.customer?.name);

  if (!email) {
    // Sem e-mail nao ha como identificar o comprador. Nada do cliente vai para
    // o log — so o identificador tecnico da transacao.
    console.error(`[${reqId}] nao processado — customer.email ausente | tx=${transactionId}`);
    return json(200, { received: true, processed: false, reason: "missing_email" });
  }

  // ---- Upsert do comprador ------------------------------------------
  // `name` so entra no objeto se veio preenchido — assim um webhook sem nome
  // nunca apaga o nome ja gravado.
  const linhaCliente: Record<string, unknown> = { email };
  if (nome) linhaCliente.name = nome;

  const { data: customer, error: cErr } = await db
    .from("customers")
    .upsert(linhaCliente, { onConflict: "email" })
    .select("id")
    .single();

  if (cErr || !customer) {
    console.error(`[${reqId}] falha no upsert de customer: ${cErr?.code ?? "?"} ${cErr?.message ?? ""}`);
    return json(500, { error: "customer_upsert_failed" });
  }
  const customerId = customer.id as string;

  // ---- Upsert da compra (idempotente por transaction_id) ------------
  // Order bump chega em EVENTO SEPARADO com o mesmo data.id: o upsert devolve a
  // compra que ja existe, e o item novo entra em purchase_items mais abaixo.
  // O status volta a 'paid' aqui de proposito: se por algum motivo a Cakto
  // reenviar um purchase_approved depois de um refund estornado, a compra e o
  // entitlement (mais abaixo) voltam juntos ao estado pago.
  const { data: purchase, error: pErr } = await db
    .from("purchases")
    .upsert(
      { customer_id: customerId, transaction_id: transactionId, status: "paid" },
      { onConflict: "transaction_id" },
    )
    .select("id")
    .single();

  if (pErr || !purchase) {
    console.error(`[${reqId}] falha no upsert de purchase: ${pErr?.code ?? "?"} ${pErr?.message ?? ""}`);
    return json(500, { error: "purchase_upsert_failed" });
  }
  const purchaseId = purchase.id as string;

  // ---- A oferta: objeto UNICO, nao array ---------------------------
  // (data.product existe no payload, mas e igual nas tres ofertas — ver acima)
  const oferta = dados?.offer ?? null;

  // SO os identificadores da OFERTA. O product.id e igual nas tres ofertas da
  // escada: se entrasse aqui, a autocorrecao poderia grava-lo numa linha e
  // dali em diante toda compra de qualquer plano casaria com ela.
  const candidatos = [texto(oferta?.id), texto(oferta?.short_id)]
    .filter((x): x is string => x !== null);

  // SO o nome da OFERTA, pelo mesmo motivo: o product.name e igual nas tres, e
  // casar por ele daria o plano completo a quem pagou o basico.
  // `products.name` guarda o nome de cada oferta, identico ao da Cakto.
  const titulos = [texto(oferta?.name)].filter((x): x is string => x !== null);
  const titulo = titulos[0] ?? null;

  console.log(`[${reqId}] tx=${transactionId} | ids=${candidatos.length} | titulo="${titulo ?? "-"}"`);

  if (candidatos.length === 0 && !titulo) {
    console.warn(`[${reqId}] evento sem produto identificavel | tx=${transactionId}`);
    return json(200, {
      received: true, processed: true, purchase_id: purchaseId,
      entitlements_granted: 0, warning: "no_product_in_payload",
    });
  }

  // ---- Casamento em camadas --------------------------------------
  const { data: catalogo, error: prodErr } = await db
    .from("products")
    .select("id, cakto_product_id, name");

  if (prodErr) {
    console.error(`[${reqId}] falha ao consultar products: ${prodErr.code} ${prodErr.message}`);
    return json(500, { error: "product_lookup_failed" });
  }

  // deno-lint-ignore no-explicit-any
  const linhas = (catalogo ?? []) as any[];
  const porId = new Map<string, string>(
    linhas.map((p) => [p.cakto_product_id as string, p.id as string]),
  );
  const porTitulo = new Map<string, { id: string; idSalvo: string }>(
    linhas
      .filter((p) => typeof p.name === "string" && p.name.trim())
      .map((p) => [
        normalizeTitle(p.name as string),
        { id: p.id as string, idSalvo: p.cakto_product_id as string },
      ]),
  );

  let interno: string | undefined;
  let comoCasou = "nenhum";

  // Camada 1 — qualquer um dos identificadores conhecidos.
  for (const c of candidatos) {
    const achou = porId.get(c);
    if (achou) {
      interno = achou;
      comoCasou = "id";
      break;
    }
  }

  // Camada 2 — titulo identico, com AUTOCORRECAO do id salvo.
  let autocorrigido: { de: string; para: string } | null = null;
  if (!interno && titulos.length > 0) {
    const casa = titulos.map((t) => porTitulo.get(normalizeTitle(t))).find(Boolean);
    if (casa) {
      // Grava o identificador MAIS ESPECIFICO disponivel — o da oferta.
      const novoId = candidatos[0];
      if (novoId && novoId !== casa.idSalvo) {
        const { error: healErr } = await db
          .from("products")
          .update({ cakto_product_id: novoId })
          .eq("id", casa.id);

        if (healErr) {
          console.error(`[${reqId}] falha ao autocorrigir cakto_product_id | titulo="${titulo}" | ${healErr.code} ${healErr.message}`);
        } else {
          autocorrigido = { de: casa.idSalvo, para: novoId };
          console.warn(`[${reqId}] AUTOCORRIGIDO cakto_product_id | titulo="${titulo}" | antigo=${casa.idSalvo} | novo=${novoId}`);
        }
      }
      interno = casa.id;
      comoCasou = "titulo";
    }
  }

  // Camada 3 — desconhecido: NAO cadastra, NAO libera. So sinaliza.
  if (!interno) {
    console.warn(`[${reqId}] PRODUTO NAO MAPEADO | ids=${candidatos.join(",")} | titulo="${titulo ?? "-"}" | tx=${transactionId}`);
    return json(200, {
      received: true,
      processed: true,
      purchase_id: purchaseId,
      entitlements_granted: 0,
      has_unmapped_products: true,
      unmapped: { ids: candidatos, titulo },
    });
  }

  // ---- purchase_items + entitlements (idempotentes) --------------
  const { error: iErr } = await db
    .from("purchase_items")
    .upsert(
      { purchase_id: purchaseId, product_id: interno },
      { onConflict: "purchase_id,product_id" },
    );

  if (iErr) {
    console.error(`[${reqId}] falha no upsert de purchase_items: ${iErr.code} ${iErr.message}`);
    return json(500, { error: "purchase_items_upsert_failed" });
  }

  // UM entitlement, o que ele comprou de verdade. Combo NAO vira N linhas aqui:
  // a expansao e derivada na aplicacao (lib/data/biblioteca.ts).
  // Reativa (status='active', limpa revoked_at/reason) se o mesmo tx voltar a
  // ser aprovado depois de um reembolso estornado.
  const { error: eErr } = await db
    .from("entitlements")
    .upsert(
      { customer_id: customerId, product_id: interno, status: "active", revoked_at: null, revoke_reason: null },
      { onConflict: "customer_id,product_id" },
    );

  if (eErr) {
    console.error(`[${reqId}] falha no upsert de entitlements: ${eErr.code} ${eErr.message}`);
    return json(500, { error: "entitlements_upsert_failed" });
  }

  console.log(`[${reqId}] LIBERADO | tx=${transactionId} | casou_por=${comoCasou} | autocorrigido=${autocorrigido ? "sim" : "nao"} | ${Date.now() - t0}ms`);

  return json(200, {
    received: true,
    processed: true,
    request_id: reqId,
    purchase_id: purchaseId,
    customer_id: customerId,
    matched_by: comoCasou,
    id_healed: autocorrigido,
    entitlements_granted: 1,
  });
}

// ============================================================================
// REVOGAR — eventos refund e chargeback
// ============================================================================
// O evento de reembolso/chargeback traz o MESMO `data.id` da compra original.
// Achamos a compra por esse transaction_id, revogamos os entitlements do
// cliente para os produtos daquela compra, e marcamos a compra na auditoria.
//
// Se a compra NAO esta no banco, a aprovacao original nunca foi gravada
// (webhook de purchase_approved falhou na epoca) — entao nao ha acesso a tirar.
// Responde 200 com entitlements_revoked:0. Nao e erro.
//
// Idempotente: o UPDATE filtra por status='active', entao reprocessar o mesmo
// refund nao muda mais nada depois da primeira vez.
// deno-lint-ignore no-explicit-any
async function revogar(db: Db, reqId: string, t0: number, evento: string, dados: any): Promise<Response> {
  const transactionId = texto(dados?.id);
  if (!transactionId) {
    console.error(`[${reqId}] ${evento} sem data.id — impossivel localizar a compra`);
    return json(200, { received: true, processed: false, reason: "missing_transaction_id" });
  }

  const novoStatusCompra = evento === "chargeback" ? "chargedback" : "refunded";

  // 1. A compra.
  const { data: compra } = await db
    .from("purchases")
    .select("id, customer_id")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (!compra) {
    console.warn(`[${reqId}] ${evento} — compra inexistente no banco | tx=${transactionId}`);
    return json(200, { received: true, processed: true, entitlements_revoked: 0, reason: "purchase_not_found" });
  }
  const purchaseId = compra.id as string;
  const customerId = compra.customer_id as string;

  // 2. Os produtos daquela compra.
  const { data: itens } = await db
    .from("purchase_items")
    .select("product_id")
    .eq("purchase_id", purchaseId);
  const productIds = (itens ?? []).map((i) => i.product_id as string);

  // 3. Auditoria: a compra vira refunded/chargedback.
  await db.from("purchases").update({ status: novoStatusCompra }).eq("id", purchaseId);

  // 4. Revoga os entitlements ativos do cliente para esses produtos. Combo:
  //    o purchase_item guarda so o slug comprado (ex.: o VIP), e a expansao e
  //    derivada na aplicacao — revogar esse 1 entitlement ja tira o pacote todo.
  let revogados = 0;
  if (productIds.length > 0) {
    const { data: upd, error } = await db
      .from("entitlements")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: evento })
      .eq("customer_id", customerId)
      .in("product_id", productIds)
      .eq("status", "active")
      .select("id");
    if (error) {
      console.error(`[${reqId}] ${evento} — falha ao revogar entitlements: ${error.code} ${error.message}`);
      return json(500, { error: "revoke_failed" });
    }
    revogados = (upd ?? []).length;
  } else {
    console.warn(`[${reqId}] ${evento} — compra sem purchase_items | tx=${transactionId}`);
  }

  // 5. Encerra as sessoes abertas do cliente. Com o entitlement revogado a
  //    proxima requisicao dele ja cai em 404, mas derrubar a sessao e mais
  //    limpo do que esperar o cookie expirar. So se algo foi de fato revogado.
  if (revogados > 0) {
    await db.from("sessions").delete().eq("customer_id", customerId);
  }

  console.log(`[${reqId}] REVOGADO (${evento}) | tx=${transactionId} | entitlements=${revogados} | ${Date.now() - t0}ms`);

  return json(200, {
    received: true,
    processed: true,
    request_id: reqId,
    event: evento,
    purchase_id: purchaseId,
    entitlements_revoked: revogados,
  });
}
