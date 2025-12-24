import { Router } from "express";
import multer from "multer";
import { firebaseStorage } from "../config/firebase";
import { authenticate } from "../middleware/auth";

const router = Router();

// Configurar multer para armazenar temporariamente na memória
// (não salva em disco, apenas mantém em memória para fazer upload para Firebase)
const upload = multer({
  storage: multer.memoryStorage(), // Armazena temporariamente na memória
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Rota para upload de imagens do chat do desafio
// As imagens são salvas no Firebase Storage na pasta "chat/"
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const file = req.file;
    console.log(`[Chat Upload] 📤 Recebendo imagem do chat: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

    // Verificar se Firebase Storage está configurado
    if (!firebaseStorage) {
      console.error("[Chat Upload] ❌ Firebase Storage não está configurado!");
      return res.status(500).json({ 
        error: "Firebase Storage não configurado",
        message: "Configure as variáveis FIREBASE_* no arquivo .env"
      });
    }

    // Criar nome do arquivo único na pasta chat/ do Firebase Storage
    // Formato: chat/[timestamp]_[nome_original]
    const fileName = `chat/${Date.now()}_${file.originalname}`;
    const bucket = firebaseStorage;
    const fileUpload = bucket.file(fileName);

    console.log(`[Chat Upload] 🔥 Firebase Storage: Iniciando upload para ${fileName}`);
    console.log(`[Chat Upload] 📦 Bucket: ${bucket.name}`);

    // Fazer upload para Firebase Storage (não salva em disco local)
    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    console.log(`[Chat Upload] 🔓 Tornando arquivo público no Firebase Storage...`);

    // Tornar o arquivo público para acesso via URL
    await fileUpload.makePublic();

    // Obter URL pública do Firebase Storage
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    
    console.log(`[Chat Upload] ✅ Upload concluído no Firebase Storage!`);
    console.log(`[Chat Upload] 🔗 URL pública: ${url}`);

    return res.json({ 
      url,
      success: true,
      message: "Imagem salva no Firebase Storage com sucesso"
    });

  } catch (err: any) {
    console.error("🔥 Erro ao enviar imagem:", err);
    return res.status(500).json({ 
      error: "Erro ao enviar imagem",
      message: err.message 
    });
  }
});

export default router;
