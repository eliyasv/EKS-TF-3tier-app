import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import client from "prom-client";

import connectDB from "./db.js";
import taskRoutes from "./routes/tasks.js";

dotenv.config();

const app = express();

const requiredEnv = ["MONGO_CONN_STR"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error("Missing required environment variables:", missingEnv.join(", "));
  process.exit(1);
}

connectDB();

app.use(cors());
app.use(express.json());

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const requestCounter = new client.Counter({
  name: "todo_app_http_requests_total",
  help: "Total number of HTTP requests received",
  labelNames: ["method", "route", "status"],
});

const requestDurationSeconds = new client.Histogram({
  name: "todo_app_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

app.use((req, res, next) => {
  const start = process.hrtime();
  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    const route = req.route?.path ?? req.path;
    requestCounter.inc({ method: req.method, route, status: res.statusCode });
    requestDurationSeconds.observe({ method: req.method, route, status: res.statusCode }, duration);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(3)}s`);
  });
  next();
});

// --- Health Check Endpoints ---
let lastReadyState = null;

app.get("/healthz", (req, res) => {
  res.status(200).send("Healthy");
});

app.get("/ready", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  if (isDbConnected !== lastReadyState) {
    console.log(`DB Ready State Changed: ${mongoose.connection.readyState}`);
    lastReadyState = isDbConnected;
  }

  if (isDbConnected) {
    res.status(200).json({ status: "ready", db: "connected" });
  } else {
    res.status(503).json({ status: "not ready", db: "disconnected" });
  }
});

app.get("/started", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    res.status(200).send("Started");
  } else {
    res.status(503).send("Starting");
  }
});

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    res.status(500).json({ error: "Could not collect metrics" });
  }
});

app.use("/api/tasks", taskRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
