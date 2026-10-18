import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 does not automatically catch errors thrown inside an async
// route handler -- an unhandled rejection there crashes the whole process.
// Wrapping every handler in this forwards the error to next(), which the
// error middleware in server.ts turns into a proper JSON response instead.
export function asyncHandler(fn: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}