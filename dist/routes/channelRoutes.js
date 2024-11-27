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
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.post('/', auth_1.protectRoute, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, slug } = req.body;
    try {
        if (!name || !description || !slug) {
            res.status(400).json({
                success: false,
                message: "Validation Errors"
            });
            return;
        }
        const existingChannel = yield prisma.channel.findUnique({
            where: { userId: req.user.id }
        });
        if (existingChannel) {
            res.status(411).json({ error: 'User already has a channel' });
            return;
        }
        const slugExists = yield prisma.channel.findUnique({
            where: { slug: slug }
        });
        if (slugExists) {
            res.status(409).json({ error: 'Slug already exists' });
            return;
        }
        const channel = yield prisma.channel.create({
            data: {
                name,
                description,
                slug,
                userId: req.user.id
            }
        });
        res.status(201).json(channel);
        return;
    }
    catch (error) {
        res.status(400).json({ error: 'Validation failed' });
        return;
    }
}));
router.get('/:slug', auth_1.protectRoute, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { slug } = req.params;
    try {
        const channel = yield prisma.channel.findUnique({
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
            res.status(404).json({ message: 'channel not found' });
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
    }
    catch (error) {
        res.status(400).json({ error: 'validation failed' });
        return;
    }
}));
exports.default = router;
