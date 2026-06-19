
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth";

import {
  signupSchema,
  signinSchema,
  updateProfileSchema,
} from "../validators/auth.validator";

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user (com novos campos nutricionais)
 * @access  Public
 */
router.post("/google", AuthController.googleSignIn);
router.post("/google/callback", AuthController.googleCallback);
router.post("/apple", AuthController.appleSignIn);
router.post("/facebook", AuthController.facebookSignIn);

router.post("/signup", validate(signupSchema), AuthController.signup);

/**
 * @route   POST /api/auth/signin
 * @desc    Login user
 * @access  Public
 */
router.post("/signin", validate(signinSchema), AuthController.signin);

/**
 * @route   POST /api/auth/admin/login
 * @desc    Login admin (verifica se é admin)
 * @access  Public
 */
router.post("/admin/login", validate(signinSchema), AuthController.adminLogin);

/**
 * @route   GET /api/auth/profile
 * @desc    Get full user profile
 * @access  Private
 */
router.get("/profile", authenticate, AuthController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile (alteração de peso, sexo, idade, etc.)
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  AuthController.updateProfile
);

/**
 * @route   DELETE /api/auth/account
 * @desc    Excluir a conta do próprio usuário (LGPD + App Store/Play)
 * @access  Private
 */
router.delete("/account", authenticate, AuthController.deleteAccount);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar recuperação de senha
 * @access  Public
 */
router.post("/forgot-password", AuthController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Redefinir senha com token
 * @access  Public
 */
router.post("/reset-password", AuthController.resetPassword);

export default router;
