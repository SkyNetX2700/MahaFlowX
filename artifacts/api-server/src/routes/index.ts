import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securityRouter from "./security";
import inferenceRouter from "./inference";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securityRouter);
router.use(inferenceRouter);
router.use(geminiRouter);

export default router;
