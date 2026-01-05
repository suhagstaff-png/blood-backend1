const express = require('express');
const bloodBankController = require('../controllers/bloodBankController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/', bloodBankController.getAllBloodBanks);
router.get('/stats', bloodBankController.getBloodBankStats);
router.get('/:id', bloodBankController.getBloodBank);

// Protected routes (require authentication)
router.use(authController.protect);

// Restrict to admin for modification routes
router.post('/', authController.restrictTo('admin'), bloodBankController.createBloodBank);
router.patch('/:id', authController.restrictTo('admin'), bloodBankController.updateBloodBank);
router.delete('/:id', authController.restrictTo('admin'), bloodBankController.deleteBloodBank);

module.exports = router;