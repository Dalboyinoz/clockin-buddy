import { Router, type IRouter } from "express";
import healthRouter from "./health";
import locationEventsRouter from "./locationEvents";
import workLocationRouter from "./workLocation";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(locationEventsRouter);
router.use(workLocationRouter);
router.use(summaryRouter);

export default router;
