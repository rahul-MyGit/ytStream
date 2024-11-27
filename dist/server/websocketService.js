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
exports.WebSocketService = void 0;
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const zod_1 = require("zod");
class WebSocketService {
    constructor(io) {
        this.io = io;
        this.prisma = new client_1.PrismaClient();
        this.redis = new ioredis_1.default(process.env.REDIS_URL || "");
        this.initializeEventHandlers();
    }
    initializeEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`New client connected: ${socket.id}`);
            this.handleVideoSubscription(socket);
            this.handleTimestampUpdate(socket);
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }
    handleVideoSubscription(socket) {
        socket.on('video:subscribe', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { video_id } = this.validateVideoSubscription(data);
                const video = yield this.prisma.video.findUnique({
                    where: { id: video_id }
                });
                if (!video) {
                    throw new Error('Video not found');
                }
                socket.join(`video:${video_id}`);
                yield this.redis.sadd(`video:${video_id}:viewers`, socket.data.user.id);
                socket.emit('video:subscribe:success', {
                    message: 'Subscribed to video room',
                    video_id
                });
            }
            catch (error) {
                this.handleError(socket, error, 'Video Subscription');
            }
        }));
        socket.on('video:unsubscribe', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { video_id } = this.validateVideoSubscription(data);
                socket.leave(`video:${video_id}`);
                yield this.redis.srem(`video:${video_id}:viewers`, socket.data.user.id);
                socket.emit('video:unsubscribe:success', {
                    message: 'Unsubscribed from video room',
                    video_id
                });
            }
            catch (error) {
                this.handleError(socket, error, 'Video Unsubscription');
            }
        }));
    }
    handleTimestampUpdate(socket) {
        socket.on('video:timestamp_update', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { video_id, timestamp } = this.validateTimestampUpdate(data);
                const watchHistory = yield this.prisma.watchHistory.upsert({
                    where: {
                        userId_videoId: {
                            userId: socket.data.user.id,
                            videoId: video_id
                        }
                    },
                    update: { timestamp },
                    create: {
                        userId: socket.data.user.id,
                        videoId: video_id,
                        timestamp
                    }
                });
                socket.to(`video:${video_id}`).emit('video:timestamp_updated', {
                    type: 'video:timestamp_updated',
                    timestamp,
                    user_id: socket.data.user.id
                });
                socket.emit('video:timestamp_update:success', {
                    message: 'Timestamp updated successfully',
                    video_id,
                    timestamp
                });
            }
            catch (error) {
                this.handleError(socket, error, 'Timestamp Update');
            }
        }));
    }
    validateVideoSubscription(data) {
        const schema = zod_1.z.object({
            video_id: zod_1.z.string().uuid('Invalid video ID')
        });
        return schema.parse(data);
    }
    validateTimestampUpdate(data) {
        const schema = zod_1.z.object({
            video_id: zod_1.z.string().uuid('Invalid video ID'),
            timestamp: zod_1.z.number()
                .min(0, 'Timestamp cannot be negative')
                .max(86400, 'Timestamp too large') // Assuming max video length of 24 hours
        });
        return schema.parse(data);
    }
    handleError(socket, error, context) {
        console.error(`${context} Error:`, error);
        socket.emit('error', {
            type: 'WebSocket Error',
            context,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
}
exports.WebSocketService = WebSocketService;
exports.default = WebSocketService;
