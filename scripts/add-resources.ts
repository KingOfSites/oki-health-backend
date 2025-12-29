import "dotenv/config";
import prisma from "../src/config/database";

async function addResources() {
  const email = "gui@gmail.com";
  
  // Valores a adicionar
  const moneyToAdd = 1000.0; // R$ 1000,00
  const xpToAdd = 5000; // 5000 XP
  
  try {
    console.log(`🔍 Buscando usuário: ${email}...`);
    
    // Buscar usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        balance: true,
        xp: true,
        level: true,
      },
    });

    if (!user) {
      console.error(`❌ Usuário com email ${email} não encontrado!`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name} (${user.email})`);
    console.log(`📊 Valores atuais:`);
    console.log(`   - Saldo: R$ ${user.balance?.toFixed(2) || "0.00"}`);
    console.log(`   - XP: ${user.xp || 0}`);
    console.log(`   - Nível: ${user.level || 1}`);
    console.log(`   - Oki Coins: ${Math.floor((user.xp || 0) / 10)}`);

    // Atualizar valores
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: moneyToAdd },
        total_earned: { increment: moneyToAdd },
        xp: { increment: xpToAdd },
      },
    });

    // Calcular novo nível baseado no XP (exemplo: 100 XP por nível)
    const newLevel = Math.floor((updatedUser.xp || 0) / 100) + 1;
    
    // Atualizar nível se necessário
    if (newLevel > updatedUser.level) {
      await prisma.user.update({
        where: { id: user.id },
        data: { level: newLevel },
      });
    }

    console.log(`\n✅ Recursos adicionados com sucesso!`);
    console.log(`📊 Novos valores:`);
    console.log(`   - Saldo: R$ ${updatedUser.balance?.toFixed(2) || "0.00"} (+R$ ${moneyToAdd.toFixed(2)})`);
    console.log(`   - XP: ${updatedUser.xp || 0} (+${xpToAdd})`);
    console.log(`   - Nível: ${newLevel > updatedUser.level ? newLevel : updatedUser.level}`);
    console.log(`   - Oki Coins: ${Math.floor((updatedUser.xp || 0) / 10)}`);

    // Criar transação de depósito para registrar
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: moneyToAdd,
        type: "deposit",
        status: "completed",
        description: `Adição manual de recursos - R$ ${moneyToAdd.toFixed(2)} e ${xpToAdd} XP`,
      },
    });

    console.log(`\n📝 Transação registrada no histórico!`);
    
  } catch (error) {
    console.error("❌ Erro ao adicionar recursos:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
addResources();

