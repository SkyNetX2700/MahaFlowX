import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securityRouter from "./security";
import inferenceRouter from "./inference";
import groqRouter from "./groq";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securityRouter);
router.use(inferenceRouter);
router.use(groqRouter);

export default router;
