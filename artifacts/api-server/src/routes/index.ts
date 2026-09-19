import { Router, type IRouter } from "express";
import healthRouter from "./health";
import securityRouter from "./security";
import inferenceRouter from "./inference";
import groqRouter from "./groq";
import geminiRouter from "./gemini";
import cctvRouter from "./cctv";

const router: IRouter = Router();

router.use(healthRouter);
router.use(securityRouter);
router.use(inferenceRouter);
router.use(groqRouter);
router.use(geminiRouter);
router.use(cctvRouter);

export default router;
