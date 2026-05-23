const crypto = require('crypto');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');
const { generateTokenPair, verifyRefreshToken, generateAccessToken } = require('../utils/tokens');
const { sendTemplateEmail } = require('../utils/emailService');

// @POST /api/v1/auth/register
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return sendError(res, 409, 'Email already registered.');

    const allowedRoles = ['job_seeker', 'employer'];
    const userRole = allowedRoles.includes(role) ? role : 'job_seeker';

    const user = await User.create({ firstName, lastName, email, password, phone, role: userRole });

    const otp = user.generateOTP();
    await user.save();

    try {
      await sendTemplateEmail(email, 'otp', otp, firstName);
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message);
    }

    sendSuccess(res, 201, 'Registration successful. Please verify your email.', {
      data: { userId: user._id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/verify-otp
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return sendError(res, 404, 'User not found.');
    if (user.isVerified) return sendError(res, 400, 'Email already verified.');

    if (!user.otp?.code || user.otp.code !== otp) return sendError(res, 400, 'Invalid OTP.');
    if (new Date() > user.otp.expiry) return sendError(res, 400, 'OTP expired. Please request a new one.');

    user.isVerified = true;
    user.otp = undefined;
    const { accessToken, refreshToken } = generateTokenPair(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save();

    try { await sendTemplateEmail(email, 'welcomeEmail', user.firstName); } catch (_) {}

    sendSuccess(res, 200, 'Email verified successfully.', {
      data: { accessToken, refreshToken, user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 401, 'Invalid email or password.');
    }
    // OTP verification check is temporarily bypassed for login.
    // if (!user.isVerified) return sendError(res, 403, 'Please verify your email first.');
    if (!user.isActive)   return sendError(res, 401, 'Account deactivated.');
    if (user.isBlocked)   return sendError(res, 403, 'Account blocked. Contact support.');

    const { accessToken, refreshToken } = generateTokenPair(user._id, user.role);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    sendSuccess(res, 200, 'Login successful.', {
      data: { accessToken, refreshToken, user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/refresh-token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 401, 'Refresh token required.');

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return sendError(res, 401, 'Invalid or expired refresh token.');
    }

    const accessToken = generateAccessToken(user._id, user.role);
    sendSuccess(res, 200, 'Token refreshed.', { data: { accessToken } });
  } catch (error) {
    if (error.name === 'TokenExpiredError') return sendError(res, 401, 'Refresh token expired. Please login again.');
    next(error);
  }
};

// @POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always send success to prevent email enumeration
    if (!user) return sendSuccess(res, 200, 'If this email exists, a reset link has been sent.');

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    try {
      await sendTemplateEmail(email, 'passwordReset', resetLink, user.firstName);
    } catch (_) {}

    sendSuccess(res, 200, 'If this email exists, a reset link has been sent.');
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/reset-password/:token
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: new Date() },
    });

    if (!user) return sendError(res, 400, 'Invalid or expired reset token.');

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshToken = undefined;
    await user.save();

    sendSuccess(res, 200, 'Password reset successful. Please login.');
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/resend-otp
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(res, 404, 'User not found.');
    if (user.isVerified) return sendError(res, 400, 'Email already verified.');

    const otp = user.generateOTP();
    await user.save();

    await sendTemplateEmail(email, 'otp', otp, user.firstName);
    sendSuccess(res, 200, 'OTP resent successfully.');
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/auth/logout
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    sendSuccess(res, 200, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    sendSuccess(res, 200, 'User fetched.', { data: { user } });
  } catch (error) {
    next(error);
  }
};

const sanitizeUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  profile: user.profile,
  company: user.company,
  isVerified: user.isVerified,
  subscription: user.subscription,
});
