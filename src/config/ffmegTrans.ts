//TESTING

// import { exec } from "child_process";
// import { promisify } from "util";

// const execAsync = promisify(exec);

// export const transcodeVideo = async (inputPath: string, outputPath: string) => {
//     try {
//         await execAsync(`ffmpeg -i ${inputPath} -vf scale=1280:720 -crf 23 -preset veryfast ${outputPath}`);
//     } catch (error) {
//         console.error("FFmpeg Error:", error);
//         throw new Error("Video transcoding failed");
//     }
// };
