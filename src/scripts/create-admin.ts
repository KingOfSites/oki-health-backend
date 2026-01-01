import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@oki.com";
  const plainPassword = "admin123";

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      isAdmin: true,
      name: "Administrador",
    },
    create: {
      email,
      password: passwordHash,
      name: "Administrador",
      age: 30,
      city: "Admin City",
      isAdmin: true,

      // valores default / obrigatórios
      xp: 0,
      level: 1,
      balance: 0,
      total_earned: 0,
      total_withdrawn: 0,

      darkMode: true,
      notifications: true,
    },
  });

  console.log("✅ Admin criado/atualizado com sucesso:");
  console.log({
    id: admin.id,
    email: admin.email,
    isAdmin: admin.isAdmin,
  });
}

main()
  .catch((e) => {
    console.error("❌ Erro ao criar admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
