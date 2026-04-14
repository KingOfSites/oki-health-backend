import prisma from "../config/database";
import { PasswordUtils } from "../utils/password";
import { JWTUtils } from "../utils/jwt";
import { AppError } from "../middleware/errorHandler";
import { env } from "../config/env";
import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";

// ----------------------------------------------------
// DTOs
// ----------------------------------------------------
export interface SignupData {
  email: string;
  password: string;
  name: string;
  nickname?: string;
  age: number;
  city: string;
  affiliateCode?: string; // Código de afiliado opcional

  // 🔥 nutricionais
  sexo: "M" | "F";
  pesoKg: number;
  alturaCm: number;
  atividade: "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";
}

export interface SigninData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    age: number | null;
    city: string | null;

    sexo: "M" | "F" | null;
    peso: number | null;
    altura: number | null;
    atividade: string | null;

    xp: number;
    level: number;
    avatar_url?: string | null;
    isAdmin?: boolean;

    created_at: Date;
    updated_at: Date;
  };
  token: string;
}

export class AuthService {
  // ----------------------------------------------------
  // SIGNUP
  // ----------------------------------------------------
  static async signup(data: SignupData): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, "Email já cadastrado");
    }

    const passwordValidation = PasswordUtils.validate(data.password);
    if (!passwordValidation.valid) {
      throw new AppError(400, passwordValidation.errors.join(", "));
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        nickname: data.nickname,
        age: data.age,
        city: data.city,

        // 🔥 nutricionais
        sexo: data.sexo,
        peso: data.pesoKg,
        altura: data.alturaCm,
        atividade: data.atividade,

        // 🔥 IMPORTANTE: Garantir que isPro seja false para novos usuários
        isPro: false,
      },
    });

    // Registrar referral se houver código de afiliado
    if (data.affiliateCode) {
      try {
        const { AffiliateService } = await import("./affiliate.service");
        await AffiliateService.registerReferral(user.id, data.affiliateCode);
      } catch (error) {
        // Não falhar o signup se houver erro no referral
        console.error("Erro ao registrar referral:", error);
      }
    }

    // Registrar referral se houver código de afiliado
    if (data.affiliateCode) {
      try {
        const { AffiliateService } = await import("./affiliate.service");
        await AffiliateService.registerReferral(user.id, data.affiliateCode);
      } catch (error) {
        // Não falhar o signup se houver erro no referral
        console.error("Erro ao registrar referral:", error);
      }
    }

    const token = JWTUtils.generate(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        city: user.city,

        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,

        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,

        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // SIGNIN
  // ----------------------------------------------------
  static async signin(data: SigninData): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    if (!user.password) {
      throw new AppError(
        401,
        "Este email usa login social. Faça login com Google.",
      );
    }

    const isPasswordValid = await PasswordUtils.compare(
      data.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    const token = JWTUtils.generate(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        city: user.city,

        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,

        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,
        isAdmin: user.isAdmin ?? false,

        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // GOOGLE SIGN-IN (Mobile — idToken)
  // ----------------------------------------------------
  static async googleSignIn(
    idToken: string,
  ): Promise<AuthResponse & { isNew: boolean }> {
    // Valida o idToken diretamente no Google
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    if (!res.ok) {
      throw new AppError(401, "Token do Google inválido");
    }

    const payload = (await res.json()) as any;
    const googleId: string = payload.sub;
    const email: string = payload.email;
    const name: string = payload.name || email.split("@")[0];
    const picture: string | null = payload.picture ?? null;

    if (!googleId || !email) {
      throw new AppError(401, "Dados insuficientes no token do Google");
    }

    let isNew = false;
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          name,
          avatar_url: picture,
          password: null,
          isPro: false,
        },
      });
      isNew = true;
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatar_url: user.avatar_url ?? picture },
      });
    }

    const token = JWTUtils.generate(user.id);

    return {
      isNew,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age as number,
        city: user.city as string,
        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // GOOGLE OAUTH CALLBACK
  // ----------------------------------------------------
  static async googleCallback(
    code: string,
    redirectUri: string,
  ): Promise<AuthResponse & { isNew: boolean }> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError(500, "Google OAuth não configurado no servidor");
    }

    // 1. Trocar código por access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok) {
      throw new AppError(
        400,
        tokenData.error_description || "Falha ao trocar código com o Google",
      );
    }

    // 2. Buscar dados do usuário no Google
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );

    const googleUser = (await userInfoRes.json()) as any;
    if (!userInfoRes.ok) {
      throw new AppError(400, "Falha ao buscar dados do Google");
    }

    // 3. Buscar ou criar usuário
    let isNew = false;
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleUser.id }, { email: googleUser.email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split("@")[0],
          avatar_url: googleUser.picture ?? null,
          password: null,
          isPro: false,
        },
      });
      isNew = true;
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatar_url: user.avatar_url ?? googleUser.picture ?? null,
        },
      });
    }

    const token = JWTUtils.generate(user.id);

    return {
      isNew,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age as number,
        city: user.city as string,
        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // APPLE SIGN-IN (Mobile — identityToken JWT)
  // ----------------------------------------------------
  static async appleSignIn(
    identityToken: string,
    userInfo?: {
      email?: string | null;
      fullName?: {
        givenName?: string | null;
        familyName?: string | null;
      } | null;
    },
  ): Promise<AuthResponse & { isNew: boolean }> {
    // 1. Decodificar o header do JWT para obter o kid
    const decoded = jwt.decode(identityToken, { complete: true });
    if (!decoded || typeof decoded.payload === "string") {
      throw new AppError(401, "Token da Apple inválido");
    }

    const kid = decoded.header.kid;

    // 2. Buscar chaves públicas da Apple
    const keysRes = await fetch("https://appleid.apple.com/auth/keys");
    if (!keysRes.ok) {
      throw new AppError(502, "Falha ao buscar chaves públicas da Apple");
    }
    const { keys } = (await keysRes.json()) as { keys: any[] };
    const matchingKey = keys.find((k: any) => k.kid === kid);
    if (!matchingKey) {
      throw new AppError(
        401,
        "Chave pública da Apple não encontrada para este token",
      );
    }

    // 3. Verificar assinatura do token
    const pem = jwkToPem(matchingKey);
    let payload: any;
    try {
      payload = jwt.verify(identityToken, pem, { algorithms: ["RS256"] });
    } catch {
      throw new AppError(401, "Token da Apple inválido ou expirado");
    }

    const appleId: string = payload.sub;
    // Apple só envia email no primeiro login; nas subsequentes pode vir nulo
    const email: string | null = payload.email ?? userInfo?.email ?? null;
    const givenName = userInfo?.fullName?.givenName;
    const familyName = userInfo?.fullName?.familyName;
    const name = givenName
      ? [givenName, familyName].filter(Boolean).join(" ")
      : (email?.split("@")[0] ?? "Usuário Apple");

    if (!appleId) {
      throw new AppError(401, "Dados insuficientes no token da Apple");
    }

    // 4. Buscar ou criar usuário
    let isNew = false;
    let user = await prisma.user.findFirst({
      where: { OR: [{ appleId }, ...(email ? [{ email }] : [])] },
    });

    if (!user) {
      if (!email) {
        throw new AppError(
          400,
          "Email não disponível. Faça login novamente e autorize o compartilhamento de email.",
        );
      }
      user = await prisma.user.create({
        data: { appleId, email, name, password: null, isPro: false },
      });
      isNew = true;
    } else if (!user.appleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { appleId },
      });
    }

    const token = JWTUtils.generate(user.id);

    return {
      isNew,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age as number,
        city: user.city as string,
        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // FACEBOOK SIGN-IN (Mobile — accessToken)
  // ----------------------------------------------------
  static async facebookSignIn(
    token: string,
  ): Promise<AuthResponse & { isNew: boolean }> {
    // Busca dados do usuário no Graph API do Facebook
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${token}`,
    );

    if (!res.ok) {
      throw new AppError(401, "Token do Facebook inválido");
    }

    const payload = (await res.json()) as any;

    // Facebook Graph API não retorna email garantidamente, depende das permissões e se o usuário tem email configurado
    const facebookId: string = payload.id;
    const name: string = payload.name;
    const email: string | null = payload.email ?? null;
    const picture: string | null = payload.picture?.data?.url ?? null;

    if (!facebookId) {
      throw new AppError(401, "Dados insuficientes no token do Facebook");
    }

    let isNew = false;
    let user = await prisma.user.findFirst({
      where: { OR: [{ facebookId }, ...(email ? [{ email }] : [])] },
    });

    if (!user) {
      if (!email) {
        throw new AppError(
          400,
          "Email não disponível. Faça login novamente e autorize o compartilhamento de email.",
        );
      }
      user = await prisma.user.create({
        data: {
          facebookId,
          email,
          name,
          avatar_url: picture,
          password: null,
          isPro: false,
        },
      });
      isNew = true;
    } else if (!user.facebookId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { facebookId, avatar_url: user.avatar_url ?? picture },
      });
    }

    const jwtToken = JWTUtils.generate(user.id);

    return {
      isNew,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age as number,
        city: user.city as string,
        sexo: user.sexo === "M" || user.sexo === "F" ? user.sexo : null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,
        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // GET PROFILE ✅ (ADICIONADO)
  // ----------------------------------------------------
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        city: true,
        avatar_url: true,

        sexo: true,
        peso: true,
        altura: true,
        atividade: true,

        xp: true,
        level: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    return user;
  }

  // ----------------------------------------------------
  // UPDATE PROFILE ✅
  // ----------------------------------------------------
  static async updateProfile(
    userId: string,
    data: {
      name?: string;
      age?: number;
      city?: string;
      avatar_url?: string;
      sexo?: "M" | "F";
      peso?: number;
      altura?: number;
      atividade?:
        | "sedentario"
        | "leve"
        | "moderado"
        | "intenso"
        | "muito_intenso";
    },
  ) {
    // Verificar se o usuário existe (apenas id para evitar referências circulares)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.age !== undefined) updateData.age = data.age;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.sexo !== undefined) updateData.sexo = data.sexo;
    if (data.peso !== undefined) updateData.peso = data.peso;
    if (data.altura !== undefined) updateData.altura = data.altura;
    if (data.atividade !== undefined) updateData.atividade = data.atividade;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        city: true,
        avatar_url: true,
        sexo: true,
        peso: true,
        altura: true,
        atividade: true,
        xp: true,
        level: true,
        created_at: true,
        updated_at: true,
      },
    });

    return updated;
  }
}
