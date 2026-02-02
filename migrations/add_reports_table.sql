-- Tabela de denúncias (report) para moderação de conteúdo
CREATE TABLE IF NOT EXISTS `reports` (
  `id` VARCHAR(191) NOT NULL,
  `reporterId` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `reports_reporterId_idx` (`reporterId`),
  INDEX `reports_targetType_targetId_idx` (`targetType`, `targetId`),
  INDEX `reports_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
