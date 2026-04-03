import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storesRouter from "./stores";
import accountsRouter from "./accounts";
import serviceTypesRouter from "./service-types";
import ordersRouter from "./orders";
import clientsRouter from "./clients";
import productsRouter from "./products";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/stores", storesRouter);
router.use("/accounts", accountsRouter);
router.use("/service-types", serviceTypesRouter);
router.use("/orders", ordersRouter);
router.use("/clients", clientsRouter);
router.use("/products", productsRouter);

export default router;
