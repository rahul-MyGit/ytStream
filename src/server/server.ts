import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
interface Client {
    id: string;
    videoId?: string;
    socket: WebSocket;
}

const clients: Map<string, Client> = new Map();

export const startWsServer = (server: any) => {
    const wss = new WebSocketServer({ server });

    wss.on("connection", (socket, req) => {
        console.log('asdasd');

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            socket.close(403, "Unauthorized");
            return;
        }

        const token = authHeader.split(" ")[1];
        let userId: string;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
            userId = decoded.id;
        } catch (err) {
            socket.close(403, "Invalid Token");
            return;
        }

        const clientId = userId;
        clients.set(clientId, { id: clientId, socket });

        socket.on("message", async (message) => {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case "video:subscribe":
                    handleVideoSubscribe(clientId, data.video_id);
                    break;
                case "video:unsubscribe":
                    handleVideoUnsubscribe(clientId);  // Corrected function name
                    break;
                default:
                    console.log(`Unknown event type: ${data.type}`);
            }
        });

        socket.on("close", () => {
            handleVideoUnsubscribe(clientId);
            clients.delete(clientId);
        });
    });
};

const handleVideoSubscribe = (clientId: string, videoId: string) => {
    const client = clients.get(clientId);
    if (client) {
        client.videoId = videoId;
        // Get last known timestamp from database
        prisma.watchHistory.findUnique({
            where: {
                userId_videoId: {
                    userId: clientId,
                    videoId: videoId
                }
            }
        }).then(history => {
            if (history) {
                client.socket.send(JSON.stringify({
                    type: 'video:resume',
                    timestamp: history.timestamp
                }));
            }
        });
    }
};

const handleVideoUnsubscribe = (clientId: string) => {
    const client = clients.get(clientId);
    if (client) {
        client.videoId = undefined;
    }
};

export const broadcastTimestamp = (videoId: string, timestamp: number, userId: string) => {
    clients.forEach((client) => {
        if (client.videoId === videoId) {
            client.socket.send(
                JSON.stringify({
                    type: "video:timestamp_updated",
                    timestamp,
                    user_id: userId,
                })
            );
        }
    });
};