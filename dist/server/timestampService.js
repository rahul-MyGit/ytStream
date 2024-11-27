"use strict";
// import { PrismaClient } from '@prisma/client';
// import { Socket } from 'socket.io';
// import { z } from 'zod';
// import Redis from 'ioredis';
// export class TimestampService {
//   private prisma: PrismaClient;
//   private redis: Redis;
//   constructor() {
//     this.prisma = new PrismaClient();
//     this.redis = new Redis(process.env.REDIS_URL!);
//   }
//   async subscribeToVideo(socket: Socket, videoId: string) {
//     const video = await this.prisma.video.findUnique({ 
//       where: { id: videoId } 
//     });
//     if (!video) {
//       throw new Error('Video not found');
//     }
//     socket.join(`video:${videoId}`);
//     await this.redis.sadd(`video:${videoId}:viewers`, socket.data.user.id);
//   }
//   async unsubscribeFromVideo(socket: Socket, videoId: string) {
//     socket.leave(`video:${videoId}`);
//     await this.redis.srem(`video:${videoId}:viewers`, socket.data.user.id);
//   }
//   async updateTimestamp(userId: string, videoId: string, timestamp: number) {
//     const timestampSchema = z.number()
//       .min(0, 'Timestamp cannot be negative')
//       .max(86400, 'Timestamp too large');
//     const validatedTimestamp = timestampSchema.parse(timestamp);
//     const watchHistory = await this.prisma.watchHistory.upsert({
//       where: {
//         userId_videoId: {
//           userId,
//           videoId
//         }
//       },
//       update: { timestamp: validatedTimestamp },
//       create: {
//         userId,
//         videoId,
//         timestamp: validatedTimestamp
//       }
//     });
//     return watchHistory;
//   }
// }
