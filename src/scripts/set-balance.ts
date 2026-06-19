// Utilitário rápido: define o saldo de um usuário em reais.
// Uso: npx ts-node src/scripts/set-balance.ts <email> <valor>
// Default: gui@gmail.com / 3 reais

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "gui@gmail.com").trim().toLowerCase();
  const amount = parseFloat(process.argv[3] || "3");

  if (!Number.isFinite(amount) || amount < 0) {
    console.error("❌ Valor inválido. Use um número >= 0.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, name: true, balance: true },
  });

  if (!user) {
    console.error(`❌ Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { balance: amount },
    select: { id: true, email: true, name: true, balance: true },
  });

  console.log(`✅ Saldo de ${updated.email} ajustado: R$ ${user.balance.toFixed(2)} → R$ ${updated.balance.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
