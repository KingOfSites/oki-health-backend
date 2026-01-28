-- ============================================
-- MIGRATION: Adicionar campos isPublic e frequency
-- ============================================
-- Execute este SQL diretamente no seu banco de dados MySQL
-- 
-- Opções para executar:
-- 1. MySQL Workbench
-- 2. phpMyAdmin
-- 3. Linha de comando: mysql -h 217.196.51.2 -P 3310 -u root -p oki_health < EXECUTAR_MIGRATION.sql
-- 4. Qualquer cliente MySQL
-- ============================================

-- Verificar se as colunas já existem antes de adicionar
SET @col_exists_isPublic = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'challenges'
    AND COLUMN_NAME = 'isPublic'
);

SET @col_exists_frequency = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'challenges'
    AND COLUMN_NAME = 'frequency'
);

-- Adicionar coluna isPublic se não existir
SET @sql_isPublic = IF(@col_exists_isPublic = 0,
  'ALTER TABLE `challenges` ADD COLUMN `isPublic` BOOLEAN DEFAULT TRUE COMMENT ''Visibilidade do desafio: true = Público, false = Privado''',
  'SELECT ''Coluna isPublic já existe'' AS message'
);

PREPARE stmt_isPublic FROM @sql_isPublic;
EXECUTE stmt_isPublic;
DEALLOCATE PREPARE stmt_isPublic;

-- Adicionar coluna frequency se não existir
SET @sql_frequency = IF(@col_exists_frequency = 0,
  'ALTER TABLE `challenges` ADD COLUMN `frequency` VARCHAR(20) DEFAULT ''daily'' COMMENT ''Frequência de registros: daily, weekly, custom''',
  'SELECT ''Coluna frequency já existe'' AS message'
);

PREPARE stmt_frequency FROM @sql_frequency;
EXECUTE stmt_frequency;
DEALLOCATE PREPARE stmt_frequency;

-- Atualizar desafios existentes para serem públicos por padrão
UPDATE `challenges` SET `isPublic` = TRUE WHERE `isPublic` IS NULL;
UPDATE `challenges` SET `frequency` = 'daily' WHERE `frequency` IS NULL;

-- Verificar se as colunas foram criadas
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'challenges'
  AND COLUMN_NAME IN ('isPublic', 'frequency');
