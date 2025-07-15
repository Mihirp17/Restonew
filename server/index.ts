import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cron from 'node-cron';
import { storage } from './storage';
import { errorMiddleware } from './lib/error-handler';

// Process monitoring to detect event loop blocking
// let lastCheck = Date.now();
// const BLOCK_THRESHOLD = 100; // 100ms threshold for considering the event loop blocked

// Performance monitoring
let performanceStats = {
  totalCleanupRuns: 0,
  totalCleanupTime: 0,
  averageCleanupTime: 0,
  maxCleanupTime: 0,
  lastCleanupTime: 0
};

// setInterval(() => {
//   const now = Date.now();
//   const timeSinceLastCheck = now - lastCheck;
  
//   // If more than 100ms have passed, the event loop might be blocked
//   if (timeSinceLastCheck > BLOCK_THRESHOLD) {
//     console.warn(`[MONITOR] Event loop may be blocked: ${timeSinceLastCheck}ms since last check (threshold: ${BLOCK_THRESHOLD}ms)`);
//   }
  
//   lastCheck = now;
// }, 50);

// Log performance stats every hour
setInterval(() => {
  if (performanceStats.totalCleanupRuns > 0) {
    console.log(`[PERFORMANCE] Cleanup stats: runs=${performanceStats.totalCleanupRuns}, avg=${performanceStats.averageCleanupTime.toFixed(2)}ms, max=${performanceStats.maxCleanupTime}ms, last=${performanceStats.lastCleanupTime}ms`);
  }
}, 3600000); // Every hour

// Debug logs to check environment variables
console.log("Starting server initialization...");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "***" : "not set");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "***" : "not set");
// Stripe integration removed

// Check for required environment variables
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please create a .env file with these variables.');
  process.exit(1);
}

const app = express();

// Security middleware
if (process.env.NODE_ENV === "development") {
  // Disable Helmet's CSP in development
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  
  // Add CSP meta tag middleware for development
  app.use((req, res, next) => {
    if (req.path === '/') {
      res.setHeader('Content-Security-Policy', `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        script-src-elem 'self' 'unsafe-inline';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data:;
        connect-src 'self' ws: wss: http://localhost:3000 ws://localhost:3000;
        frame-src 'self';
        object-src 'none';
        media-src 'self';
        worker-src 'self' blob:;
      `.replace(/\s+/g, ' ').trim());
    }
    next();
  });
} else {
  app.use(helmet());
}
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : 'http://localhost:5000',
  credentials: true
}));

// Rate limiting (disabled in development)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  });
  app.use('/api/', limiter);
}

// Basic middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Sanitize sensitive data before logging
        const sanitizedResponse = { ...capturedJsonResponse };
        if (sanitizedResponse.password) delete sanitizedResponse.password;
        if (sanitizedResponse.token) delete sanitizedResponse.token;
        logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// Request validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.get('Content-Type');
    console.log(`${req.method} ${req.path} - Content-Type: ${contentType}`);
    
    // More permissive check for JSON content type
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ 
        message: 'Content-Type must be application/json',
        received: contentType || 'none'
      });
    }
  }
  next();
};
app.use('/api/', validateRequest);

(async () => {
  try {
    console.log("Attempting to register routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    // Use the centralized error handling middleware
    app.use(errorMiddleware);

    // Old error handling middleware - comment out or remove
    /*
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Log detailed error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      }
      
      res.status(status).json({ 
        message,
        status,
        timestamp: new Date().toISOString()
      });
      log(`Error: ${message}`);
    });
    */

    // Setup Vite in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Setting up development server with Vite...");
      await setupVite(app, server);
      console.log("Vite setup completed");
    } else {
      console.log("Setting up production server...");
      serveStatic(app);
      console.log("Static file serving setup completed");
    }

    // Schedule session cleanup every 30 minutes with improved error handling
    const cleanupJob = cron.schedule('*/30 * * * *', async () => {
      console.log('[CRON] Starting session cleanup job...');
      const startTime = Date.now();
      
      try {
        // Add a timeout to prevent the job from running too long
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Cleanup job timeout')), 60000); // 1 minute timeout
        });
        
        const cleanupPromise = storage.cleanupEmptySessions(30);
        
        const result = await Promise.race([cleanupPromise, timeoutPromise]) as { removedSessions: number, removedCustomers: number };
        
        const duration = Date.now() - startTime;
        
        // Update performance stats
        performanceStats.totalCleanupRuns++;
        performanceStats.totalCleanupTime += duration;
        performanceStats.averageCleanupTime = performanceStats.totalCleanupTime / performanceStats.totalCleanupRuns;
        performanceStats.maxCleanupTime = Math.max(performanceStats.maxCleanupTime, duration);
        performanceStats.lastCleanupTime = duration;
        
        console.log(`[CRON] Session cleanup completed in ${duration}ms: removedSessions=${result.removedSessions}, removedCustomers=${result.removedCustomers}`);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[CRON] Error during session cleanup after ${duration}ms:`, error);
        
        // Don't let the error crash the cron job
        if (error instanceof Error && error.message === 'Cleanup job timeout') {
          console.error('[CRON] Cleanup job timed out - this may indicate a database performance issue');
      }
      }
    }, {
      timezone: "UTC" // Use UTC to avoid timezone issues
    });

    // Log when the cron job is scheduled
    console.log('[CRON] Session cleanup job scheduled to run every 30 minutes');

    const port = Number(process.env.PORT) || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    
    server.listen(port, () => {
      console.log(`Server running at http://${host}:${port}`);
      console.log("Environment: " + (process.env.NODE_ENV || "development"));
    });
  } catch (error) {
    console.error("Server startup failed with error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
})();
