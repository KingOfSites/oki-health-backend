import "dotenv/config";

import prisma from "../config/database";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : undefined;
}

async function main() {
  const email = getArg("email");
  const userId = getArg("userId");
  const balanceRaw = getArg("balance") ?? "100000";

  const balance = Number(balanceRaw);
  if (!Number.isFinite(balance)) {
    throw new Error(`balance inválido: "${balanceRaw}"`);
  }

  if (!email && !userId) {
    throw new Error('Passe "--email=..." ou "--userId=..."');
  }

  const where = userId ? { id: userId } : { email: String(email) };

  const user = await prisma.user.findUnique({
    where: where as any,
    select: { id: true, email: true, name: true, balance: true },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { balance },
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, balance: true },
  });

  console.log("✅ Carteira atualizada:", updated);
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

