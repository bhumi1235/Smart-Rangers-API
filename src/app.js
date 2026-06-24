import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import guardRoutes from "./routes/guardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dutyTypeRoutes from "./routes/dutyTypeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import errorHandler from "./middleware/errorMiddleware.js";

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));
// Admin app logo: place logo at public/logo.png and use /logo.png or set env APP_LOGO_URL
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.send("API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/guards", guardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/duty-types", dutyTypeRoutes);
app.use("/api/admin", adminRoutes); // Mounts /dashboard, /supervisors, /create-admin

app.use(errorHandler);

export default app;

