import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { NotificationsController } from "../controllers/notifications.controller";

const router = Router();

router.get("/", authenticate, NotificationsController.getNotifications);
router.put("/read-all", authenticate, NotificationsController.markAllAsRead);
router.put("/:id/read", authenticate, NotificationsController.markAsRead);

export default router;
