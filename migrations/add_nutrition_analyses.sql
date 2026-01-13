-- Migration: Adicionar tabela nutrition_analyses para rastrear análises nutricionais
-- Data: 2024-12-XX

CREATE TABLE IF NOT EXISTS `nutrition_analyses` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `imageUrl` VARCHAR(191) NULL,
  `analysis` TEXT NOT NULL,
  `pointsAwarded` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `nutrition_analyses_userId_idx` (`userId`),
  INDEX `nutrition_analyses_created_at_idx` (`created_at`),
  CONSTRAINT `nutrition_analyses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
