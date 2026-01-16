import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db'; // <--- IMPORT THIS
import apiRoutes from './routes/api';
import { startScheduler } from './services/scheduler';
import { clerkMiddleware } from '@clerk/express'
dotenv.config();

// --- CONNECT TO DATABASE ---
connectDB(); 
startScheduler();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: [
      'https://aicompliance.vanndavidteng.com',
      'http://localhost:5173', // dev
      'http://sitesafe.local', // dev
    ],
    credentials: true,
  }));
app.use(express.json());  

app.use(clerkMiddleware())
app.use('/api', apiRoutes);


app.get('/', (req, res) => {
  res.redirect('/api/health');
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});