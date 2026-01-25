import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db'; // <--- IMPORT THIS
import apiRoutes from './routes/api';
import { startScheduler } from './services/scheduler';
import { clerkMiddleware } from '@clerk/express'
dotenv.config();
// // Automatic Switching based on .env
// const isCloud = process.env.USE_CLOUD === 'true';

// export const uploadMiddleware = isCloud 
//   ? require("../middleware/uploadMiddleware").upload 
//   : require("../middleware/uploadLocal").upload;

// export const jobProducer = isCloud
//   ? require("../queues/sqsProducer").addDocumentJob
//   : require("../queues/documentQueue").addDocumentJob;

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

// Only listen if this file is run directly (not imported by tests)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

export default app;