import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import cakesRouter from "./cakes";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import promotionsRouter from "./promotions";
import homepageHeroRouter from "./homepage-hero";
import homepageGalleryRouter from "./homepage-gallery";
import paymentDetailsRouter from "./payment-details";
import reviewsRouter from "./reviews";
import blogRouter from "./blog";
import authRouter from "./auth";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(categoriesRouter);
router.use(cakesRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);
router.use(promotionsRouter);
router.use(homepageHeroRouter);
router.use(homepageGalleryRouter);
router.use(paymentDetailsRouter);
router.use(reviewsRouter);
router.use(blogRouter);
router.use(uploadsRouter);

export default router;
