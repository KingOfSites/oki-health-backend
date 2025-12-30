-- ============================================
-- MIGRAÇÃO: Adicionar campos de verificação de IA
-- ============================================
-- Execute este script no seu banco de dados MySQL para adicionar
-- os campos de verificação de IA na tabela challenge_chat
-- ============================================

ALTER TABLE challenge_chat 
ADD COLUMN verificationStatus VARCHAR(20) DEFAULT 'pending' COMMENT 'Status da verificação: pending, verified, rejected',
ADD COLUMN verifiedAt DATETIME NULL COMMENT 'Data e hora da verificação',
ADD COLUMN verificationReason TEXT NULL COMMENT 'Motivo da verificação ou rejeição';

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_verification_status ON challenge_chat(verificationStatus);

-- ============================================
-- ✅ Migração concluída!
-- ============================================

