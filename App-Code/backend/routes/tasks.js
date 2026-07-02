import express from "express";
import Task from "../models/Task.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const text = String(req.body.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Task text is required" });
  }

  try {
    const task = new Task({ text });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).end();
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid task id" });
    }
    next(error);
  }
});

export default router;
