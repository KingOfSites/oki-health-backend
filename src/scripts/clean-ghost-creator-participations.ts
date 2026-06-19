// OKI 26/05/2026 — Limpa "participações fantasmas" do criador em seus
// próprios desafios. Útil pra apagar registros que o bug antigo
// (auto-add em challengePayment) deixou no banco.
//
// Uso:
//   npx ts-node src/scripts/clean-ghost-creator-participations.ts <email>
//
// Sem email = limpa pra TODOS os usuários (cuidado).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const emailArg = (process.argv[2] || "").trim().toLowerCase();

  let userIds: string[] = [];

  if (emailArg) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailArg } },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      console.error(`❌ Usuário não encontrado: ${emailArg}`);
      process.exit(1);
    }
    userIds = [user.id];
    console.log(`🎯 Limpando participações de ${user.email} (${user.id})`);
  } else {
    console.log("🌐 Limpando participações de TODOS os criadores em seus próprios desafios.");
  }

  // Busca participações onde o usuário é também criador do desafio.
  const ghosts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT cp.id, cp.userId, cp.challengeId, c.title
       FROM challenge_participants cp
       JOIN challenges c ON c.id = cp.challengeId
      WHERE cp.userId = c.createdById
        ${userIds.length ? `AND cp.userId IN (${userIds.map((u) => `'${u}'`).join(",")})` : ""}`,
  );

  if (ghosts.length === 0) {
    console.log("✨ Nada a limpar — nenhuma participação fantasma encontrada.");
    return;
  }

  console.log(`🧹 Encontradas ${ghosts.length} participações fantasmas:`);
  for (const g of ghosts) {
    console.log(`   - ${g.userId} em "${g.title}" (${g.challengeId})`);
  }

  const result = await prisma.challengeParticipant.deleteMany({
    where: {
      id: { in: ghosts.map((g) => g.id) },
    },
  });

  console.log(`✅ ${result.count} participações fantasmas removidas.`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
