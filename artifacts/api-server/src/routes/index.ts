import { Router, type IRouter } from "express";
import healthRouter from "./health";
import phishguardRouter from "./phishguard";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "operational",
    message: "PhishGuard API Entry Point. Use endpoints like /api/healthz or /api/analyze.",
  });
});

router.use(healthRouter);
router.use(phishguardRouter);

export default router;
