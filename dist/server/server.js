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
exports.broadcastTimestamp = exports.startWsServer = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const clients = new Map();
const videoRooms = new Map();
const startWsServer = (server) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (socket, req) => __awaiter(void 0, void 0, void 0, function* () {
        const client = yield authenticateClient(socket, req);
        if (!client)
            return;
        const { userId, clientId } = client;
        clients.set(clientId, { id: userId, socket });
        socket.on("message", (message) => handleMessage(clientId, message));
        socket.on("close", () => handleDisconnect(clientId));
    }));
};
exports.startWsServer = startWsServer;
const handleMessage = (clientId, message) => __awaiter(void 0, void 0, void 0, function* () {
    const client = clients.get(clientId);
    if (!client)
        return;
    try {
        const data = JSON.parse(message.toString());
        switch (data.type) {
            case "video:subscribe":
                yield handleVideoSubscribe(clientId, data.video_id);
                break;
            case "video:unsubscribe":
                handleVideoUnsubscribe(clientId);
                break;
            default:
                console.log(`Unknown message type: ${data.type}`);
        }
    }
    catch (error) {
        console.error("Error handling message:", error);
    }
});
const handleVideoSubscribe = (clientId, videoId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = clients.get(clientId);
    if (!client)
        return;
    // Remove from previous room if any
    if (client.videoId) {
        handleVideoUnsubscribe(clientId);
    }
    // Join new room
    client.videoId = videoId;
    // Create room if doesn't exist
    if (!videoRooms.has(videoId)) {
        videoRooms.set(videoId, {
            clients: new Set(),
            currentTime: 0,
            lastUpdate: Date.now()
        });
    }
    const room = videoRooms.get(videoId);
    room.clients.add(clientId);
    // Send current timestamp to new viewer
    const history = yield prisma.watchHistory.findFirst({
        where: {
            videoId,
            userId: client.id
        }
    });
    client.socket.send(JSON.stringify({
        type: 'video:timestamp_updated',
        timestamp: (history === null || history === void 0 ? void 0 : history.timestamp) || room.currentTime,
        user_id: client.id
    }));
});
const handleVideoUnsubscribe = (clientId) => {
    const client = clients.get(clientId);
    if (!client || !client.videoId)
        return;
    const room = videoRooms.get(client.videoId);
    if (room) {
        room.clients.delete(clientId);
        if (room.clients.size === 0) {
            videoRooms.delete(client.videoId);
        }
    }
    client.videoId = undefined;
};
const handleDisconnect = (clientId) => {
    handleVideoUnsubscribe(clientId);
    clients.delete(clientId);
};
const broadcastTimestamp = (videoId, timestamp, userId) => {
    const room = videoRooms.get(videoId);
    if (!room)
        return;
    room.currentTime = timestamp;
    room.lastUpdate = Date.now();
    room.clients.forEach(clientId => {
        const client = clients.get(clientId);
        if ((client === null || client === void 0 ? void 0 : client.socket.readyState) === ws_1.WebSocket.OPEN) {
            client.socket.send(JSON.stringify({
                type: "video:timestamp_updated",
                timestamp,
                user_id: userId
            }));
        }
    });
};
exports.broadcastTimestamp = broadcastTimestamp;
function authenticateClient(socket, req) {
    return __awaiter(this, void 0, void 0, function* () {
        const authHeader = req.headers.authorization;
        if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer "))) {
            socket.close(4001, "Unauthorized");
            return null;
        }
        try {
            const token = authHeader.split(" ")[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            return {
                userId: decoded.id,
                clientId: `${decoded.id}_${Date.now()}`
            };
        }
        catch (err) {
            socket.close(4002, "Invalid token");
            return null;
        }
    });
}
