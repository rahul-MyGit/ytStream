"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controller/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/login', authController_1.login);
router.post('/signup', authController_1.signup);
router.post('/logout', authController_1.logout);
router.get('/me', auth_1.protectRoute, authController_1.getme);
exports.default = router;
