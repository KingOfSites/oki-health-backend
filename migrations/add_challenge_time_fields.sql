-- Migration: Adicionar campos de horário (startTime e endTime) na tabela challenges
-- Data: 2024-12-XX

ALTER TABLE `challenges` 
ADD COLUMN `startTime` VARCHAR(5) NULL COMMENT 'Horário inicial permitido (formato HH:MM, ex: 09:00)',
ADD COLUMN `endTime` VARCHAR(5) NULL COMMENT 'Horário final permitido (formato HH:MM, ex: 12:00)';
