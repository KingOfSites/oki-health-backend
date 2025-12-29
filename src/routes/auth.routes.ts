
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
router.post("/signup", validate(signupSchema), AuthController.signup);

/**
 * @route   POST /api/auth/signin
 * @desc    Login user
 * @access  Public
 */
router.post("/signin", validate(signinSchema), AuthController.signin);

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

export default router;
