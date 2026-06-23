import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
const router = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "tecmaquinas-dev-secret-change-in-prod";
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
const RegisterSchema = z.object({
    username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres").max(40),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
const LoginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Dados inválidos" });
        return;
    }
    const { username, password } = parsed.data;
    try {
        const existing = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.username, username.toLowerCase().trim()))
            .limit(1);
        if (existing.length > 0) {
            res.status(409).json({ error: "Nome de usuário já está em uso" });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const id = uid();
        const normalizedUsername = username.toLowerCase().trim();
        await db.insert(usersTable).values({ id, username: normalizedUsername, passwordHash });
        const token = jwt.sign({ userId: id, username: normalizedUsername }, JWT_SECRET, { expiresIn: "90d" });
        res.status(201).json({ token, user: { id, username: normalizedUsername } });
    }
    catch (err) {
        console.error("[auth/register]", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Credenciais inválidas" });
        return;
    }
    const { username, password } = parsed.data;
    try {
        const rows = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.username, username.toLowerCase().trim()))
            .limit(1);
        const user = rows[0];
        if (!user) {
            res.status(401).json({ error: "Usuário ou senha incorretos" });
            return;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Usuário ou senha incorretos" });
            return;
        }
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "90d" });
        res.json({ token, user: { id: user.id, username: user.username } });
    }
    catch (err) {
        console.error("[auth/login]", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
// ── POST /api/auth/verify-password ────────────────────────────────────────────
// Used by the mobile app to verify password before destructive operations
router.post("/verify-password", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Dados inválidos" });
        return;
    }
    const { username, password } = parsed.data;
    try {
        const rows = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.username, username.toLowerCase().trim()))
            .limit(1);
        const user = rows[0];
        if (!user) {
            res.status(401).json({ valid: false });
            return;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        res.json({ valid });
    }
    catch (err) {
        console.error("[auth/verify-password]", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
export default router;
//# sourceMappingURL=auth.js.map