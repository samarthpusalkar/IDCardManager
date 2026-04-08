import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import cardsRoutes from './routes/cards.js';
import documentsRoutes from './routes/documents.js';
import templatesRoutes from './routes/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/templates', templatesRoutes);

// Serve Static Frontend Layout in Production
const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath));

// Fallback to index.html for SPA routing (if built)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'), err => {
    if (err) res.status(404).send('Not Found');
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

const PORT = process.env.PORT || 9902;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
