const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

// Email verification routes (ADD THESE)
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Protect all routes after this middleware
router.use(authController.protect);

router.patch('/update-password', authController.updatePassword);
router.get('/me', authController.getMe);

module.exports = router;