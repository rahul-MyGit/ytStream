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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTimestamp = exports.GetVideoData = exports.uploadVideo = exports.feed = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const bullmq_1 = require("bullmq");
const server_1 = require("../server/server");
const prisma = new client_1.PrismaClient();
const videoProcessingQueue = new bullmq_1.Queue('video-processing', {
    connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
    }
});
const feed = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const category = req.query.category;
        if (!page || !limit || !category) {
            res.json(403).json({
                error: 'Missing the page | limit | category'
            });
            return;
        }
        const skip = (page - 1) * limit;
        const whereClause = Object.assign({ status: 'TRANSCODED' }, (category && { category }));
        const videos = yield prisma.video.findMany({
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
        const totalVideos = yield prisma.video.count({ where: whereClause });
        const totalPages = Math.ceil(totalVideos / limit);
        res.json({
            videos,
            total_pages: totalPages,
            current_page: page
        });
        return;
    }
    catch (error) {
        res.status(400).json({ message: 'Error while geting feed' });
        return;
    }
});
exports.feed = feed;
const uploadVideo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, category } = req.body;
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    if (!title || !description || !category) {
        res.status(400).json({ error: 'something is missing' });
        return;
    }
    try {
        const channel = yield prisma.channel.findUnique({
            where: { userId: req.user.id }
        });
        if (!channel) {
            res.status(403).json({ error: 'User must create a channel first' });
            return;
        }
        const video = yield prisma.video.create({
            data: {
                title,
                description,
                category,
                status: 'PROCESSING',
                creatorId: req.user.id,
                channelId: channel.id,
                thumbnail_url: `/thumbnails/${(0, uuid_1.v4)()}.jpg`
            }
        });
        yield videoProcessingQueue.add('process-video', {
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
    }
    catch (error) {
        res.status(400).json({ error: 'Validation failed' });
        return;
    }
});
exports.uploadVideo = uploadVideo;
const GetVideoData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { videoId } = req.params;
        const video = yield prisma.video.findUnique({
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
    });
});
exports.GetVideoData = GetVideoData;
const updateTimestamp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { videoId } = req.params;
    const { timestamp } = req.body;
    try {
        if (typeof timestamp !== 'number' || timestamp < 0) {
            res.status(400).json({
                error: 'Invalid timestamp'
            });
            return;
        }
        const video = yield prisma.video.findUnique({
            where: { id: videoId }
        });
        if (!video) {
            res.status(404).json({
                error: 'Video not found'
            });
            return;
        }
        const watchHistory = yield prisma.watchHistory.upsert({
            where: {
                userId_videoId: {
                    userId: req.user.id,
                    videoId
                }
            },
            update: { timestamp },
            create: {
                userId: req.user.id,
                videoId,
                timestamp
            }
        });
        (0, server_1.broadcastTimestamp)(videoId, timestamp, req.user.id);
        res.status(200).json({
            message: 'Timestamp updated',
            timestamp: watchHistory.timestamp
        });
        return;
    }
    catch (error) {
        console.error('Error updating timestamp:', error);
        res.status(500).json({ error: 'Failed to update timestamp' });
    }
});
exports.updateTimestamp = updateTimestamp;
