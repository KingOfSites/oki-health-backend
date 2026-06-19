// OKI 26/05/2026 — utilitário para marcar um usuário como Premium e
// confirmar visualmente o badge no app. Uso:
//   npx ts-node src/scripts/set-premium.ts <email>
// (se omitir o email, usa gui@gmail.com por padrão).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "gui@gmail.com").trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, name: true, isPro: true },
  });

  if (!user) {
    console.error(`❌ Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  if (user.isPro) {
    console.log(`ℹ️  ${email} já era Premium. Nada a alterar.`);
    console.log({ id: user.id, isPro: true });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isPro: true } as any,
    select: { id: true, email: true, name: true, isPro: true },
  });

  console.log("✅ Usuário marcado como Premium:");
  console.log(updated);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao marcar Premium:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
