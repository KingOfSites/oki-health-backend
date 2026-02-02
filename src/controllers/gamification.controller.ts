import prisma from "../config/database";
import { Response } from "express";

// Definição de badges (conquistas) – critérios e descrição
export const BADGES = [
  { id: "guerreiro", name: "Guerreiro", criteria: "Completou 70% do desafio", icon: "shield" },
  { id: "persistente", name: "Persistente", criteria: "Não desistiu", icon: "flame" },
  { id: "melhoria", name: "Melhoria", criteria: "Perdeu 2kg+", icon: "trending-down" },
  { id: "determinado", name: "Determinado", criteria: "100+ pontos totais", icon: "star" },
  { id: "veterano", name: "Veterano", criteria: "500+ pontos totais", icon: "medal" },
  { id: "lenda", name: "Lenda", criteria: "1.000+ pontos totais", icon: "trophy" },
  { id: "primeiro_passo", name: "Primeiro Passo", criteria: "Entrou no primeiro desafio", icon: "walk" },
  { id: "focado", name: "Focado", criteria: "3+ verificações aprovadas em um desafio", icon: "checkmark-done" },
  { id: "campeao", name: "Campeão", criteria: "Ficou em 1º lugar em um desafio", icon: "podium" },
  { id: "top3", name: "Top 3", criteria: "Ficou entre os 3 primeiros", icon: "medal" },
  { id: "semana_perfeita", name: "Semana Perfeita", criteria: "7 dias seguidos com verificação", icon: "calendar" },
  { id: "iniciante", name: "Iniciante", criteria: "Completou primeiro desafio", icon: "flag" },
  { id: "superador", name: "Superador", criteria: "Bateu sua meta de peso", icon: "fitness" },
  { id: "equipe", name: "Em Equipe", criteria: "Participou de 3+ desafios", icon: "people" },
  { id: "dedicado", name: "Dedicado", criteria: "50+ pontos em um único desafio", icon: "flash" },
  { id: "estreante", name: "Estreante", criteria: "Primeira foto verificada", icon: "camera" },
  { id: "pesagem_ok", name: "Pesagem OK", criteria: "Primeiro vídeo de pesagem aprovado", icon: "videocam" },
  { id: "madrugador", name: "Madrugador", criteria: "Verificação antes das 7h", icon: "sunny" },
  { id: "noturno", name: "Noturno", criteria: "Verificação após 22h", icon: "moon" },
  { id: "variedade", name: "Variedade", criteria: "Participou de 5+ categorias", icon: "apps" },
  { id: "influencer", name: "Influencer", criteria: "Convidou 3+ amigos", icon: "share-social" },
  { id: "pro", name: "PRO", criteria: "Assinante PRO", icon: "diamond" },
  { id: "afiliado", name: "Afiliado", criteria: "Programa de afiliados ativo", icon: "card" },
  { id: "lendario", name: "Lendário", criteria: "2.000+ pontos totais", icon: "sparkles" },
] as const;

export const GamificationController = {
  async getUserGamification(req: any, res: Response) {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        xp: true,
        achievements: {
          select: {
            title: true,
          },
        },
        challenges: {
          select: {
            progress: true,
          },
        },
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
  },

  async getAchievements(req: any, res: Response) {
    const userId = req.userId;
    const achievements = await prisma.achievement.findMany({
      where: { userId },
      orderBy: { achievedAt: "desc" },
    });
    return res.json({ success: true, data: achievements });
  },

  async getBadges(req: any, res: Response) {
    const userId = req.userId;

    const [user, participants, achievements] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, xp: true, peso: true, isPro: true },
      }),
      prisma.challengeParticipant.findMany({
        where: { userId },
        select: { progress: true, points: true, challengeId: true },
      }),
      prisma.achievement.findMany({
        where: { userId },
        select: { title: true },
      }),
    ]);

    const totalPoints = participants.reduce((s, p) => s + (p.points || 0), 0) + (user?.xp || 0);
    const has70Percent = participants.some(p => (p.progress || 0) >= 70);
    const hasCompleted = participants.some(p => (p.progress || 0) >= 100);
    const hasParticipated = participants.length >= 1;
    const hasNotQuit = participants.some(p => (p.progress || 0) > 0);
    const challengeCount = participants.length;
    const achievementTitles = new Set((achievements || []).map(a => a.title));

    const unlocked = new Set<string>();

    if (has70Percent) unlocked.add("guerreiro");
    if (hasNotQuit && hasParticipated) unlocked.add("persistente");
    if (totalPoints >= 100) unlocked.add("determinado");
    if (totalPoints >= 500) unlocked.add("veterano");
    if (totalPoints >= 1000) unlocked.add("lenda");
    if (totalPoints >= 2000) unlocked.add("lendario");
    if (hasParticipated) unlocked.add("primeiro_passo");
    if (hasCompleted) unlocked.add("iniciante");
    if (challengeCount >= 3) unlocked.add("equipe");
    if (user?.isPro) unlocked.add("pro");

    BADGES.forEach(b => {
      if (achievementTitles.has(b.name)) unlocked.add(b.id);
    });

    const list = BADGES.map(badge => ({
      ...badge,
      unlocked: unlocked.has(badge.id),
    }));

    return res.json({ success: true, data: list });
  },
};
