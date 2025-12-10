import prisma from "../config/database";
import { Request, Response } from "express";

export const GamificationController = {
  async getUserGamification(req: any, res: Response) {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        achievements: true,
        challenges: true,
      },
    });

    if (!user) {
      return res.json({
        success: true,
        data: {
          totalPoints: 0,
          recentPoints: 0,
          badges: [],
          challengesCompleted: 0,
          challengesWon: 0,
          currentStreak: 0,
          totalWeightLost: 0,
          recentActivities: [],
        }
      });
    }

    return res.json({
      success: true,
      data: {
        totalPoints: user.xp,
        recentPoints: 0,
        badges: user.achievements.map(a => a.title),
        challengesCompleted: user.challenges.length,
        challengesWon: user.challenges.filter(c => c.progress >= 100).length,
        currentStreak: 0,
        totalWeightLost: 0,
        recentActivities: [],
      }
    });
  }
};
