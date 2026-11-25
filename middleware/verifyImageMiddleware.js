const fs = require('fs').promises;
const path = require('path');

//check common image file types
const detectImageType = (buffer) => {
    //JPEG
    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return 'image/jpeg';
    }
    //PNG
    if (
        buffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )
    ) {
        return 'image/png';
    }
    //GIF
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
        return 'image/gif';
    }
    //WebP
    if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'image/webp';
    }
    return null;
};

const verifyImage = async (req, res, next) => {
    //make proile picture optional
    if (!req.file) {
        return next();
    }
    try {
        //read first 12 bytes of uploaded file
        const handle = await fs.open(req.file.path, 'r');
        const buffer = Buffer.alloc(12);
        try {
            await handle.read(buffer, 0, 12, 0);
        } finally {
            await handle.close();
        }
        const detectedType = detectImageType(buffer);
        //expected extensions for each supported image type are valid
        const validExtensions = {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp']
        };
        const extension = path.extname(
            req.file.originalname
        ).toLowerCase();
        const isValid =
            detectedType !== null &&
            detectedType === req.file.mimetype &&
            validExtensions[detectedType].includes(extension);
        if (!isValid) {
            //remove rejected file
            await fs.unlink(req.file.path);
            return res.status(400).json({
                message: 'Invalid image file'
            });
        }
        next();
    } catch (error) {
        //clean up in case of an error
        try {
            await fs.unlink(req.file.path);
        } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
                console.error(
                    'Failed to clean up upload:',
                    cleanupError.message
                );
            }
        }
        next(error);
    }
};
module.exports = verifyImage;