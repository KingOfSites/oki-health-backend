-- ============================================
-- MIGRAÇÃO: Corrigir tamanho da coluna description
-- ============================================
-- Execute este script no seu banco de dados MySQL para alterar
-- a coluna description da tabela challenges para TEXT
-- ============================================

ALTER TABLE challenges 
MODIFY COLUMN description TEXT NOT NULL;

-- ============================================
-- ✅ Migração concluída!
-- ============================================
-- A coluna description agora aceita textos longos (até 65.535 caracteres)
-- ============================================

