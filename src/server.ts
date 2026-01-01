import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// All routes defined in src/routes/api.ts will be prefixed with /api
// e.g. /api/health, /api/upload
app.use('/api', apiRoutes);

// Optional: Redirect root to health check for convenience
app.get('/', (req, res) => {
  res.redirect('/api/health');
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});