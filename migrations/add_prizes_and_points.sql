-- ============================================
-- MIGRAÇÃO: Adicionar campos de prêmios e pontos
-- ============================================
-- Execute este script no seu banco de dados MySQL para adicionar
-- os campos de prêmios no desafio e pontos nos participantes
-- ============================================

-- Adicionar campos de prêmios na tabela challenges
ALTER TABLE challenges 
ADD COLUMN firstPlacePrizeCents INT DEFAULT 0 COMMENT 'Prêmio do 1º lugar em centavos',
ADD COLUMN secondPlacePrizeCents INT DEFAULT 0 COMMENT 'Prêmio do 2º lugar em centavos',
ADD COLUMN thirdPlacePrizeCents INT DEFAULT 0 COMMENT 'Prêmio do 3º lugar em centavos';

-- Adicionar campo de pontos na tabela challenge_participants
ALTER TABLE challenge_participants 
ADD COLUMN points INT DEFAULT 0 COMMENT 'Pontos baseados em verificações de IA';

-- Criar índice para melhor performance nas consultas de ranking
CREATE INDEX idx_challenge_points ON challenge_participants(challengeId, points DESC);

-- ============================================
-- ✅ Migração concluída!
-- ============================================


