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

  // Plano Pro Mensal
  const proMonthlyPrice = 29.90;
  const proMonthlyBenefits =
    "Tudo do Premium + Comissão 5% por desafio + Prioridade no suporte";
  const existingProMonthly = await prisma.plan.findFirst({
    where: { name: "Pro Mensal" },
  });

  const proMonthlyPlan = existingProMonthly
    ? await prisma.plan.update({
        where: { id: existingProMonthly.id },
        data: { price: proMonthlyPrice, benefits: proMonthlyBenefits },
      })
    : await prisma.plan.create({
        data: {
          name: "Pro Mensal",
          price: proMonthlyPrice,
          benefits: proMonthlyBenefits,
        },
      });

  console.log("✅ Plano Pro Mensal criado/atualizado:", proMonthlyPlan);

  // Plano Pro Anual (15% de desconto)
  const proAnnualPrice = proMonthlyPrice * 12 * 0.85;
  const existingProAnnual = await prisma.plan.findFirst({
    where: { name: "Pro Anual" },
  });

  const proAnnualPlan = existingProAnnual
    ? await prisma.plan.update({
        where: { id: existingProAnnual.id },
        data: {
          price: proAnnualPrice,
          benefits: "Todos os benefícios do Pro Mensal + 15% de desconto",
        },
      })
    : await prisma.plan.create({
        data: {
          name: "Pro Anual",
          price: proAnnualPrice,
          benefits: "Todos os benefícios do Pro Mensal + 15% de desconto",
        },
      });

  console.log("✅ Plano Pro Anual criado/atualizado:", proAnnualPlan);

  // Plano Afiliado
  const afiliadoPrice = 49.90;
  const afiliadoBenefits =
    "Tudo do Pro + Programa de afiliados + Comissão extra por indicação";
  const existingAfiliado = await prisma.plan.findFirst({
    where: { name: "Afiliado" },
  });

  const afiliadoPlan = existingAfiliado
    ? await prisma.plan.update({
        where: { id: existingAfiliado.id },
        data: { price: afiliadoPrice, benefits: afiliadoBenefits },
      })
    : await prisma.plan.create({
        data: {
          name: "Afiliado",
          price: afiliadoPrice,
          benefits: afiliadoBenefits,
        },
      });

  console.log("✅ Plano Afiliado criado/atualizado:", afiliadoPlan);

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

