const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const Email = require('../utils/email');
const AppError = require('../utils/appError');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = async (req, res, next) => {
  console.log(req.body);
  try {
    const {
      fullName,
      email,
      phone,
      bloodGroup,
      division,
      district,
      upazila,
      area,
      password,
      passwordConfirm,
      wantToDonate
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { phone }] 
    });
    
    if (existingUser) {
      return next(new AppError('User with this email or phone already exists', 400));
    }

    const newUser = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      phone,
      bloodGroup,
      division,
      district,
      upazila,
      area,
      password,
      passwordConfirm,
      wantToDonate: wantToDonate !== undefined ? wantToDonate : true
    });

    // Generate email verification token and send email
    try {
      const verificationToken = newUser.createEmailVerificationToken();
      await newUser.save({ validateBeforeSave: false });

      const verificationURL = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
      
      await new Email(newUser, verificationURL).sendVerification();
    } catch (err) {
      console.log('Error sending verification email:', err);
      // Don't throw error if email fails, just log it
    }

    createSendToken(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

// Add email verification endpoint
exports.verifyEmail = async (req, res, next) => {
  try {
    // 1) Get token from URL and hash it
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // 2) Find user with this token and check if not expired
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    // 3) If token is invalid or expired
    if (!user) {
      return next(new AppError('Verification token is invalid or has expired', 400));
    }

    // 4) If everything is ok, mark email as verified and clear token
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // 5) Send success response
    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully! You can now login.'
    });
  } catch (error) {
    next(error);
  }
};

// Add resend verification email endpoint
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    // 1) Check if email exists
    if (!email) {
      return next(new AppError('Please provide email address', 400));
    }

    // 2) Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return next(new AppError('No user found with this email address', 404));
    }

    // 3) Check if email is already verified
    if (user.isEmailVerified) {
      return next(new AppError('Email is already verified', 400));
    }

    // 4) Generate new verification token and send email
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationURL = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
    
    await new Email(user, verificationURL).sendVerification();

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent successfully!'
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +loginAttempts +lockUntil');
    
    if (!user) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Check if account is locked
    if (user.isLocked) {
      return next(new AppError('Account temporarily locked due to too many failed attempts. Try again later.', 423));
    }

    // 4) Check if email is verified
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email address before logging in. Check your email for verification link.', 401));
    }

    // 5) Check if password is correct
    const correct = await user.correctPassword(password, user.password);
    
    if (!correct) {
      await user.incrementLoginAttempts();
      return next(new AppError('Incorrect email or password', 401));
    }

    // 6) If everything ok, reset login attempts and send token
    if (user.loginAttempts > 0 || user.lockUntil) {
      await User.findByIdAndUpdate(user._id, {
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
      });
    }

    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // 1) Getting token and check if it's there
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    // 5) Check if user is active
    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated.', 401));
    }

    // 6) Check if email is verified
    if (!currentUser.isEmailVerified) {
      return next(new AppError('Please verify your email address to access this resource.', 401));
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

exports.forgotPassword = async (req, res, next) => {
  try {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) {
      return next(new AppError('There is no user with that email address.', 404));
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    try {
      const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
      
      await new Email(user, resetURL).sendPasswordReset();

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    // 1) Get user based on the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Update changedPasswordAt property for the user
    // 4) Log the user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    // 1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    // 2) Check if POSTed current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
      return next(new AppError('Your current password is wrong.', 401));
    }

    // 3) If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};