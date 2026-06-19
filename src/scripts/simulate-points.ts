// OKI 26/05/2026 — Simula uma foto verificada no desafio para validar
// a engine de pontuação SEM depender da IA. Insere uma mensagem
// challenge_chat marcada como verified, soma +1 ponto. Se cravar a
// meta semanal, soma +99 e registra weekly_goal_bonus em transactions.
//
// Uso:
//   npx ts-node src/scripts/simulate-points.ts <email> <challengeId> [count]
//
//   count = quantas verificações simular (default 1, máx 7).

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const challengeId = (process.argv[3] || "").trim();
  const count = Math.min(Math.max(parseInt(process.argv[4] || "1", 10) || 1, 1), 7);

  if (!email || !challengeId) {
    console.error("Uso: npx ts-node simulate-points.ts <email> <challengeId> [count]");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, title: true, frequency: true, createdById: true },
  });
  if (!challenge) {
    console.error(`❌ Challenge not found: ${challengeId}`);
    process.exit(1);
  }

  const isCreator = challenge.createdById === user.id;
  if (isCreator) {
    console.warn("⚠️  Você é o criador deste desafio. Pontuação faz mais sentido em participante puro.");
  }

  const participation = await prisma.challengeParticipant.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId } },
    select: { id: true, points: true },
  });
  if (!participation) {
    console.error("❌ Você não é participante desse desafio. Entre primeiro pelo app.");
    process.exit(1);
  }

  console.log(`👤 ${user.email}`);
  console.log(`🎯 ${challenge.title} — pontos atuais: ${participation.points}\n`);

  const match = (challenge.frequency || "").match(/\d+/);
  const weeklyGoal = match ? parseInt(match[0], 10) : null;
  console.log(`📅 Meta semanal: ${weeklyGoal ?? "(não definida — sem bônus semanal)"}`);
  console.log(`▶️  Simulando ${count} verificação(ões)...\n`);

  for (let i = 0; i < count; i++) {
    // Cria mensagem de chat já verificada num dia diferente (i dias atrás).
    const verifiedAt = new Date();
    verifiedAt.setDate(verifiedAt.getDate() - i);

    const messageId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO challenge_chat
         (id, challengeId, userId, message, created_at, imageUrl, verificationStatus, verifiedAt, verificationReason)
       VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, ?)`,
      messageId,
      challengeId,
      user.id,
      `[SIMULADO ${i + 1}/${count}] Foto verificada pela engine de teste`,
      verifiedAt,
      "https://placehold.co/600x400?text=simulado",
      verifiedAt,
      "Simulação automática via script",
    );

    // Verifica se já tem ponto desse dia (idempotência aproximada).
    const today = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c FROM challenge_chat
        WHERE userId = ? AND challengeId = ?
          AND verificationStatus = 'verified'
          AND DATE(verifiedAt) = DATE(?)`,
      user.id,
      challengeId,
      verifiedAt,
    )) as any[];
    const sameDayCount = Number(today?.[0]?.c || 0);

    if (sameDayCount === 1) {
      // Primeiro da data → +1 ponto
      await prisma.$executeRawUnsafe(
        `UPDATE challenge_participants SET points = points + 1
          WHERE userId = ? AND challengeId = ?`,
        user.id,
        challengeId,
      );
      console.log(`   [${i + 1}/${count}] ${verifiedAt.toISOString().slice(0, 10)} → +1 ponto`);

      // Bônus semanal?
      if (weeklyGoal && weeklyGoal > 0) {
        const wk = (await prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(DISTINCT DATE(verifiedAt)) AS d
             FROM challenge_chat
            WHERE userId = ? AND challengeId = ?
              AND verificationStatus = 'verified'
              AND YEARWEEK(verifiedAt, 1) = YEARWEEK(?, 1)`,
          user.id,
          challengeId,
          verifiedAt,
        )) as any[];
        const daysWeek = Number(wk?.[0]?.d || 0);

        const prev = (await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM transactions
            WHERE userId = ? AND challengeId = ?
              AND type = 'weekly_goal_bonus'
              AND YEARWEEK(created_at, 1) = YEARWEEK(?, 1)
            LIMIT 1`,
          user.id,
          challengeId,
          verifiedAt,
        )) as any[];

        if (daysWeek >= weeklyGoal && prev.length === 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE challenge_participants SET points = points + 99
              WHERE userId = ? AND challengeId = ?`,
            user.id,
            challengeId,
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO transactions (id, userId, challengeId, type, amount, status, description, created_at)
             VALUES (UUID(), ?, ?, 'weekly_goal_bonus', 0, 'completed',
                     '[SIMULADO] Bônus de 100 pts por bater a meta semanal', NOW())`,
            user.id,
            challengeId,
          );
          console.log(`       🏆 META SEMANAL CRAVADA → +99 pts bônus (total 100)`);
        }
      }
    }
  }

  const final = await prisma.challengeParticipant.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId } },
    select: { points: true },
  });
  console.log(`\n✅ Pontos finais: ${final?.points}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
