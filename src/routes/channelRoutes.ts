import express, { Request, Response } from "express";
import { protectRoute } from "../middleware/auth";

import { PrismaClient } from '@prisma/client'

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', protectRoute, async (req: Request, res: Response) => {
    const { name, description, slug } = req.body;

    try {
        if (!name || !description || !slug) {
            res.status(400).json({
                success: false,
                message: "Validation Errors"
            });
            return;
        }

        const existingChannel = await prisma.channel.findUnique({
            where: { userId: req.user!.id }
        });

        if (existingChannel) {
            res.status(411).json({ error: 'User already has a channel' });
            return;
        }

        const slugExists = await prisma.channel.findUnique({
            where: { slug: slug }
        });

        if (slugExists) {
            res.status(409).json({ error: 'Slug already exists' });
            return;
        }

        const channel = await prisma.channel.create({
            data: {
                name,
                description,
                slug,
                userId: req.user!.id
            }
        });

        res.status(201).json(channel);
        return;

    } catch (error) {
        res.status(400).json({ error: 'Validation failed' });
        return;
    }
});

router.get('/:slug', protectRoute, async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
        const channel = await prisma.channel.findUnique({
            where: { slug },
            include: {
                _count: { select: { videos: true } },
                videos: {
                    select: {
                        id: true,
                        title: true,
                        thumbnail_url: true
                    },
                    take: 10
                }
            }
        });

        if (!channel) {
            res.status(404).json({ message: 'channel not found' })
            return;
        }

        res.json({
            id: channel.id,
            name: channel.name,
            description: channel.description,
            subscriber_count: channel.subscriber_count,
            videos: channel.videos
        });
        return;

    } catch (error) {
        res.status(400).json({ error: 'validation failed' });
        return;
    }
})


export default router;