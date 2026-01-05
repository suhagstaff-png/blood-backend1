// routes/userRoutes.js
const express = require('express');
const User = require('../models/UserModel');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

/**
 * Public routes (no auth)
 */

// Get all active donors (public)
router.get('/donors', async (req, res) => {
  try {
    const donors = await User.find({
      // wantToDonate: true,
      isEmailVerified: true,
      isActive: true
    }).select('-password -passwordConfirm -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');

    res.status(200).json({
      status: 'success',
      results: donors.length,
      data: {
        users: donors
      }
    });
  } catch (error) {
    console.error('Error fetching donors:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching donors'
    });
  }
});


/**
 * Protected routes (require login)
 * Apply authController.protect for following routes
 */
router.use(authController.protect);

// Update current logged-in user's profile
router.patch('/update-me', userController.updateMe);

// Update donor profile (when selected) - protected (admin or authorized users can call)
router.put('/:id/donor-selected', async (req, res) => {
  try {
    const donor = await User.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { timesSelected: 1 },
        lastSelected: new Date()
      },
      { new: true }
    ).select('-password -passwordConfirm');

    if (!donor) {
      return res.status(404).json({
        status: 'error',
        message: 'Donor not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: donor
      }
    });
  } catch (error) {
    console.error('Error updating donor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating donor'
    });
  }
});

module.exports = router;
