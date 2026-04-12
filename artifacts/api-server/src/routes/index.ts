import { Router, type IRouter } from "express";
import healthRouter from "./health";
import timeEntriesRouter from "./timeEntries";
import workLocationRouter from "./workLocation";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(timeEntriesRouter);
router.use(workLocationRouter);
router.use(summaryRouter);

export default router;
