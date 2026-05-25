import dotenv from 'dotenv';
import prisma from './prisma';

dotenv.config();

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;