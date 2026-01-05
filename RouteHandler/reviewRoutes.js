// routes/reviewRoutes.js
const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController'); // optional if you protect routes

const router = express.Router();

// Public: create review
router.post('/', reviewController.createReview);

// Public: get reviews (optionally filtered by ?division=dhaka)
router.get('/', reviewController.getReviews);

// Optional admin-only: delete review
// router.delete('/:id', authController.protect, authController.restrictTo('admin'), reviewController.deleteReview);

module.exports = router;
