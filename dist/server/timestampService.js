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
exports.TimestampService = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const ioredis_1 = __importDefault(require("ioredis"));
class TimestampService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.redis = new ioredis_1.default(process.env.REDIS_URL);
    }
    subscribeToVideo(socket, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield this.prisma.video.findUnique({
                where: { id: videoId }
            });
            if (!video) {
                throw new Error('Video not found');
            }
            socket.join(`video:${videoId}`);
            yield this.redis.sadd(`video:${videoId}:viewers`, socket.data.user.id);
        });
    }
    unsubscribeFromVideo(socket, videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            socket.leave(`video:${videoId}`);
            yield this.redis.srem(`video:${videoId}:viewers`, socket.data.user.id);
        });
    }
    updateTimestamp(userId, videoId, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestampSchema = zod_1.z.number()
                .min(0, 'Timestamp cannot be negative')
                .max(86400, 'Timestamp too large');
            const validatedTimestamp = timestampSchema.parse(timestamp);
            const watchHistory = yield this.prisma.watchHistory.upsert({
                where: {
                    userId_videoId: {
                        userId,
                        videoId
                    }
                },
                update: { timestamp: validatedTimestamp },
                create: {
                    userId,
                    videoId,
                    timestamp: validatedTimestamp
                }
            });
            return watchHistory;
        });
    }
}
exports.TimestampService = TimestampService;
