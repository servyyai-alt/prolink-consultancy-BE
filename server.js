const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const socketHandler = require('./sockets/socketHandler');
const { getClientUrls, getPrimaryClientUrl } = require('./utils/clientUrls');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const teamMemberRoutes = require('./routes/teamMemberRoutes');
const blogRoutes = require('./routes/blogRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const contactRoutes = require('./routes/contactRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const cvRoutes = require('./routes/cvRoutes');
const campusRoutes = require('./routes/campusRoutes');
const eventRoutes = require('./routes/eventRoutes');
const cateringRoutes = require('./routes/cateringRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const brochureRoutes = require('./routes/brochureRoutes');

const app = express();
const httpServer = createServer(app);

const allowedClientUrls = getClientUrls();
const primaryClientUrl = getPrimaryClientUrl();

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);

  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedClientUrls.includes(normalizedOrigin)) return callback(null, true);

  return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
};

app.set('clientUrl', primaryClientUrl);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
socketHandler(io);
app.set('io', io);

// Connect DB
connectDB();

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// CORS
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ProLink API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/team-members', teamMemberRoutes);
app.use('/api/v1/blogs', blogRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/cv', cvRoutes);
app.use('/api/v1/campus', campusRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/catering', cateringRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/brochures', brochureRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 ProLink Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  httpServer.close(() => process.exit(1));
});

module.exports = app;
