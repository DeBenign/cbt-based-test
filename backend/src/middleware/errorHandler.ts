import { Request, Response, NextFunction } from "express";

// Must be registered LAST, after all routes, and take 4 params so Express
// recognizes it as an error handler.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "That file is too large. The limit is 4 MB." });
  }

  // Mongoose validation error (required field missing, enum mismatch, etc.)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({ error: messages.join("; ") });
  }

  // Mongoose cast error -- most commonly a bad ObjectId string, like a
  // subject/class ID that doesn't look like one (e.g. someone typed a
  // name instead of picking from a dropdown).
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid value for "${err.path}" -- expected a valid ID` });
  }

  // Duplicate key (e.g. email unique index)
  if (err.code === 11000) {
    return res.status(409).json({ error: "That value is already in use" });
  }

  return res.status(500).json({ error: "Something went wrong on the server" });
}