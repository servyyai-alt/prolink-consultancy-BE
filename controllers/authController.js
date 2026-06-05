const crypto = require('crypto');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');
const { generateTokenPair, verifyRefreshToken, generateAccessToken } = require('../utils/tokens');
const { sendInBackground, sendTemplateEmail } = require('../utils/emailService');
const { createNotification, notifyAdmins } = require('../utils/notificationService');
const { getPrimaryClientUrl } = require('../utils/clientUrls');

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

// @POST /api/v1/auth/register
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, role } = req.body;
    const normalizedPhone = `${phone || ''}`.trim();

    if (!normalizedPhone) {
      return sendError(res, 400, 'Phone number is required.', { phone: 'Phone number is required.' });
    }

    if (!INDIAN_MOBILE_REGEX.test(normalizedPhone)) {
      return sendError(res, 400, 'Enter a valid 10-digit Indian mobile number.', {
        phone: 'Enter a valid 10-digit Indian mobile number.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return sendError(res, 409, 'Email already registered.');

    const allowedRoles = ['job_seeker', 'employer'];
    const userRole = allowedRoles.includes(role) ? role : 'job_seeker';

    const user = await User.create({ firstName, lastName, email, password, phone: normalizedPhone, role: userRole });

    const otp = user.generateOTP();
    await user.save();

    await notifyAdmins(req, {
      sender: user._id,
      type: 'system',
      title: userRole === 'employer' ? 'New Employer Registered' : 'New Job Seeker Registered',
      message: `${user.firstName} ${user.lastName} registered as ${userRole.replace('_', ' ')}.`,
      link: '/admin/users',
      data: {
        userId: user._id.toString(),
        role: userRole,
      },
    });

    sendSuccess(res, 201, 'Registration successful. Please verify your email.', {
      data: { userId: user._id, email: user.email },
    });

    sendInBackground(() => sendTemplateEmail(email, 'otp', otp, firstName), 'Registration OTP email');
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

    await createNotification(req, {
      recipient: user._id,
      type: 'account_verified',
      title: 'Account Verified',
      message: 'Your email has been verified successfully.',
      link: user.role === 'employer' ? '/employer' : '/dashboard',
    });

    sendSuccess(res, 200, 'Email verified successfully.', {
      data: { accessToken, refreshToken, user: sanitizeUser(user) },
    });

    sendInBackground(() => sendTemplateEmail(email, 'welcomeEmail', user.firstName), 'Welcome email');
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
    if (!user.isVerified) return sendError(res, 403, 'Please verify your email first.');
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

    const resetLink = `${getPrimaryClientUrl()}/reset-password/${resetToken}`;
    sendSuccess(res, 200, 'If this email exists, a reset link has been sent.');

    sendInBackground(() => sendTemplateEmail(email, 'passwordReset', resetLink, user.firstName), 'Password reset email');
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

    sendSuccess(res, 200, 'OTP resent successfully.');

    sendInBackground(() => sendTemplateEmail(email, 'otp', otp, user.firstName), 'Resend OTP email');
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
