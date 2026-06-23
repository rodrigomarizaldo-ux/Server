import { Router } from "express";
import { z } from "zod";
const router = Router();
const db = new Map();
/** Gera um ID único simples sem dependências externas */
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
// ────────────────────────────
// Schemas de validação (Zod)
// ────────────────────────────
const CreateMachineSchema = z.object({
    model: z.string().min(1, "Modelo é obrigatório"),
    brand: z.string().min(1, "Marca é obrigatória"),
    year: z.number().int().min(1900).max(2100),
    serialNumber: z.string().min(1, "Número de série é obrigatório"),
});
const UpdateMachineSchema = z.object({
    model: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    serialNumber: z.string().min(1).optional(),
});
// ──────────────────────────────────────────────────────
// GET /api/machines — Lista todas as máquinas cadastradas
// ──────────────────────────────────────────────────────
router.get("/", (_req, res) => {
    const machines = Array.from(db.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(machines);
});
// ────────────────────────────────────────────────────────────────
// GET /api/machines/:id — Retorna dados de uma máquina pelo ID
// ────────────────────────────────────────────────────────────────
router.get("/:id", (req, res) => {
    const machine = db.get(req.params.id);
    if (!machine) {
        res
            .status(404)
            .json({ error: "NOT_FOUND", message: "Máquina não encontrada" });
        return;
    }
    res.json(machine);
});
// ──────────────────────────────────────────────────────────────
// POST /api/machines — Cadastra uma nova máquina pesada
// ──────────────────────────────────────────────────────────────
router.post("/", (req, res) => {
    const parsed = CreateMachineSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
        });
        return;
    }
    const { model, brand, year, serialNumber } = parsed.data;
    // Garante unicidade do número de série
    const duplicate = Array.from(db.values()).find((m) => m.serialNumber === serialNumber);
    if (duplicate) {
        res.status(400).json({
            error: "DUPLICATE_SERIAL",
            message: "Já existe uma máquina com este número de série",
        });
        return;
    }
    const now = new Date().toISOString();
    const machine = {
        id: generateId(),
        model,
        brand,
        year,
        serialNumber,
        createdAt: now,
        updatedAt: now,
    };
    db.set(machine.id, machine);
    res.status(201).json(machine);
});
// ─────────────────────────────────────────────────────────────────────
// PUT /api/machines/:id — Atualiza os dados de uma máquina existente
// ─────────────────────────────────────────────────────────────────────
router.put("/:id", (req, res) => {
    const machine = db.get(req.params.id);
    if (!machine) {
        res
            .status(404)
            .json({ error: "NOT_FOUND", message: "Máquina não encontrada" });
        return;
    }
    const parsed = UpdateMachineSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
        });
        return;
    }
    const updates = parsed.data;
    // Verifica duplicidade de número de série ao atualizar
    if (updates.serialNumber && updates.serialNumber !== machine.serialNumber) {
        const duplicate = Array.from(db.values()).find((m) => m.serialNumber === updates.serialNumber && m.id !== machine.id);
        if (duplicate) {
            res.status(400).json({
                error: "DUPLICATE_SERIAL",
                message: "Já existe uma máquina com este número de série",
            });
            return;
        }
    }
    const updated = {
        ...machine,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    db.set(machine.id, updated);
    res.json(updated);
});
// ──────────────────────────────────────────────────────────
// DELETE /api/machines/:id — Remove o cadastro de uma máquina
// ──────────────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
    const machine = db.get(req.params.id);
    if (!machine) {
        res
            .status(404)
            .json({ error: "NOT_FOUND", message: "Máquina não encontrada" });
        return;
    }
    db.delete(req.params.id);
    res.json({ message: "Máquina excluída com sucesso" });
});
export default router;
//# sourceMappingURL=machines.js.map