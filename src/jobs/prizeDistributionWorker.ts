import prisma from "../config/database";
import { PrizeDistributionService } from "../services/prizeDistribution.service";

let started = false;
let timer: NodeJS.Timeout | null = null;

function parseBool(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

export function startPrizeDistributionWorker() {
  if (started) return;
  started = true;

  const enabled = parseBool(process.env.PRIZE_DISTRIBUTION_WORKER_ENABLED, true);
  if (!enabled) {
    console.log("⏸️ [PrizeDistributionWorker] Desabilitado por env PRIZE_DISTRIBUTION_WORKER_ENABLED=false");
    return;
  }

  const intervalMs = (() => {
    const raw = Number(process.env.PRIZE_DISTRIBUTION_WORKER_INTERVAL_MS || 60_000);
    if (!Number.isFinite(raw) || raw < 5_000) return 60_000;
    return raw;
  })();

  console.log(`✅ [PrizeDistributionWorker] Ativo. Intervalo: ${intervalMs}ms`);

  const tick = async () => {
    try {
      // Busca desafios que já passaram da endDate e ainda não foram completados/cancelados.
      const candidates = await (prisma.challenge as any).findMany({
        where: {
          status: { notIn: ["completed", "cancelled"] },
          endDate: { lte: new Date() },
        },
        select: {
          id: true,
        },
        take: 50,
        orderBy: { endDate: "asc" },
      });

      if (!candidates.length) return;

      for (const c of candidates) {
        try {
          const res = await PrizeDistributionService.distributeForChallenge(c.id);
          console.log(`🏁 [PrizeDistributionWorker] Prêmios distribuídos: challengeId=${c.id} count=${res.distributed.length}`);
        } catch (err: any) {
          // Erros esperados (ainda não terminou, já completado, etc.) — silencioso.
          const code = err?.code || "";
          if (["NOT_FINISHED", "ALREADY_COMPLETED", "ALREADY_DISTRIBUTED", "CHALLENGE_CANCELLED", "NO_PARTICIPANTS"].includes(code)) {
            continue;
          }
          console.error(`❌ [PrizeDistributionWorker] Erro ao distribuir challengeId=${c.id}:`, err?.message || err);
        }
      }
    } catch (err: any) {
      console.error("❌ [PrizeDistributionWorker] Tick falhou:", err?.message || err);
    }
  };

  // Start imediato e agenda
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
}

export function stopPrizeDistributionWorker() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

