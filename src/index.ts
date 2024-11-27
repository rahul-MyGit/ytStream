import express from "express";
import dotenv from "dotenv"
import cookieParser from "cookie-parser";
import cors from "cors";

// import { Server } from 'socket.io';
import { createServer } from 'http';
// import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';


import authRoutes from "./routes/authRoutes";
import videoRoutes from "./routes/videoRoutes";
import channelRoutes from "./routes/channelRoutes";
import { initializeSocket } from "./server/server";


dotenv.config();

const app = express();

const httpsServer = createServer(app)

// const redisClient = new Redis(process.env.REDIS_URL || "");
const PORT = process.env.Port || 5000

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many upload attempts, please try again later'
  });

initializeSocket(httpsServer)
app.use(express.json({limit: '50mb'}));
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/videos', uploadLimiter, videoRoutes);
app.use('/api/channels', channelRoutes);


httpsServer.listen(PORT, ()=> {
    console.log(`Server as started at ports ${PORT}`);
});
