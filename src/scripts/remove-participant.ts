import "dotenv/config";
import prisma from "../config/database";

async function main() {
  const userEmail = process.argv[2] || "jeferson@gmail.com";
  const challengeTitle = process.argv[3] || "Desafio Pernas de Titânio";

  console.log(`🔍 Buscando usuário: ${userEmail}`);
  console.log(`🔍 Buscando desafio: ${challengeTitle}`);

  // Buscar usuário pelo email
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    console.error(`❌ Usuário com email ${userEmail} não encontrado!`);
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.name} (ID: ${user.id})`);

  // Buscar desafio pelo título (MySQL não suporta mode: "insensitive", mas a busca é case-insensitive por padrão)
  const challenge = await prisma.challenge.findFirst({
    where: {
      title: {
        contains: challengeTitle,
      },
    },
  });

  if (!challenge) {
    console.error(`❌ Desafio "${challengeTitle}" não encontrado!`);
    process.exit(1);
  }

  console.log(`✅ Desafio encontrado: ${challenge.title} (ID: ${challenge.id})`);

  // Buscar participante
  const participant = await prisma.challengeParticipant.findUnique({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId: challenge.id,
      },
    },
  });

  if (!participant) {
    console.error(`❌ Usuário ${userEmail} não está participando do desafio "${challengeTitle}"!`);
    process.exit(1);
  }

  console.log(`✅ Participante encontrado (ID: ${participant.id})`);

  // Remover participante
  await prisma.challengeParticipant.delete({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId: challenge.id,
      },
    },
  });

  console.log(`✅ Participante removido com sucesso!`);
  console.log(`   Usuário: ${user.name} (${userEmail})`);
  console.log(`   Desafio: ${challenge.title}`);
}

main()
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
