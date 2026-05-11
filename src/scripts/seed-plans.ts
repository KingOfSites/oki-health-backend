import "dotenv/config";
import prisma from "../config/database";

// PDF (Maio/2026 #9): A plataforma deve contemplar APENAS os planos abaixo.
// O plano "PRO" foi removido — todos os textos/seeds passam a referenciar
// somente Free, Premium e Afiliado.
async function main() {
  console.log("🌱 Iniciando seed de planos...");

  // FREE — acesso básico
  const freeExisting = await prisma.plan.findFirst({ where: { name: "Free" } });
  const freePlan = freeExisting
    ? await prisma.plan.update({
        where: { id: freeExisting.id },
        data: {
          price: 0,
          benefits: "Acesso básico às funcionalidades da plataforma",
        },
      })
    : await prisma.plan.create({
        data: {
          name: "Free",
          price: 0,
          benefits: "Acesso básico às funcionalidades da plataforma",
        },
      });
  console.log("✅ Plano Free criado/atualizado:", freePlan);

  // PREMIUM — 5% por desafio concluído + features adicionais + extrato
  const premiumExisting = await prisma.plan.findFirst({ where: { name: "Premium" } });
  const premiumBenefits =
    "5% de retorno sobre cada desafio concluído, " +
    "funcionalidades adicionais para criação de desafios, " +
    "ganhos creditados automaticamente na carteira, " +
    "extrato detalhado dos ganhos dentro da wallet";
  const premiumPlan = premiumExisting
    ? await prisma.plan.update({
        where: { id: premiumExisting.id },
        data: { price: 19.9, benefits: premiumBenefits },
      })
    : await prisma.plan.create({
        data: { name: "Premium", price: 19.9, benefits: premiumBenefits },
      });
  console.log("✅ Plano Premium criado/atualizado:", premiumPlan);

  // AFILIADO — 15% de comissão por conversão + painel de estatísticas
  const afiliadoExisting = await prisma.plan.findFirst({ where: { name: "Afiliado" } });
  const afiliadoBenefits =
    "15% de comissão por cada conversão realizada, " +
    "painel com estatísticas de desempenho (conversões, valores gerados)";
  const afiliadoPlan = afiliadoExisting
    ? await prisma.plan.update({
        where: { id: afiliadoExisting.id },
        data: { price: 49.9, benefits: afiliadoBenefits },
      })
    : await prisma.plan.create({
        data: { name: "Afiliado", price: 49.9, benefits: afiliadoBenefits },
      });
  console.log("✅ Plano Afiliado criado/atualizado:", afiliadoPlan);

  // PDF (Maio/2026 #9): remover quaisquer planos legados ("Pro Mensal",
  // "Pro Anual", "Premium Mensal", "Premium Anual").
  const legacyNames = ["Pro Mensal", "Pro Anual", "Premium Mensal", "Premium Anual"];
  for (const name of legacyNames) {
    const legacy = await prisma.plan.findFirst({ where: { name } });
    if (legacy) {
      // Move assinaturas ativas para Premium antes de remover o legado.
      await prisma.planSubscription.updateMany({
        where: { planId: legacy.id },
        data: { planId: premiumPlan.id },
      });
      await prisma.plan.delete({ where: { id: legacy.id } });
      console.log(`🗑️  Plano legado removido: ${name}`);
    }
  }

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
