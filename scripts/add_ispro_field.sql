-- Script para adicionar o campo isPro na tabela users
-- Execute este script no seu banco de dados MySQL

ALTER TABLE users 
ADD COLUMN isPro BOOLEAN DEFAULT FALSE NOT NULL;

-- Atualizar usuários existentes que têm assinatura ativa
UPDATE users u
INNER JOIN plan_subscriptions ps ON u.id = ps.userId
SET u.isPro = TRUE
WHERE ps.active = TRUE 
  AND ps.endDate >= NOW();

