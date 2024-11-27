"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
// import { createServer } from 'http';
// import { Queue, Worker } from 'bullmq';
// import ffmpeg from 'fluent-ffmpeg';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// import Redis from 'ioredis';
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
const channelRoutes_1 = __importDefault(require("./routes/channelRoutes"));
// import { initializeSocket } from "./server/server";
dotenv_1.default.config();
const app = (0, express_1.default)();
// const httpServer = createServer(app);
// const redisClient = new Redis(process.env.REDIS_URL || "");
const PORT = process.env.Port || 5000;
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many upload attempts, please try again later'
});
// initializeSocket(httpServer)
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/videos', uploadLimiter, videoRoutes_1.default);
app.use('/api/channels', channelRoutes_1.default);
app.listen(PORT, () => {
    console.log(`Server as started at ports ${PORT}`);
});
