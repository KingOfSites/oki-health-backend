import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";

const router = Router();

// GET /api/weights — lista entradas do usuário autenticado
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entries = await prisma.weightEntry.findMany({
      where: { userId: req.userId! },
      orderBy: { recordedAt: "asc" },
    });
    return res.json({ success: true, data: entries });
  } catch (error) {
    console.error("[weights] GET error:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar registros de peso." });
  }
});

// POST /api/weights — adiciona nova entrada
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { weightKg, note, recordedAt } = req.body;

    if (!weightKg || isNaN(Number(weightKg)) || Number(weightKg) <= 0) {
      return res.status(400).json({ success: false, error: "Peso inválido." });
    }

    const entry = await prisma.weightEntry.create({
      data: {
        id: randomUUID(),
        userId: req.userId!,
        weightKg: Number(weightKg),
        note: note ?? null,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
    });

    return res.status(201).json({ success: true, data: entry });
  } catch (error) {
    console.error("[weights] POST error:", error);
    return res.status(500).json({ success: false, error: "Erro ao salvar registro de peso." });
  }
});

// DELETE /api/weights/:id — remove entrada do usuário
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const entry = await prisma.weightEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== req.userId) {
      return res.status(404).json({ success: false, error: "Registro não encontrado." });
    }

    await prisma.weightEntry.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("[weights] DELETE error:", error);
    return res.status(500).json({ success: false, error: "Erro ao deletar registro de peso." });
  }
});

export default router;
