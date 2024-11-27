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
const startWsServer = (server) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (socket, req) => {
        console.log('asdasd');
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            socket.close(403, "Unauthorized");
            return;
        }
        const token = authHeader.split(" ")[1];
        let userId;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        }
        catch (err) {
            socket.close(403, "Invalid Token");
            return;
        }
        const clientId = userId;
        clients.set(clientId, { id: clientId, socket });
        socket.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case "video:subscribe":
                    handleVideoSubscribe(clientId, data.video_id);
                    break;
                case "video:unsubscribe":
                    handleVideoUnsubscribe(clientId);
                    break;
                default:
                    console.log(`Unknown event type: ${data.type}`);
            }
        }));
        socket.on("close", () => {
            handleVideoUnsubscribe(clientId);
            clients.delete(clientId);
        });
    });
};
exports.startWsServer = startWsServer;
const handleVideoSubscribe = (clientId, videoId) => {
    const client = clients.get(clientId);
    if (client) {
        client.videoId = videoId;
    }
};
const handleVideoUnsubscribe = (clientId) => {
    const client = clients.get(clientId);
    if (client) {
        client.videoId = undefined;
    }
};
const broadcastTimestamp = (videoId, timestamp, userId) => {
    clients.forEach((client) => {
        if (client.videoId === videoId) {
            client.socket.send(JSON.stringify({
                type: "video:timestamp_updated",
                timestamp,
                user_id: userId,
            }));
        }
    });
};
exports.broadcastTimestamp = broadcastTimestamp;
