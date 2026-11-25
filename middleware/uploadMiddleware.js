
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

//locations for files
const uploadDirectory = path.join(__dirname, '..', 'uploads');
//creatre a folder(if it doesn't exist)
fs.mkdirSync(uploadDirectory, { recursive: true });

//configure local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        //generate unique file names so no conflicts happen
        const extension = path.extname(file.originalname).toLowerCase();
        const uniqueName = crypto.randomUUID() + extension;

        cb(null, uniqueName);
    }
});
//accept image formats
const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];
const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};
//enforce maximum upload size of 2 MB
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});
module.exports = upload;