const Employee = require('../models/Employee');
const fs = require('fs').promises;
const path = require('path');

const allowedFields = [
    'first_name',
    'last_name',
    'email',
    'position',
    'salary',
    'date_of_joining',
    'department'
];

const filterFields = (data) => {
    const filtered = {};

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            filtered[field] = data[field];
        }
    }

    return filtered;
};
//delete a stored profile picture when it is no longer needed
const deleteProfilePicture = async (picturePath) => {
    if (!picturePath) {
        return;
    }
    //using file name so there is no access to other folders
    const filename = path.basename(picturePath);
    const fullPath = path.join(__dirname, '..', 'uploads', filename);
    try {
        await fs.unlink(fullPath);
    } catch (error) {
        //dont let a missing file stop the whole information
        if (error.code !== 'ENOENT') {
            console.error('Failed to delete profile picture:', error.message);
        }
    }
};

exports.createEmployee = async (req, res, next) => {
    try {
        const employeeData = {
            ...filterFields(req.body),
            user: req.user.id
        };
        //store uploaded pictures relative URL 
        if (req.file) {
            employeeData.profile_picture = `/uploads/${req.file.filename}`;
        }
        const employee = await Employee.create(employeeData);

        res.status(201).json({
            message: 'Employee created successfully',
            employee
        });
    } catch (error) {
        //remove picture if database creation fails
        if (req.file) {
            await deleteProfilePicture(req.file.filename);
        }
        next(error);
    }
};

exports.getEmployees = async (req, res, next) => {
    try {
        const employees = await Employee.find({
            user: req.user.id
        });

        res.status(200).json(employees);
    } catch (error) {
        next(error);
    }
};

exports.getEmployeeById = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!employee) {
            return res.status(404).json({
                message: 'Employee not found'
            });
        }

        res.status(200).json(employee);
    } catch (error) {
        next(error);
    }
};

exports.updateEmployee = async (req, res, next) => {
    try {
        const updates = filterFields(req.body);
        const query = {
            _id: req.params.id,
            user: req.user.id
        };
        let previousEmployee = null;
        //get the old picture before replacing it 
        if (req.file) {
            previousEmployee = await Employee.findOne(query)
                .select('profile_picture');
            updates.profile_picture = `/uploads/${req.file.filename}`;
        }

        const employee = await Employee.findOneAndUpdate(
            query,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        );

        if (!employee) {
            //remove the uploaded file if the employee wasnt found or doesnt belong to the user
            if (req.file) {
                await deleteProfilePicture(req.file.filename);
            }
            return res.status(404).json({
                message: 'Employee not found'
            });
        }
        //remove the previous picture after it is replaced by a new picture
        if (req.file && previousEmployee?.profile_picture) {
            await deleteProfilePicture(previousEmployee.profile_picture);
        }
        res.status(200).json({
            message: 'Employee updated successfully',
            employee
        });
    } catch (error) {
        //delete the uploaded file if the updating fails
        if (req.file) {
            await deleteProfilePicture(req.file.filename);
        }
        next(error);
    }
};

exports.deleteEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findOneAndDelete({
            _id: req.query.eid,
            user: req.user.id
        });

        if (!employee) {
            return res.status(404).json({
                message: 'Employee not found'
            });
        }

        //when employee is deleted make sure the picture is deleted with it
        if (employee.profile_picture) {
            await deleteProfilePicture(employee.profile_picture);
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

//regex characters in user provided search text
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

//search employees by their department and / or  position
exports.searchEmployees = async (req, res, next) => {
    try {
        const { department, position } = req.query;

        //one search paramater has to be provided
        if (department === undefined && position === undefined) {
            return res.status(400).json({
                message: 'Department or position is required'
            });
        }

        //validate search paramaters
        for (const value of [department, position]) {
            if (value !== undefined &&
                (typeof value !== 'string' ||
                 !value.trim() ||
                 value.length > 100)) {
                return res.status(400).json({
                    message: 'Invalid search parameter'
                });
            }
        }

        //only search employees owned by the logged user
        const filter = {
            user: req.user.id
        };

        //not case sensitive, department search
        if (department !== undefined) {
            filter.department = {
                $regex: escapeRegex(department.trim()),
                $options: 'i'
            };
        }

        //not case sensitive, position search
        if (position !== undefined) {
            filter.position = {
                $regex: escapeRegex(position.trim()),
                $options: 'i'
            };
        }

        const employees = await Employee.find(filter);

        res.status(200).json(employees);
    } catch (error) {
        next(error);
    }
};