import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

const JWT_SECRET = process.env["JWT_SECRET"] ?? "tecmaquinas-dev-secret-change-in-prod";

// ── Middleware: extract userId from JWT ───────────────────────────────────────
import jwt from "jsonwebtoken";

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

// ── GET /api/stripe/publishable-key ──────────────────────────────────────────
router.get("/publishable-key", async (_req: Request, res: Response) => {
  try {
    const { getStripePublishableKey } = await import("../stripeClient");
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err) {
    console.error("[stripe/publishable-key]", err);
    res.status(500).json({ error: "Erro ao obter chave Stripe" });
  }
});

// ── POST /api/stripe/create-payment-intent ────────────────────────────────────
// Creates a PaymentIntent for R$70 (monthly subscription per machine)
router.post("/create-payment-intent", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const username = (req as any).username as string;

  try {
    const stripe = await getUncachableStripeClient();

    // Get or create Stripe customer
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: username,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, userId));
    }

    // R$70,00 = 7000 centavos (assinatura mensal por máquina)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 7000,
      currency: "brl",
      customer: customerId,
      description: "Assinatura mensal de máquina pesada - Tecmaquinas",
      metadata: { userId, username },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("[stripe/create-payment-intent]", err);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ── GET /api/stripe/subscription-status ──────────────────────────────────────
// Returns how many machines the user has active paid registrations for
router.get("/subscription-status", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  try {
    // Count succeeded payment intents for this user
    const stripe = await getUncachableStripeClient();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user?.stripeCustomerId) {
      res.json({ paidCount: 0 });
      return;
    }

    const intents = await stripe.paymentIntents.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    const paidCount = intents.data.filter(pi => pi.status === "succeeded").length;
    res.json({ paidCount });
  } catch (err) {
    console.error("[stripe/subscription-status]", err);
    res.status(500).json({ error: "Erro ao verificar pagamentos" });
  }
});

export default router;
