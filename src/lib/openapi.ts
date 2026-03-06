/**
 * OpenAPI/Swagger Configuration for API Documentation
 * This file defines the OpenAPI specification for the backend API
 */

export const openApiSpec = {
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
      url: process.env.VITE_API_BASE_URL || 'http://localhost:4000',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'State', description: 'Schedule state management' },
    { name: 'Providers', description: 'Provider management' },
    { name: 'Shifts', description: 'Shift slot management' },
    { name: 'AI', description: 'AI optimization and recommendations' },
    { name: 'Notifications', description: 'Notification management' },
    { name: 'Swap Requests', description: 'Shift swap request handling' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check if the API is running',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/state': {
      get: {
        tags: ['State'],
        summary: 'Get schedule state',
        description: 'Retrieve the current schedule state',
        responses: {
          '200': {
            description: 'Schedule state retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScheduleState' },
              },
            },
          },
        },
      },
      put: {
        tags: ['State'],
        summary: 'Update schedule state',
        description: 'Update and persist the schedule state',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ScheduleState' },
            },
          },
        },
        responses: {
          '200': {
            description: 'State updated successfully',
          },
          '400': {
            description: 'Invalid state data',
          },
        },
      },
    },
    '/api/shift-requests': {
      get: {
        tags: ['Swap Requests'],
        summary: 'List shift requests',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
          },
        ],
        responses: {
          '200': {
            description: 'List of shift requests',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SwapRequest' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Swap Requests'],
        summary: 'Create shift request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSwapRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Request created successfully',
          },
        },
      },
    },
    '/api/ai/providers': {
      get: {
        tags: ['AI'],
        summary: 'List available AI providers',
        responses: {
          '200': {
            description: 'List of AI providers',
          },
        },
      },
    },
    '/api/ai/optimize': {
      post: {
        tags: ['AI'],
        summary: 'Run schedule optimization',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: ['openai', 'anthropic', 'google'] },
                  constraints: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Optimization results',
          },
        },
      },
    },
  },
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
        required: ['id', 'name', 'skills'],
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
        required: ['id', 'date', 'type', 'requiredSkill'],
      },
      ScheduleState: {
        type: 'object',
        properties: {
          providers: {
            type: 'array',
            items: { $ref: '#/components/schemas/Provider' },
          },
          slots: {
            type: 'array',
            items: { $ref: '#/components/schemas/ShiftSlot' },
          },
          startDate: { type: 'string', format: 'date' },
          numWeeks: { type: 'integer' },
        },
        required: ['providers', 'slots', 'startDate', 'numWeeks'],
      },
      SwapRequest: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          requestorId: { type: 'string' },
          targetProviderId: { type: 'string', nullable: true },
          fromDate: { type: 'string', format: 'date' },
          fromShiftType: { type: 'string' },
          toDate: { type: 'string', format: 'date' },
          toShiftType: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
          requestedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'requestorId', 'fromDate', 'toDate', 'status'],
      },
      CreateSwapRequest: {
        type: 'object',
        properties: {
          requestorId: { type: 'string' },
          targetProviderId: { type: 'string' },
          fromDate: { type: 'string', format: 'date' },
          fromShiftType: { type: 'string' },
          toDate: { type: 'string', format: 'date' },
          toShiftType: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['requestorId', 'fromDate', 'toDate', 'fromShiftType', 'toShiftType'],
      },
    },
  },
};

export default openApiSpec;
