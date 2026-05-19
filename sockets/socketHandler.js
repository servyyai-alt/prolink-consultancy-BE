const jwt = require('jsonwebtoken');

const connectedUsers = new Map();

const socketHandler = (io) => {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);
    connectedUsers.set(socket.userId, socket.id);

    socket.join(`user:${socket.userId}`);

    socket.on('join_room', (room) => {
      socket.join(room);
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
    });

    socket.on('send_message', (data) => {
      const { to, message } = data;
      const recipientSocketId = connectedUsers.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_message', { from: socket.userId, message, timestamp: new Date() });
      }
    });

    socket.on('typing', (data) => {
      const recipientSocketId = connectedUsers.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user_typing', { from: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.userId);
      console.log(`🔌 User disconnected: ${socket.userId}`);
    });
  });

  // Helper to emit notification to specific user
  io.sendNotification = (userId, notification) => {
    io.to(`user:${userId}`).emit('notification', notification);
  };
};

module.exports = socketHandler;
