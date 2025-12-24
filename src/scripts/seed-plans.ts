import "dotenv/config";
import prisma from "../config/database";

async function main() {
  console.log("🌱 Iniciando seed de planos...");

  // Criar ou atualizar plano Premium Mensal
  const existingMonthly = await prisma.plan.findFirst({
    where: { name: "Premium Mensal" },
  });

  const monthlyPlan = existingMonthly
    ? await prisma.plan.update({
        where: { id: existingMonthly.id },
        data: {
          price: 19.90,
          benefits: "Grupos ilimitados, Desafios exclusivos, Estatísticas avançadas, Notificações inteligentes, Acesso antecipado",
        },
      })
    : await prisma.plan.create({
        data: {
          name: "Premium Mensal",
          price: 19.90,
          benefits: "Grupos ilimitados, Desafios exclusivos, Estatísticas avançadas, Notificações inteligentes, Acesso antecipado",
        },
      });

  console.log("✅ Plano Premium Mensal criado/atualizado:", monthlyPlan);

  // Criar ou atualizar plano Premium Anual (opcional - 12x o valor mensal com desconto)
  const annualPrice = 19.90 * 12 * 0.85; // 15% de desconto
  const existingAnnual = await prisma.plan.findFirst({
    where: { name: "Premium Anual" },
  });

  const annualPlan = existingAnnual
    ? await prisma.plan.update({
        where: { id: existingAnnual.id },
        data: {
          price: annualPrice,
          benefits: "Todos os benefícios do Premium Mensal + 15% de desconto",
        },
      })
    : await prisma.plan.create({
        data: {
          name: "Premium Anual",
          price: annualPrice,
          benefits: "Todos os benefícios do Premium Mensal + 15% de desconto",
        },
      });

  console.log("✅ Plano Premium Anual criado/atualizado:", annualPlan);

  console.log("🎉 Seed de planos concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao fazer seed de planos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

