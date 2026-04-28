

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔧 Iniciando migration: isPublic e frequency...\n');   

    // Verificar se as colunas já existem
    const checkColumns = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'challenges'
        AND COLUMN_NAME IN ('isPublic', 'frequency')
    `;

    const existingColumns = checkColumns.map((col) => col.COLUMN_NAME);
    console.log('📋 Colunas existentes:', existingColumns);

    // Adicionar isPublic se não existir
    if (!existingColumns.includes('isPublic')) {
      console.log('➕ Adicionando coluna isPublic...');
      await prisma.$executeRaw`
        ALTER TABLE challenges 
        ADD COLUMN isPublic BOOLEAN DEFAULT TRUE 
        COMMENT 'Visibilidade do desafio: true = Público, false = Privado'
      `;
      console.log('✅ Coluna isPublic adicionada com sucesso!');
    } else {
      console.log('ℹ️  Coluna isPublic já existe, pulando...');
    }

    // Adicionar frequency se não existir
    if (!existingColumns.includes('frequency')) {
      console.log('➕ Adicionando coluna frequency...');
      await prisma.$executeRaw`
        ALTER TABLE challenges 
        ADD COLUMN frequency VARCHAR(20) DEFAULT 'daily' 
        COMMENT 'Frequência de registros: daily, weekly, custom'
      `;
      console.log('✅ Coluna frequency adicionada com sucesso!');
    } else {
      console.log('ℹ️  Coluna frequency já existe, pulando...');
    }

    // Atualizar desafios existentes
    console.log('\n🔄 Atualizando desafios existentes...');
    await prisma.$executeRaw`
      UPDATE challenges 
      SET isPublic = TRUE 
      WHERE isPublic IS NULL
    `;
    await prisma.$executeRaw`
      UPDATE challenges 
      SET frequency = 'daily' 
      WHERE frequency IS NULL
    `;
    console.log('✅ Desafios existentes atualizados!');

    // Verificar resultado
    console.log('\n🔍 Verificando resultado...');
    const result = await prisma.$queryRaw`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_DEFAULT,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'challenges'
        AND COLUMN_NAME IN ('isPublic', 'frequency')
    `;

    console.log('\n📊 Colunas criadas:');
    console.table(result);

    console.log('\n✅ Migration aplicada com sucesso!');
    console.log('\n⚠️  IMPORTANTE: Agora você precisa regenerar o Prisma Client:');
    console.log('   npx prisma generate');
    console.log('\n   E depois reiniciar o backend.');

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar migration
applyMigration()
  .then(() => {
    console.log('\n✨ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
