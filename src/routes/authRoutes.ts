import express from "express";
import { getme, login, logout, signup } from "../controller/authController";
import { protectRoute } from "../middleware/auth";

const router = express.Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);

router.get('/me', protectRoute, getme)

export default router;