import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithCache = global as typeof global & { _mongooseCache?: MongooseCache };
const cached: MongooseCache = globalWithCache._mongooseCache || { conn: null, promise: null };
globalWithCache._mongooseCache = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI as string);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}