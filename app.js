const express = require('express');
const mongoose = require('mongoose');
const dotenv = require("dotenv");
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Route handlers
const authHandler = require('./RouteHandler/authHandler');
const adminHandler = require('./RouteHandler/adminHandler');
const donationRoutes = require('./RouteHandler/donationRoutes');
const statsRoutes = require('./RouteHandler/statsRoutes');
const reviewRoutes = require('./RouteHandler/reviewRoutes');
const bloodBankRoutes = require('./RouteHandler/bloodBankRoutes')
const userRoutes = require('./controllers/userRoutes')
const searchRequestRoutes = require('./controllers/searchRequestRoutes')
const app = express();
dotenv.config();

// Security middleware
app.use(helmet()); // Security headers
app.use(mongoSanitize()); // Data sanitization
app.use(xss()); // XSS protection
app.use(hpp()); // HTTP Parameter Pollution protection


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);
// mongodb+srv://suhag:suhag@cluster0.oizny1m.mongodb.net/blood?appName=Cluster0
// Database connection with improved error handling
mongoose.connect( `mongodb+srv://suhag:suhag@cluster0.oizny1m.mongodb.net/blood?appName=Cluster0`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Database connection successful');
})
.catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

app.use(express.json({ limit: '10kb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Routes
app.use('/api/auth', authHandler);
app.use('/api/admin', adminHandler);
app.use('/api/blood-banks', bloodBankRoutes);
app.use('/api/search-requests', searchRequestRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reviews', reviewRoutes);
// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: "Server is running!" });
});

// Handle undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global error handler
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    // Production mode
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // Programming or unknown errors
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
      });
    }
  }
};

app.use(errorHandler);

module.exports = app;