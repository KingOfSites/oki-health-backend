import { Router } from "express";
import { firebaseStorage } from "../config/firebase";

const router = Router();

router.post("/upload", async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const file = req.file;

    const upload = await firebaseStorage.upload(file.path, {
      destination: `posts/${Date.now()}_${file.originalname}`,
      metadata: {
        contentType: file.mimetype,
      },
    });

    const url = upload[0].publicUrl();

    return res.json({ url });

  } catch (err) {
    console.error("🔥 Erro ao enviar imagem:", err);
    return res.status(500).json({ error: "Erro ao enviar imagem" });
  }
});

export default router;
