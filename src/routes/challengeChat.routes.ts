import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ChallengeChatController } from "../controllers/challengeChat.controller";

const router = Router();

router.get("/:challengeId/chat", authenticate, ChallengeChatController.getMessages);
router.post("/:challengeId/chat", authenticate, ChallengeChatController.sendMessage);
router.get(
  "/:challengeId/chat/rejections/pending",
  authenticate,
  ChallengeChatController.getPendingRejections,
);
router.post(
  "/chat/rejections/:messageId/ack",
  authenticate,
  ChallengeChatController.acknowledgeRejection,
);

export default router;
