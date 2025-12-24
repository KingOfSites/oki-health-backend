-- ============================================
-- MIGRATION SEGURA: Adicionar campo isPro
-- Esta migration NÃO causa perda de dados
-- ============================================

-- 1. Adicionar o campo isPro (se ainda não existir)
-- Verifica se a coluna já existe antes de adicionar
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'isPro'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `isPro` BOOLEAN NOT NULL DEFAULT false',
    'SELECT "Coluna isPro já existe" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Atualizar usuários existentes que têm assinatura ativa
UPDATE `users` u
INNER JOIN `plan_subscriptions` ps ON u.id = ps.userId
SET u.isPro = TRUE
WHERE ps.active = TRUE 
  AND (ps.endDate IS NULL OR ps.endDate >= NOW())
  AND u.isPro = FALSE;

-- 3. Verificar resultado
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN isPro = TRUE THEN 1 ELSE 0 END) as pro_users,
    SUM(CASE WHEN isPro = FALSE THEN 1 ELSE 0 END) as free_users
FROM `users`;

