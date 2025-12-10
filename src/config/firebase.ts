import admin from "firebase-admin";
import { env } from "./env";

// -------------------------------
// 🔥 1. Garantir que a private key existe
// -------------------------------
const rawKey = env.FIREBASE_PRIVATE_KEY;

if (!rawKey) {
  console.error("❌ FIREBASE_PRIVATE_KEY está vazia ou não foi carregada!");
}

// -------------------------------
// 🔥 2. Limpar e normalizar chave
// -------------------------------
const cleanPrivateKey = (rawKey || "")
  .replace(/\\n/g, "\n")   // converte \n literal para quebra de linha real
  .replace(/\r/g, "")      // remove retornos de carro do Windows
  .replace(/"/g, "")       // remove aspas indesejadas
  .trim();

// -------------------------------
// 🔥 3. Inicializar Firebase Admin
// -------------------------------
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanPrivateKey,
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
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
const bucket = admin.storage().bucket();

// nome novo (recomendado)
export const firebaseStorage = bucket;

// nome antigo que seu código já usa em alguns lugares
export const storage = bucket;
