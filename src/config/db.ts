import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // 1. Read the Connection String from .env
    // If .env is missing, it defaults to 'aicompliance' 
    const dbName = process.env.MONGODB_URI || 'mongodb://localhost:27017/aicompliance' 
    
    // 2. Open the Connection
    await mongoose.connect(dbName);
    
    console.log(`MongoDB connected to: ${dbName}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    // Stop the app if DB is dead
    process.exit(1);
  }
};

export default connectDB;