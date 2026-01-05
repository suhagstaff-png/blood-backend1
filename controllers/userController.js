// controllers/userController.js
const User = require('../models/UserModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(key => {
    if (allowedFields.includes(key) && obj[key] !== undefined) newObj[key] = obj[key];
  });
  return newObj;
};

exports.updateMe = async (req, res, next) => {
  try {
    // 1) Prevent password update via this route
    if (req.body.password || req.body.passwordConfirm) {
      return res.status(400).json({
        status: 'error',
        message: 'This route is not for password updates. Use /update-password.'
      });
    }

    // 2) Filter allowed fields to update
    const allowed = ['fullName', 'phone', 'bloodGroup', 'division', 'district', 'upazila', 'area', 'wantToDonate'];
    const filteredBody = filterObj(req.body, ...allowed);

    // 3) Update user
    const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser }
    });
  } catch (err) {
    console.error('Error in updateMe:', err);

    // Handle duplicate key error (e.g., phone or email unique)
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        status: 'error',
        message: `দুঃখিত: '${dupField}' ইতোমধ্যেই ব্যবহার করা হয়েছে। অন্য একটি দিন।`
      });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(el => el.message).join(' | ');
      return res.status(400).json({ status: 'error', message: messages });
    }

    res.status(500).json({
      status: 'error',
      message: 'প্রোফাইল আপডেট করতে ত্রুটি হয়েছে'
    });
  }
};
