import { Worker } from "bullmq";
import { exec } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const execAsync = promisify(exec);

const videoWorker = new Worker(
    "video-processing",
    async (job) => {
        const { videoId, localFilePath } = job.data;

        try {
            const outputPath = `/processed/${videoId}.mp4`;
            await execAsync(
                `ffmpeg -i ${localFilePath} -vf scale=1280:720 -preset fast -crf 22 ${outputPath}`
            );

            await prisma.video.update({
                where: { id: videoId },
                data: {
                    status: "TRANSCODED",
                    videoUrls: outputPath,
                },
            });
        } catch (error) {
            await prisma.video.update({
                where: { id: videoId },
                data: { status: "FAILED" },
            });
        }
    },
    { connection: { host: process.env.REDIS_HOST!, port: parseInt(process.env.REDIS_PORT!) } }
);

console.log("Video processing worker started.");
