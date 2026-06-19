// Pega EXATAMENTE o que o /details devolve pra um usuário num desafio.
import { PrismaClient } from "@prisma/client";
import { ChallengesService } from "../services/challenges.service";

const prisma = new PrismaClient();

async function main() {
  const userEmail = process.argv[2] || "gui@gmail.com";
  const challengeId = process.argv[3] || "94407f83-60fe-4be9-be1c-86cbe8d60054";

  const user = await prisma.user.findFirst({
    where: { email: { equals: userEmail.toLowerCase() } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("❌ user not found");
    process.exit(1);
  }

  const res = await ChallengesService.getDetails(challengeId, user.id);
  console.log(JSON.stringify(res?.challenge, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
