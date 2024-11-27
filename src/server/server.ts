import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Client {
    id: string;
    videoId?: string;
    socket: WebSocket;
}

interface VideoRoom {
    clients: Set<string>;
    currentTime: number;
    lastUpdate: number;
}

const clients: Map<string, Client> = new Map();
const videoRooms: Map<string, VideoRoom> = new Map();

export const startWsServer = (server: any) => {
    const wss = new WebSocketServer({ server });

    wss.on("connection", async (socket, req) => {
        const client = await authenticateClient(socket, req);
        if (!client) return;

        const { userId, clientId } = client;
        clients.set(clientId, { id: userId, socket });

        socket.on("message", (message) => handleMessage(clientId, message));
        socket.on("close", () => handleDisconnect(clientId));
    });
};

const handleMessage = async (clientId: string, message: any) => {
    const client = clients.get(clientId);
    if (!client) return;

    try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
            case "video:subscribe":
                await handleVideoSubscribe(clientId, data.video_id);
                break;
            case "video:unsubscribe":
                handleVideoUnsubscribe(clientId);
                break;
            default:
                console.log(`Unknown message type: ${data.type}`);
        }
    } catch (error) {
        console.error("Error handling message:", error);
    }
};

const handleVideoSubscribe = async (clientId: string, videoId: string) => {
    const client = clients.get(clientId);
    if (!client) return;

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

    const room = videoRooms.get(videoId)!;
    room.clients.add(clientId);

    // Send current timestamp to new viewer
    const history = await prisma.watchHistory.findFirst({
        where: {
            videoId,
            userId: client.id
        }
    });

    client.socket.send(JSON.stringify({
        type: 'video:timestamp_updated',
        timestamp: history?.timestamp || room.currentTime,
        user_id: client.id
    }));
};

const handleVideoUnsubscribe = (clientId: string) => {
    const client = clients.get(clientId);
    if (!client || !client.videoId) return;

    const room = videoRooms.get(client.videoId);
    if (room) {
        room.clients.delete(clientId);
        if (room.clients.size === 0) {
            videoRooms.delete(client.videoId);
        }
    }

    client.videoId = undefined;
};

const handleDisconnect = (clientId: string) => {
    handleVideoUnsubscribe(clientId);
    clients.delete(clientId);
};

export const broadcastTimestamp = (videoId: string, timestamp: number, userId: string) => {
    const room = videoRooms.get(videoId);
    if (!room) return;

    room.currentTime = timestamp;
    room.lastUpdate = Date.now();

    room.clients.forEach(clientId => {
        const client = clients.get(clientId);
        if (client?.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify({
                type: "video:timestamp_updated",
                timestamp,
                user_id: userId
            }));
        }
    });
};

async function authenticateClient(socket: WebSocket, req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        socket.close(4001, "Unauthorized");
        return null;
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        return {
            userId: decoded.id,
            clientId: `${decoded.id}_${Date.now()}`
        };
    } catch (err) {
        socket.close(4002, "Invalid token");
        return null;
    }
}