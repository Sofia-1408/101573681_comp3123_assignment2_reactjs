const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs').promises;

const protect = require('../middleware/authMiddleware');

//middleware for uploading profile pictures
const upload = require('../middleware/uploadMiddleware');
//verify uploaded images
const verifyImage = require('../middleware/verifyImageMiddleware');

const {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    searchEmployees
} = require('../controllers/employeeController');

const router = express.Router();

//validate employee information
const validate = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        //remove file if employe validation fails
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Failed to remove invalid upload:', error.message);
                }
            }
        }
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    next();
};

//handle multer upload errors
const uploadProfilePicture = (req, res, next) => {
    upload.single('profile_picture')(req, res, (error) => {
        if (!error) {
            return next();
        }
        //handle file size 
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    message: 'Profile picture must be 2 MB or smaller'
                });
            }
            return res.status(400).json({
                message: 'Invalid file upload'
            });
        }
        //handle unsupported file types
        if (error.message === 'Only image files are allowed') {
            return res.status(400).json({
                message: 'Only image files are allowed'
            });
        }
        //pass unexpected errors to the existing error handler
        next(error);
    });
};

const employeeValidation = [
    body('first_name').isString().trim().notEmpty().isLength({ max: 100 }),
    body('last_name').isString().trim().notEmpty().isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('position').isString().trim().notEmpty().isLength({ max: 100 }),
    body('salary').isFloat({ min: 0 }),
    body('date_of_joining').isISO8601(),
    body('department').isString().trim().notEmpty().isLength({ max: 100 })
];

const updateValidation = [
    body('first_name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    body('last_name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('position').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    body('salary').optional().isFloat({ min: 0 }),
    body('date_of_joining').optional().isISO8601(),
    body('department').optional().isString().trim().notEmpty().isLength({ max: 100 })
];

const validateId = (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            message: 'Invalid employee ID'
        });
    }

    next();
};

const validateQueryId = (req, res, next) => {
    if (!mongoose.isValidObjectId(req.query.eid)) {
        return res.status(400).json({
            message: 'Invalid employee ID'
        });
    }

    next();
};

//all employee routes require authentication
router.use(protect);

//create an employee, and optionally with a profile picture 
router.post(
    '/',
    uploadProfilePicture,
    verifyImage,
    employeeValidation,
    validate,
    createEmployee
);

//retrieve all employees belonging to the logged user
router.get('/', getEmployees);

//search employees by department and position
router.get('/search', searchEmployees);

//get an employee by ID
router.get('/:id', validateId, getEmployeeById);

//update an employee, and optionally replacing their profile picture
router.put(
    '/:id',
    validateId,
    uploadProfilePicture,
    verifyImage,
    updateValidation,
    validate,
    updateEmployee
);

//delete an employee
router.delete('/', validateQueryId, deleteEmployee);

module.exports = router;