import "dotenv/config";
import prisma from "../config/database";

async function main() {
  const email = process.env.SEED_USER_EMAIL || "seed@example.com";
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(
      `Usuário com email ${email} não encontrado. Defina SEED_USER_EMAIL ou crie o usuário primeiro.`
    );
  }

  const now = new Date();

  const items = [
    {
      title: "Desafio de Caminhada Diária",
      description: "Caminhe pelo menos 8000 passos todos os dias por 30 dias",
      category: "Fitness",
      startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
      reward: 675,
      location: "Parque Barigui, Curitiba",
      status: "active",
      coverUrl: null as string | null,
      entryPriceCents: 1000,
    },
    {
      title: "Desafio de Meditação",
      description: "Medite 10 minutos todos os dias por 21 dias",
      category: "Bem-estar",
      startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
      reward: 0,
      location: "Online",
      status: "active",
      coverUrl: null,
      entryPriceCents: 0,
    },
    {
      title: "Desafio de Corrida 5K",
      description: "Faça uma corrida de 5km por semana durante 1 mês",
      category: "Fitness",
      startDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      reward: 250,
      location: "Praça Central",
      status: "completed",
      coverUrl: null,
      entryPriceCents: 2500,
    },
  ];

  for (const item of items) {
    const challenge = await prisma.challenge.create({
      data: { ...item, createdById: user.id },
    });

    await prisma.challengeParticipant.create({
      data: { userId: user.id, challengeId: challenge.id, progress: 0 },
    });
  }

  console.log("Seed de desafios concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
