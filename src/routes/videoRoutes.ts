import express from "express";
import { feed, GetVideoData, updateTimestamp, uploadVideo} from "../controller/videoController";
import { protectRoute } from "../middleware/auth";
import multer from 'multer'
const upload = multer({ dest: 'uploads/' });


const router = express.Router();

router.get('/feed', feed);
router.post('/upload', protectRoute, upload.single('file'), uploadVideo)
router.get('/:videoId', GetVideoData);

router.put('/:videoId/time', protectRoute, updateTimestamp);

export default router;

