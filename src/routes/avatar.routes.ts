import { Router } from "express";
import multer from "multer";
import { firebaseStorage } from "../config/firebase";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Configurar multer para armazenar temporariamente
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.post("/upload", authenticate, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "Arquivo não enviado" 
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: "Não autenticado",
      });
    }

    const file = req.file;
    const userId = req.userId;

    console.log(`[Avatar Upload] 📤 Recebendo imagem: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

    // Verificar se Firebase está configurado
    if (!firebaseStorage) {
      console.error("[Avatar Upload] ❌ Firebase Storage não está configurado!");
      return res.status(500).json({ 
        success: false,
        error: "Firebase Storage não configurado" 
      });
    }

    // Criar nome do arquivo único para avatar
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const fileName = `avatars/${userId}_${Date.now()}.${fileExtension}`;
    const bucket = firebaseStorage;
    const fileUpload = bucket.file(fileName);

    console.log(`[Avatar Upload] 🔥 Fazendo upload para Firebase: ${fileName}`);

    // Fazer upload para Firebase
    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Tornar o arquivo público
    await fileUpload.makePublic();

    // Obter URL pública
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    
    console.log(`[Avatar Upload] ✅ Upload concluído! URL: ${url}`);

    return res.json({ 
      success: true,
      url 
    });

  } catch (err: any) {
    console.error("🔥 Erro ao enviar avatar:", err);
    return res.status(500).json({ 
      success: false,
      error: "Erro ao enviar imagem",
      message: err.message 
    });
  }
});

export default router;

