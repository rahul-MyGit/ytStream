"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSocket = exports.protectRoute = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const protectRoute = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized - No Token'
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret123');
        if (!decoded) {
            res.status(401).json({
                success: false,
                message: 'Not autorized - invalid token'
            });
            return;
        }
        const currentUser = yield prisma.user.findUnique({
            where: { id: decoded.id }
        });
        req.user = currentUser;
        next();
    }
    catch (error) {
        console.log('Error while getting user details');
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Not authorized - Invalid token'
            });
            return;
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Error in server'
            });
            return;
        }
    }
});
exports.protectRoute = protectRoute;
const authenticateSocket = (socket, next) => __awaiter(void 0, void 0, void 0, function* () {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = yield prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }
        socket.data.user = user;
        next();
    }
    catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
});
exports.authenticateSocket = authenticateSocket;
