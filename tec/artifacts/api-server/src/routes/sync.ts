import { Router, type IRouter, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { cloudMachinesTable, cloudOperatorsTable, cloudRentalsTable } from "@workspace/db/schema";
import { eq, notInArray, and } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "tecmaquinas-dev-secret-change-in-prod";

function requireAuth(req: Request, res: Response, next: Function) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ── POST /api/sync/push ───────────────────────────────────────────────────────
// Receives the full local snapshot and upserts to the cloud DB.
// Any record missing from the snapshot is deleted (client is the source of truth).
router.post("/push", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const {
    machines = [],
    operators = [],
    rentals = [],
  } = req.body as {
    machines: any[];
    operators: any[];
    rentals: any[];
  };

  try {
    // ── Machines ──────────────────────────────────────────────────────────────
    if (machines.length > 0) {
      for (const m of machines) {
        await db.insert(cloudMachinesTable).values({
          id: m.id, userId,
          model: m.model, brand: m.brand,
          year: m.year, serialNumber: m.serialNumber,
          fleetNumber: m.fleetNumber ?? "",
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
        }).onConflictDoUpdate({
          target: cloudMachinesTable.id,
          set: {
            model: m.model, brand: m.brand,
            year: m.year, serialNumber: m.serialNumber,
            fleetNumber: m.fleetNumber ?? "",
            updatedAt: new Date(m.updatedAt),
          },
        });
      }
      // Delete machines not in snapshot
      const machineIds = machines.map((m) => m.id);
      await db.delete(cloudMachinesTable).where(
        and(
          eq(cloudMachinesTable.userId, userId),
          notInArray(cloudMachinesTable.id, machineIds),
        ),
      );
    } else {
      // No machines locally → delete all cloud machines for this user
      await db.delete(cloudMachinesTable).where(eq(cloudMachinesTable.userId, userId));
    }

    // ── Operators ─────────────────────────────────────────────────────────────
    if (operators.length > 0) {
      for (const o of operators) {
        await db.insert(cloudOperatorsTable).values({
          id: o.id, userId,
          name: o.name, birthDate: o.birthDate,
          payment: String(o.payment),
          weeklyHours: String(o.weeklyHours),
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
        }).onConflictDoUpdate({
          target: cloudOperatorsTable.id,
          set: {
            name: o.name, birthDate: o.birthDate,
            payment: String(o.payment),
            weeklyHours: String(o.weeklyHours),
            updatedAt: new Date(o.updatedAt),
          },
        });
      }
      const operatorIds = operators.map((o) => o.id);
      await db.delete(cloudOperatorsTable).where(
        and(
          eq(cloudOperatorsTable.userId, userId),
          notInArray(cloudOperatorsTable.id, operatorIds),
        ),
      );
    } else {
      await db.delete(cloudOperatorsTable).where(eq(cloudOperatorsTable.userId, userId));
    }

    // ── Rentals ───────────────────────────────────────────────────────────────
    if (rentals.length > 0) {
      for (const r of rentals) {
        await db.insert(cloudRentalsTable).values({
          id: r.id, userId,
          clientName: r.clientName,
          description: r.description ?? null,
          startDate: r.startDate,
          endDate: r.endDate,
          machineRevenues: r.machineRevenues ?? [],
          createdAt: new Date(r.createdAt),
        }).onConflictDoUpdate({
          target: cloudRentalsTable.id,
          set: {
            clientName: r.clientName,
            description: r.description ?? null,
            startDate: r.startDate,
            endDate: r.endDate,
            machineRevenues: r.machineRevenues ?? [],
          },
        });
      }
      const rentalIds = rentals.map((r) => r.id);
      await db.delete(cloudRentalsTable).where(
        and(
          eq(cloudRentalsTable.userId, userId),
          notInArray(cloudRentalsTable.id, rentalIds),
        ),
      );
    } else {
      await db.delete(cloudRentalsTable).where(eq(cloudRentalsTable.userId, userId));
    }

    res.json({ synced: true, at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[sync/push]", err);
    res.status(500).json({ error: "Erro ao sincronizar dados" });
  }
});

export default router;
