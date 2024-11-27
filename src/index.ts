import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from 'ws';
import authRoutes from "./routes/authRoutes";
import videoRoutes from "./routes/videoRoutes";
import channelRoutes from "./routes/channelRoutes";
import { startWsServer } from "./server/server";  

dotenv.config();

const app = express();


const server = createServer(app);


app.use(cors({
    origin: '*', // For development - be more restrictive in production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const wss = new WebSocketServer({ 
    server,
    path: '/',
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
        } catch (error) {
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

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: "Too many upload attempts, please try again later",
});

app.use(express.json({ limit: "50mb" })); 
app.use(cookieParser()); 
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/videos", uploadLimiter, videoRoutes);
app.use("/api/channels", channelRoutes);

server.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`);
  console.log(`WebSocket Server running on ws://localhost:${PORT}/ws`);
});
