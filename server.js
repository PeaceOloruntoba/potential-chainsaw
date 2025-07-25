require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const photoRoutes = require("./routes/photoRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
// const paymentRoutes = require("./routes/paymentRoutes");
const logger = require("./utils/logger");
const fs = require("fs");
const path = require("path");

// Create uploads directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  logger.info("Created uploads directory");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_PROD,
  process.env.CLIENT_URL_STAGING,
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT"],
  },
});

app.use((req, res, next) => {
  req.app.set("io", io);
  next();
});

app.use(cors({ origin: allowedOrigins }));

app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/payment", paymentRoutes);

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}, Stack: ${err.stack}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
    },
  });
});

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on("join", (userId) => {
    socket.join(userId);
    logger.info(`User ${userId} joined socket room`);
  });
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8080;
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  });
