import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { restrictScopedTokens } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { env } from './config/env';

const app: Application = express();

// Trust reverse proxies (e.g. Nginx, Cloudflare) for accurate client IP resolution
app.set('trust proxy', 1);

// Security and utility middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use(restrictScopedTokens);
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
