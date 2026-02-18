require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");
const tasksRouterV1 = require("./routes/v1/tasks");

const app = express();
const PORT = process.env.PORT || 4000;

connectDB().catch((error) => {
  console.error("Failed to connect to MongoDB", error);
  process.exit(1);
});

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/v1/tasks", tasksRouterV1);

app.get("/", (req, res) => {
  res.send("Med-cert backend API is online");
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});
