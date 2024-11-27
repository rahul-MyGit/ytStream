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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const ws_1 = require("ws");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
const channelRoutes_1 = __importDefault(require("./routes/channelRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
app.use((0, cors_1.default)({
    origin: '*', // For development - be more restrictive in production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
const wss = new ws_1.WebSocketServer({
    server,
    path: '/server',
    clientTracking: true,
});
const clients = new Map();
wss.on('connection', (ws, req) => {
    console.log('New client attempting to connect');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Authentication failed - closing connection');
        ws.close(1008, 'Unauthorized');
        return;
    }
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);
    ws.send(JSON.stringify({
        type: 'connection_established',
        clientId: clientId
    }));
    console.log(`Client ${clientId} connected successfully`);
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            ws.send(JSON.stringify({
                type: 'echo',
                data: data
            }));
        }
        catch (error) {
            console.error('Failed to process message:', error);
        }
    });
    ws.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients.delete(clientId);
    });
    ws.on('error', (error) => {
        console.error(`Client ${clientId} error:`, error);
        clients.delete(clientId);
    });
});
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});
const PORT = process.env.PORT || 5000;
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many upload attempts, please try again later",
});
app.use(express_1.default.json({ limit: "50mb" }));
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));
app.use("/api/auth", authRoutes_1.default);
app.use("/api/videos", uploadLimiter, videoRoutes_1.default);
app.use("/api/channels", channelRoutes_1.default);
server.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
    console.log(`WebSocket Server running on ws://localhost:${PORT}/ws`);
});
