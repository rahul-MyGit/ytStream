import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid'
import { Queue } from "bullmq";
import { broadcastTimestamp } from "../server/server";

const prisma = new PrismaClient();

const videoProcessingQueue = new Queue('video-processing', {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379')
    }
  });

export const feed = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const category = req.query.category as string | undefined;

        if(!page || !limit || !category) {
            res.json(403).json({
                error: 'Missing the page | limit | category'
            })
            return;
        }
        const skip = (page - 1) * limit;

        const whereClause: any = {
            status: 'TRANSCODED',
            ...(category && { category })
        };

        const videos = await prisma.video.findMany({
            where: whereClause,
            take: limit,
            skip,
            select: {
                id: true,
                title: true,
                thumbnail_url: true,
                view_count: true,
                createdAt: true,
                creator: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalVideos = await prisma.video.count({ where: whereClause });
        const totalPages = Math.ceil(totalVideos / limit);

        res.json({
            videos,
            total_pages: totalPages,
            current_page: page
        });
        return;
    } catch (error) {
        res.status(400).json({ message: 'Error while geting feed' })
        return;
    }
}


export const uploadVideo = async (req: Request, res: Response) => {
    const { title, description, category } = req.body;
    const file = req.file;

    if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    if (!title || !description || !category) {
        res.status(400).json({ error: 'something is missing' })
        return;
    }

    try {

        const channel = await prisma.channel.findUnique({
            where: { userId: req.user!.id }
        });

        if (!channel) {
            res.status(403).json({ error: 'User must create a channel first' });
            return;
        }

        const video = await prisma.video.create({
            data: {
                title,
                description,
                category,
                status: 'PROCESSING',
                creatorId: req.user!.id,
                channelId: channel.id,
                thumbnail_url: `/thumbnails/${uuidv4()}.jpg`
            }
        });

        await videoProcessingQueue.add('process-video', {
            videoId: video.id,
            localFilePath: file.path
          });

        res.status(201).json({
            id: video.id,
            title: video.title,
            processing_status: video.status,
            qualities: ['240p', '480p', '720p']
        });
        return;
    } catch (error) {
        res.status(400).json({ error: 'Validation failed' });
        return;
    }
}

export const GetVideoData = async (req: Request, res: Response) => {
    async (req: Request, res: Response) => {
        const { videoId } = req.params;

        const video = await prisma.video.findUnique({
            where: { id: videoId },
            include: {
                creator: {
                    select: { id: true, username: true }
                }
            }
        });

        if (!video) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }

        if (video.status === 'PROCESSING') {
            res.json({
                id: video.id,
                title: video.title,
                description: video.description,
                creator: video.creator,
                status: video.status
            });
            return;
        }

        res.json({
            id: video.id,
            title: video.title,
            description: video.description,
            creator: video.creator,
            video_urls: video.videoUrls,
            current_timestamp: 0,
            view_count: video.view_count,
            status: video.status
        });
        return;
    };
}

export const updateTimestamp = async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const { timestamp } = req.body;

    try {
        if (typeof timestamp !== 'number' || timestamp < 0) {
            res.status(400).json({
                error: 'Invalid timestamp'
            });
            return;
        }

        const video = await prisma.video.findUnique({
            where: { id: videoId }
        });

        if (!video) {
            res.status(404).json({
                error: 'Video not found'
            });
            return;
        }

        const watchHistory = await prisma.watchHistory.upsert({
            where: {
                userId_videoId: {
                    userId: req.user!.id,
                    videoId
                }
            },
            update: { timestamp },
            create: {
                userId: req.user!.id,
                videoId,
                timestamp
            }
        });

        broadcastTimestamp(videoId, timestamp, req.user!.id);

        res.status(200).json({ 
            message: 'Timestamp updated',
            timestamp: watchHistory.timestamp 
        });
        return;
    } catch (error) {
        console.error('Error updating timestamp:', error);
        res.status(500).json({ error: 'Failed to update timestamp' });
    }
};