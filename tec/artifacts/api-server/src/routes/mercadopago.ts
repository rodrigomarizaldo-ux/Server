import { Router, type IRouter, type Request, type Response } from "express";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_SECRET = process.env["JWT_SECRET"] ?? "tecmaquinas-dev-secret-change-in-prod";
const MP_BASE = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = process.env["MP_ACCESS_TOKEN"];
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  return token;
}

// ── Middleware: extract userId from JWT ───────────────────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string; username: string };
    (req as any).userId = payload.userId;
    (req as any).username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ── GET /api/mp/public-key ────────────────────────────────────────────────────
// Returns the Mercado Pago public key for card tokenization on the client
router.get("/public-key", async (_req: Request, res: Response) => {
  const publicKey = process.env["MP_PUBLIC_KEY"];
  if (!publicKey) {
    res.status(500).json({ error: "MP_PUBLIC_KEY não configurada no servidor" });
    return;
  }
  res.json({ publicKey });
});

// ── POST /api/mp/create-payment ───────────────────────────────────────────────
// Receives a card_token_id from the client and creates a payment of R$70 (monthly subscription per machine)
router.post("/create-payment", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const username = (req as any).username as string;
  const { cardTokenId, installments = 1, paymentMethodId, cpf } = req.body as {
    cardTokenId: string;
    installments?: number;
    paymentMethodId?: string;
    cpf?: string;
  };

  if (!cardTokenId) {
    res.status(400).json({ error: "cardTokenId é obrigatório" });
    return;
  }

  try {
    const payload = {
      transaction_amount: 75,
      token: cardTokenId,
      description: "Assinatura mensal de máquina pesada - Tecmaquinas",
      installments,
      payment_method_id: paymentMethodId,
      payer: {
        email: `${username}@tecmaquinas.app`,
        identification: { type: "CPF", number: cpf ?? "00000000000" },
      },
      metadata: { userId, username },
    };

    const mpRes = await fetch(`${MP_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `tecmaquinas-${userId}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await mpRes.json() as any;

    if (!mpRes.ok) {
      console.error("[mp/create-payment] MP error:", JSON.stringify(data));
      const msg = data?.message ?? data?.cause?.[0]?.description ?? "Pagamento recusado";
      res.status(422).json({ error: msg });
      return;
    }

    if (data.status === "approved") {
      res.json({ status: "approved", paymentId: data.id });
    } else {
      const detail = data.status_detail ?? data.status ?? "unknown";
      res.status(422).json({
        error: mpStatusMessage(detail),
        status: data.status,
        statusDetail: detail,
      });
    }
  } catch (err: any) {
    console.error("[mp/create-payment]", err);
    res.status(500).json({ error: "Erro interno ao processar pagamento" });
  }
});

function mpStatusMessage(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Número do cartão inválido",
    cc_rejected_bad_filled_date: "Data de validade inválida",
    cc_rejected_bad_filled_other: "Dados do cartão inválidos",
    cc_rejected_bad_filled_security_code: "CVV inválido",
    cc_rejected_blacklist: "Cartão não permitido",
    cc_rejected_call_for_authorize: "Autorize o pagamento com seu banco",
    cc_rejected_card_disabled: "Cartão desativado. Contate seu banco",
    cc_rejected_card_error: "Não foi possível processar o cartão",
    cc_rejected_duplicated_payment: "Pagamento duplicado",
    cc_rejected_high_risk: "Pagamento recusado por segurança",
    cc_rejected_insufficient_amount: "Saldo insuficiente",
    cc_rejected_invalid_installments: "Número de parcelas inválido",
    cc_rejected_max_attempts: "Limite de tentativas excedido",
    cc_rejected_other_reason: "Pagamento recusado pelo cartão",
  };
  return map[detail] ?? "Pagamento não aprovado. Verifique os dados e tente novamente.";
}

export default router;
