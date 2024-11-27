"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const videoController_1 = require("../controller/videoController");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ dest: 'uploads/' });
const router = express_1.default.Router();
router.get('/feed', videoController_1.feed);
router.post('/upload', auth_1.protectRoute, upload.single('file'), videoController_1.uploadVideo);
router.get('/:videoId', videoController_1.GetVideoData);
router.put('/:videoId/time', auth_1.protectRoute, videoController_1.updateTimestamp);
exports.default = router;
