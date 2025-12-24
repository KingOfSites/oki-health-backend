-- ============================================
-- SCRIPT PARA CORRIGIR USUÁRIOS PRO INCORRETOS
-- ============================================

-- 1. Verificar todos os usuários e seus status PRO
SELECT 
    id,
    email,
    name,
    isPro,
    CASE 
        WHEN isPro = 1 THEN 'PRO'
        WHEN isPro = 0 THEN 'FREE'
        ELSE 'INDEFINIDO'
    END as status
FROM users
ORDER BY created_at DESC;

-- 2. Verificar usuários que são PRO mas não têm assinatura ativa
SELECT 
    u.id,
    u.email,
    u.name,
    u.isPro,
    ps.active as subscription_active,
    ps.endDate as subscription_end_date
FROM users u
LEFT JOIN plan_subscriptions ps ON u.id = ps.userId AND ps.active = TRUE
WHERE u.isPro = 1
  AND (ps.id IS NULL OR ps.endDate < NOW());

-- 3. CORRIGIR: Marcar como FREE todos os usuários que não têm assinatura ativa válida
UPDATE users u
LEFT JOIN plan_subscriptions ps ON u.id = ps.userId 
    AND ps.active = TRUE 
    AND (ps.endDate IS NULL OR ps.endDate >= NOW())
SET u.isPro = FALSE
WHERE u.isPro = TRUE
  AND ps.id IS NULL;

-- 4. Verificar resultado após correção
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN isPro = 1 THEN 1 ELSE 0 END) as pro_users,
    SUM(CASE WHEN isPro = 0 THEN 1 ELSE 0 END) as free_users
FROM users;

