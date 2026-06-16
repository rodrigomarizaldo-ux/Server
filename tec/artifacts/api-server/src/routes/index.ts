import { Router, type IRouter } from "express";
import healthRouter from "./health";
import machinesRouter from "./machines";
import authRouter from "./auth";
import mercadopagoRouter from "./mercadopago";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/machines", machinesRouter);
router.use("/mp", mercadopagoRouter);
router.use("/sync", syncRouter);

export default router;
