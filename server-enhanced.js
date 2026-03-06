/**
 * Enhanced Server Configuration for Phase 1 Improvements
 * This module provides Sentry integration, OpenAPI documentation, and improved error handling
 * Import this in server.js to enable these features
 * 
 * NOTE: This works with your existing Supabase backend - no database changes needed!
 */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import helmet from 'helmet';
import morgan from 'morgan';
import { initSentryServer, sentryRequestHandler, sentryErrorHandler, captureError } from './src/lib/sentry/sentry.server.ts';

// Initialize Sentry
initSentryServer();

/**
 * OpenAPI/Swagger configuration
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Neuro ICU Scheduler API',
      version: '1.0.0',
      description: 'REST API for the Neuro ICU Scheduler application',
      contact: {
        name: 'Support',
        email: 'support@nicuscheduler.local',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Provider: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['ADMIN', 'SCHEDULER', 'CLINICIAN'] },
            skills: { type: 'array', items: { type: 'string' } },
            targetWeekDays: { type: 'integer' },
            targetWeekendDays: { type: 'integer' },
            targetWeekNights: { type: 'integer' },
            targetWeekendNights: { type: 'integer' },
          },
        },
        ShiftSlot: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', format: 'date' },
            type: { type: 'string', enum: ['DAY', 'NIGHT', 'NMET', 'JEOPARDY', 'RECOVERY', 'CONSULTS', 'VACATION'] },
            providerId: { type: 'string', nullable: true },
            requiredSkill: { type: 'string' },
            priority: { type: 'string', enum: ['CRITICAL', 'STANDARD'] },
            location: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./server.js', './server-enhanced.js', './src/lib/api.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Apply enhanced middleware to Express app
 * @param {express.Application} app - Express application instance
 */
export function applyEnhancedMiddleware(app) {
  // Sentry request handler (must be first)
  app.use(sentryRequestHandler());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "*"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Request logging
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Neuro ICU Scheduler API Docs',
  }));

  // Health check endpoint with more details
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    });
  });

  // Sentry error handler (must be before other error handlers)
  app.use(sentryErrorHandler());
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(err, req, res, next) {
  // Log error
  console.error('[Error]', err);

  // Capture in Sentry
  captureError(err, {
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Send response
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: true,
    message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Async handler wrapper for Express routes
 * Automatically catches errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  applyEnhancedMiddleware,
  globalErrorHandler,
  asyncHandler,
};
