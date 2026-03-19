-- Adiciona campo nickname ao usuário
ALTER TABLE users ADD COLUMN nickname VARCHAR(50) NULL;

-- Adiciona campo durationWeeks ao desafio
ALTER TABLE challenges ADD COLUMN durationWeeks INT NULL;

-- Atualiza commissionRate padrão para 15% em novos registros
-- (o default está no schema Prisma; registros existentes mantêm o valor atual)
ALTER TABLE referrals MODIFY COLUMN commissionRate DOUBLE NOT NULL DEFAULT 0.15;
