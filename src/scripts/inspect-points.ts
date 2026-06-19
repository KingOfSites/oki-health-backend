// OKI 26/05/2026 — Diagnóstico da engine de pontuação.
// Lista cada participação do usuário, mostra:
//   - pontos atuais
//   - quantos dias com verificação aprovada nesta semana
//   - meta semanal configurada no desafio
//   - bônus já recebido nesta semana
//   - extrato das transações de pontuação
//
// Uso: npx ts-node src/scripts/inspect-points.ts <email>

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "gui@gmail.com").trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, xp: true, level: true },
  });
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`👤 ${user.email} — XP global: ${user.xp}, Level: ${user.level}\n`);

  const participations = await prisma.challengeParticipant.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      points: true,
      challenge: {
        select: { id: true, title: true, frequency: true, status: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  for (const p of participations) {
    const c = p.challenge;
    const match = (c.frequency || "").match(/\d+/);
    const weeklyGoal = match ? parseInt(match[0], 10) : null;

    const weekRow = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(DISTINCT DATE(verifiedAt)) AS days
         FROM challenge_chat
        WHERE userId = ?
          AND challengeId = ?
          AND verificationStatus = 'verified'
          AND YEARWEEK(verifiedAt, 1) = YEARWEEK(CURDATE(), 1)`,
      user.id,
      c.id,
    )) as any[];
    const daysThisWeek = Number(weekRow?.[0]?.days || 0);

    const weeklyBonus = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        challengeId: c.id,
        type: "weekly_goal_bonus",
      },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { created_at: true },
    });

    const shareBonuses = await prisma.transaction.count({
      where: {
        userId: user.id,
        challengeId: c.id,
        type: "social_share_bonus",
      },
    });

    console.log(`━━━ "${c.title}" (${c.id})`);
    console.log(`    status:                 ${c.status || "(null)"}`);
    console.log(`    📊 pontos atuais:        ${p.points}`);
    console.log(`    📅 meta semanal:         ${weeklyGoal ?? "(não definida)"}`);
    console.log(`    ✅ dias verificados na semana atual: ${daysThisWeek}`);
    console.log(`    🏆 bônus semanais ganhos: ${weeklyBonus.length}${weeklyBonus.length > 0 ? ` (último: ${weeklyBonus[0].created_at.toISOString()})` : ""}`);
    console.log(`    📣 bônus de compartilhamento: ${shareBonuses}`);
    console.log("");
  }

  if (participations.length === 0) {
    console.log("Nenhuma participação ativa.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
