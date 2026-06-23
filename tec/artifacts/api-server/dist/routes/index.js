import { Router } from "express";
import healthRouter from "./health.js";
import machinesRouter from "./machines.js";
import authRouter from "./auth.js";
import mercadopagoRouter from "./mercadopago.js";
import syncRouter from "./sync.js";
const router = Router();
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/machines", machinesRouter);
router.use("/mp", mercadopagoRouter);
router.use("/sync", syncRouter);
export default router;
//# sourceMappingURL=index.js.map