// controllers/reviewController.js
const Review = require('../models/ReviewModel');

exports.createReview = async (req, res) => {
  try {
    const { division, name, email, rating, comment, userId } = req.body;

    // Basic validation (mongoose will also validate)
    if (!division || !name || !email || !comment) {
      return res.status(400).json({ status: 'error', message: 'সব প্রয়োজনীয় ফিল্ড দিন' });
    }

    const review = await Review.create({
      division,
      name,
      email,
      rating: Number(rating) || 5,
      comment,
      userId: userId || null
    });

    res.status(201).json({
      status: 'success',
      data: { review }
    });
  } catch (err) {
    console.error('Error creating review:', err);
    // validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(' | ');
      return res.status(400).json({ status: 'error', message: messages });
    }
    res.status(500).json({ status: 'error', message: 'রিভিউ তৈরি করতে ব্যর্থ হয়েছে' });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { division } = req.query;
    const filter = {};
    if (division) filter.division = division;

    // newest first
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews }
    });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ status: 'error', message: 'রিভিউ লোড করতে ব্যর্থ' });
  }
};

// optional: delete a review (admin)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }
    res.status(200).json({ status: 'success', message: 'Review deleted' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ status: 'error', message: 'Delete failed' });
  }
};
