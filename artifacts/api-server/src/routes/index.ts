import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import cakesRouter from "./cakes";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import promotionsRouter from "./promotions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(cakesRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);
router.use(promotionsRouter);

export default router;
