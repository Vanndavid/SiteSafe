import express from 'express';
import './types/express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db';
import apiRoutes from './routes/api';
import { startScheduler } from './services/scheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({
  origin: [
    'https://aicompliance.vanndavidteng.com',
    'http://localhost:5173',
    'http://sitesafe.local',
    'https://sitesafe.local',
  ],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.redirect('/api/health');
});

if (require.main === module) {
  connectDB();
  startScheduler();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export default app;
