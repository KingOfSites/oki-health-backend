import { Router } from "express";
import prisma from "../config/database";
import multer from "multer";
import { storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint para upload de arquivo (multipart)
router.post("/upload", upload.single("file"), async (req, res) => {
  const { challengeId, userId, caption } = req.body;

  if (!req.file || !challengeId || !userId) {
    return res.status(400).json({ error: "Arquivo, challengeId e userId são obrigatórios" });
  }

  try {
    // Upload para Firebase Storage
    const fileName = `${challengeId}-${Date.now()}-${req.file.originalname}`;
    const storageRef = ref(storage, `challenge-posts/${fileName}`);

    await uploadBytes(storageRef, req.file.buffer);
    const imageUrl = await getDownloadURL(storageRef);

    console.log('[challengePosts] Firebase upload success:', imageUrl);

    // Salvar no banco de dados
    const post = await prisma.challengePost.create({
      data: {
        challengeId,
        userId,
        imageUrl,
        caption: caption || null
      },
    });

    return res.json({ success: true, post, imageUrl });
  } catch (error) {
    console.error("Erro ao fazer upload:", error);
    return res.status(500).json({ error: "Erro ao fazer upload" });
  }
});

router.post("/", async (req, res) => {
  const { challengeId, userId, imageUrl, caption } = req.body;

  try {
    const post = await prisma.challengePost.create({
      data: {
        challengeId,
        userId,
        imageUrl,
        caption
      },
    });

    return res.json(post);
  } catch (error) {
    console.error("Erro ao criar post:", error);
    return res.status(500).json({ error: "Erro ao criar o post" });
  }
});

// Buscar posts
router.get("/:challengeId", async (req, res) => {
  const { challengeId } = req.params;

  try {
    const posts = await prisma.challengePost.findMany({
      where: { challengeId },
      orderBy: { created_at: "desc" },
    });

    return res.json(posts);
  } catch (error) {
    console.error("Erro ao buscar posts:", error);
    return res.status(500).json({ error: "Erro ao buscar posts" });
  }
});

export default router;
