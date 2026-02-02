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
  .replace(/\\ /g, " ")          // corrige: \ (barra+espaço) em "PRIVATE KEY" -> espaço
  .replace(/\\-----/g, "\n-----") // corrige: \----- antes de END -> newline + -----
  .replace(/\\M/g, "\nM")       // corrige: \M (barra+M) -> quebra de linha + M (preserva base64)
  .replace(/\\n/g, "\n")         // converte \n literal para quebra de linha real
  .replace(/\\\\n/g, "\n")       // trata caso de double escape
  .replace(/\r/g, "")            // remove retornos de carro do Windows
  .replace(/"/g, "")             // remove aspas indesejadas
  .replace(/'/g, "")             // remove aspas simples
  .replace(/^\s+|\s+$/gm, "")    // remove espaços no início/fim de cada linha
  .trim();

// Validar formato básico da chave privada
const isValidPrivateKey = cleanPrivateKey && 
  cleanPrivateKey.includes("-----BEGIN PRIVATE KEY-----") &&
  cleanPrivateKey.includes("-----END PRIVATE KEY-----");

if (env.FIREBASE_PRIVATE_KEY && !isValidPrivateKey) {
  console.warn("⚠️  FIREBASE_PRIVATE_KEY está presente mas não está no formato correto.");
  console.warn("   A chave deve incluir '-----BEGIN PRIVATE KEY-----' e '-----END PRIVATE KEY-----'");
  console.warn("   Firebase Admin não será inicializado até que a chave seja corrigida.");
}

// -------------------------------
// 🔥 3. Inicializar Firebase Admin (apenas se configurado e válido)
// -------------------------------
if (hasFirebaseConfig && isValidPrivateKey && !admin.apps.length) {
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

  } catch (err: any) {
    console.error("❌ Erro ao inicializar Firebase Admin:");
    console.error(err);
    
    if (err?.code === "app/invalid-credential") {
      console.error("");
      console.error("🔧 SOLUÇÃO:");
      console.error("   1. Verifique se FIREBASE_PRIVATE_KEY no .env está correta");
      console.error("   2. A chave deve ter quebras de linha (\\n ou quebra real)");
      console.error("   3. A chave deve incluir '-----BEGIN PRIVATE KEY-----' e '-----END PRIVATE KEY-----'");
      console.error("   4. Não remova ou altere os caracteres da chave");
      console.error("");
      console.error("   Exemplo de formato correto no .env:");
      console.error('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvQ...\\n-----END PRIVATE KEY-----"');
      console.error("");
      console.error("   O upload de imagens não estará disponível até que o Firebase seja configurado corretamente.");
    }
  }
} else if (hasFirebaseConfig && !isValidPrivateKey) {
  console.warn("⚠️  Firebase configurado mas chave privada inválida. Upload de imagens desabilitado.");
}

// -------------------------------
// 🔥 4. Exportar Storage (dois nomes)
// -------------------------------
// Se Firebase não estiver configurado ou não inicializado, exporta null
const bucket = (hasFirebaseConfig && isValidPrivateKey && admin.apps.length) 
  ? admin.storage().bucket()
  : null as any;

// nome novo (recomendado)
export const firebaseStorage = bucket;

// nome antigo que seu código já usa em alguns lugares
export const storage = bucket;
