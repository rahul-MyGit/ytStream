import Ffmpeg from "fluent-ffmpeg";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Worker } from 'bullmq';
import fs from 'fs';

const prisma = new PrismaClient();
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

export const videoProcessingWorker = new Worker('video-processing', async (job) => {
    const { videoId, localFilePath } = job.data;
  
    try {
        // Process video in multiple qualities
        const qualities = ['720p', '480p', '240p'];
        const videoUrls: Record<string, string> = {};
        
        for (const quality of qualities) {
            const outputPath = `${localFilePath}_${quality}.mp4`;
            const s3Key = `videos/${videoId}/${quality}.mp4`;
            
            // Transcode
            await transcodeVideo(localFilePath, outputPath, quality);
            
            // Upload to S3
            await uploadToS3(outputPath, s3Key);
            
            // Generate URL
            videoUrls[quality] = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
            
            // Cleanup local file
            fs.unlinkSync(outputPath);
        }

        // Update video status in database
        await prisma.video.update({
            where: { id: videoId },
            data: {
                status: 'TRANSCODED',
                videoUrls
            }
        });

        // Cleanup original file
        fs.unlinkSync(localFilePath);

    } catch (error) {
        console.error('Video processing failed:', error);
        await prisma.video.update({
            where: { id: videoId },
            data: { status: 'FAILED' }
        });
        
        // Cleanup on error
        try {
            fs.unlinkSync(localFilePath);
        } catch (e) {
            console.error('Failed to cleanup:', e);
        }
    }
});

async function transcodeVideo(input: string, output: string, quality: string) {
    const resolutions = {
        '720p': { width: 1280, height: 720, bitrate: '2500k' },
        '480p': { width: 854, height: 480, bitrate: '1000k' },
        '240p': { width: 426, height: 240, bitrate: '500k' }
    };

    const settings = resolutions[quality as keyof typeof resolutions];

    return new Promise((resolve, reject) => {
        Ffmpeg(input)
            .size(`${settings.width}x${settings.height}`)
            .videoBitrate(settings.bitrate)
            .format('mp4')
            .on('end', resolve)
            .on('error', reject)
            .save(output);
    });
}

async function uploadToS3(filePath: string, key: string) {
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: fileStream
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
}