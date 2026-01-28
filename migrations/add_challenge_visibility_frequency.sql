-- Migration: Adicionar campos de visibilidade e frequência na tabela challenges
-- Data: 2025-01-28

ALTER TABLE `challenges` 
ADD COLUMN `isPublic` BOOLEAN DEFAULT TRUE COMMENT 'Visibilidade do desafio: true = Público, false = Privado',
ADD COLUMN `frequency` VARCHAR(20) DEFAULT 'daily' COMMENT 'Frequência de registros: daily, weekly, custom';

-- Atualizar desafios existentes para serem públicos por padrão
UPDATE `challenges` SET `isPublic` = TRUE WHERE `isPublic` IS NULL;
UPDATE `challenges` SET `frequency` = 'daily' WHERE `frequency` IS NULL;
