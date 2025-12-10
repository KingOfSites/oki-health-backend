import { Router } from "express";
import { RankingController } from "../controllers/ranking.controller";

const router = Router();

router.get("/", RankingController.getRanking);

export default router;
