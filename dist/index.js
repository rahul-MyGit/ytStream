"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ioredis_1 = __importDefault(require("ioredis"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
const channelRoutes_1 = __importDefault(require("./routes/channelRoutes"));
const server_1 = require("./server/server");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpsServer = (0, http_1.createServer)(app);
const redisClient = new ioredis_1.default(process.env.REDIS_URL || "");
const PORT = process.env.Port || 5000;
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many upload attempts, please try again later'
});
(0, server_1.initializeSocket)(httpsServer);
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/videos', uploadLimiter, videoRoutes_1.default);
app.use('/api/channels', channelRoutes_1.default);
httpsServer.listen(PORT, () => {
    console.log(`Server as started at ports ${PORT}`);
});
