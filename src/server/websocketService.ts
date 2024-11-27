import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { z } from 'zod';

export class WebSocketService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || "");

    this.initializeEventHandlers();
  }

  private initializeEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`New client connected: ${socket.id}`);

      this.handleVideoSubscription(socket);

      this.handleTimestampUpdate(socket);

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private handleVideoSubscription(socket: Socket) {
    socket.on('video:subscribe', async (data) => {
      try {
        const { video_id } = this.validateVideoSubscription(data);

        const video = await this.prisma.video.findUnique({ 
          where: { id: video_id } 
        });

        if (!video) {
          throw new Error('Video not found');
        }

        socket.join(`video:${video_id}`);

        await this.redis.sadd(`video:${video_id}:viewers`, socket.data.user.id);

        socket.emit('video:subscribe:success', { 
          message: 'Subscribed to video room',
          video_id 
        });
      } catch (error) {
        this.handleError(socket, error, 'Video Subscription');
      }
    });

    socket.on('video:unsubscribe', async (data) => {
      try {
        const { video_id } = this.validateVideoSubscription(data);

        socket.leave(`video:${video_id}`);

        await this.redis.srem(`video:${video_id}:viewers`, socket.data.user.id);

        socket.emit('video:unsubscribe:success', { 
          message: 'Unsubscribed from video room',
          video_id 
        });
      } catch (error) {
        this.handleError(socket, error, 'Video Unsubscription');
      }
    });
  }

  private handleTimestampUpdate(socket: Socket) {
    socket.on('video:timestamp_update', async (data) => {
      try {
        const { video_id, timestamp } = this.validateTimestampUpdate(data);

        const watchHistory = await this.prisma.watchHistory.upsert({
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
      } catch (error) {
        this.handleError(socket, error, 'Timestamp Update');
      }
    });
  }

  private validateVideoSubscription(data: any) {
    const schema = z.object({
      video_id: z.string().uuid('Invalid video ID')
    });

    return schema.parse(data);
  }

  private validateTimestampUpdate(data: any) {
    const schema = z.object({
      video_id: z.string().uuid('Invalid video ID'),
      timestamp: z.number()
        .min(0, 'Timestamp cannot be negative')
        .max(86400, 'Timestamp too large') // Assuming max video length of 24 hours
    });

    return schema.parse(data);
  }

  private handleError(socket: Socket, error: any, context: string) {
    console.error(`${context} Error:`, error);

    socket.emit('error', { 
      type: 'WebSocket Error',
      context,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

export default WebSocketService;