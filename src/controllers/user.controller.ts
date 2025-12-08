import { prisma } from "../lib/prisma";

export const updateUserProfile = async (req: any, res: any) => {
  try {
    const userId = req.user?.id; // vindo do middleware auth

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const { name, age, city } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(age && { age: Number(age) }),
        ...(city && { city }),
      },
    });

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
};
