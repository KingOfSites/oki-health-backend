// Diagnóstico: mostra desafios criados e participações de um usuário.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "gui@gmail.com").trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    console.error(`❌ Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  console.log(`👤 ${user.email} — id ${user.id}`);
  console.log("");

  // Desafios criados
  const created = await prisma.challenge.findMany({
    where: { createdById: user.id },
    select: { id: true, title: true, status: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
  console.log(`📦 Desafios criados por ele: ${created.length}`);
  created.forEach((c) => {
    console.log(`   - [${c.status || "active"}] "${c.title}" — ${c.id}`);
  });

  console.log("");

  // Participações
  const participations = await prisma.challengeParticipant.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      challengeId: true,
      joinedAt: true,
      points: true,
      challenge: { select: { title: true, createdById: true } },
    },
    orderBy: { joinedAt: "desc" },
  });
  console.log(`🎯 Participações ativas: ${participations.length}`);
  participations.forEach((p) => {
    const isOwn = p.challenge.createdById === user.id ? " ⚠️ (PRÓPRIO DESAFIO)" : "";
    console.log(
      `   - "${p.challenge.title}" (joined ${p.joinedAt.toISOString()})${isOwn}`,
    );
    console.log(`       challengeId: ${p.challengeId}, points: ${p.points}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
