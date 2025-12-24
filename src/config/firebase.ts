import admin from "firebase-admin";
import { env } from "./env";

// -------------------------------
// 🔥 1. Verificar se as variáveis do Firebase estão configuradas
// -------------------------------
const hasFirebaseConfig = 
  env.FIREBASE_PROJECT_ID && 
  env.FIREBASE_CLIENT_EMAIL && 
  env.FIREBASE_PRIVATE_KEY && 
  env.FIREBASE_STORAGE_BUCKET;

if (!hasFirebaseConfig) {
  console.warn("⚠️  Firebase não configurado. Upload de imagens não estará disponível.");
  console.warn("   Configure FIREBASE_* no .env para habilitar upload de imagens.");
}

// -------------------------------
// 🔥 2. Limpar e normalizar chave (se existir)
// -------------------------------
const cleanPrivateKey = (env.FIREBASE_PRIVATE_KEY || "")
  .replace(/\\n/g, "\n")   // converte \n literal para quebra de linha real
  .replace(/\r/g, "")      // remove retornos de carro do Windows
  .replace(/"/g, "")       // remove aspas indesejadas
  .trim();

// -------------------------------
// 🔥 3. Inicializar Firebase Admin (apenas se configurado)
// -------------------------------
if (hasFirebaseConfig && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID!,
        clientEmail: env.FIREBASE_CLIENT_EMAIL!,
        privateKey: cleanPrivateKey,
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET!,
    });

    console.log("🔥 Firebase Admin inicializado com sucesso!");

  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase Admin:");
    console.error(err);
  }
}

// -------------------------------
// 🔥 4. Exportar Storage (dois nomes)
// -------------------------------
// Se Firebase não estiver configurado, exporta um objeto vazio que lançará erro ao usar
const bucket = hasFirebaseConfig && admin.apps.length 
  ? admin.storage().bucket()
  : null as any;

// nome novo (recomendado)
export const firebaseStorage = bucket;

// nome antigo que seu código já usa em alguns lugares
export const storage = bucket;
