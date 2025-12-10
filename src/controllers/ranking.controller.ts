import { Request, Response } from "express";
import prisma from "../config/database";

export const RankingController = {
  async getRanking(req: Request, res: Response) {
    try {
      const top10 = await prisma.user.findMany({
        orderBy: { xp: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          xp: true,
          avatar_url: true,
        }
      });

      return res.json({
        success: true,
        ranking: top10
      });

    } catch (err) {
      console.error("Erro carregando ranking:", err);
      return res.status(500).json({
        success: false,
        message: "Erro ao carregar ranking"
      });
    }
  }
};
