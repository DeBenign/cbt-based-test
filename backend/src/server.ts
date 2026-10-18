import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const PORT = process.env.PORT || 5050;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`CBT backend running on port ${PORT}`)))
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });