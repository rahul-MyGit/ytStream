import Ffmpeg from "fluent-ffmpeg";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Worker } from 'bullmq';

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
      // Transcode video to multiple qualities
      const qualities = [
        { resolution: '240p', videoBitrate: '400k' },
        { resolution: '480p', videoBitrate: '1000k' },
        { resolution: '720p', videoBitrate: '2500k' }
      ];
  
      const videoUrls: Record<string, string> = {};
  
      for (const quality of qualities) {
        const outputPath = `videos/${videoId}_${quality.resolution}.mp4`;
        
        await new Promise<void>((resolve, reject) => {
          Ffmpeg(localFilePath)
            .videoCodec('libx264')
            .size(quality.resolution)
            .videoBitrate(quality.videoBitrate)
            .toFormat('mp4')
            .on('end', async () => {
              const uploadParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: outputPath,
                Body: require('fs').createReadStream(outputPath)
              };
  
              await s3Client.send(new PutObjectCommand(uploadParams));
              videoUrls[quality.resolution] = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${outputPath}`;
              resolve();
            })
            .on('error', reject)
            .save(outputPath);
        });
      }
  
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'TRANSCODED',
          videoUrls: videoUrls
        }
      });
  
    } catch (error) {
      console.error('Video processing failed', error);
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'FAILED' }
      });
    }
  }
)