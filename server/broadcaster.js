/**
 * Real-time Broadcaster
 * Handles WebSocket and Server-Sent Events for live updates
 */

import { EventEmitter } from 'events';
import { getSharedMemoryService } from './shared-memory-service.js';

/**
 * Broadcaster for real-time updates
 */
class Broadcaster extends EventEmitter {
  constructor(options = {}) {
    super();
    this.clients = new Map();
    this.rooms = new Map();
    this.memory = getSharedMemoryService();
    this.enableLogging = options.enableLogging || process.env.NODE_ENV === 'development';

    // Subscribe to memory changes
    this.memory.on('change', (event) => {
      this.broadcast('memory:change', event);
    });
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[Broadcaster]', ...args);
    }
  }

  /**
   * Add a client connection
   */
  addClient(clientId, connection, options = {}) {
    const client = {
      id: clientId,
      connection,
      rooms: new Set(),
      subscriptions: new Set(),
      metadata: options.metadata || {},
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // Send initial state if requested
    if (options.syncOnConnect) {
      this.sendToClient(clientId, 'memory:sync', {
        entries: this.memory.snapshot().entries,
        timestamp: Date.now(),
      });
    }

    this.log(`Client ${clientId} connected`);
    this.emit('client:connected', { clientId, metadata: client.metadata });

    return client;
  }

  /**
   * Remove a client
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const room of client.rooms) {
      this.leaveRoom(clientId, room);
    }

    this.clients.delete(clientId);
    this.log(`Client ${clientId} disconnected`);
    this.emit('client:disconnected', { clientId });
  }

  /**
   * Join a room
   */
  joinRoom(clientId, room) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room).add(clientId);
    client.rooms.add(room);

    this.log(`Client ${clientId} joined room ${room}`);
  }

  /**
   * Leave a room
   */
  leaveRoom(clientId, room) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.rooms.get(room)?.delete(clientId);
    client.rooms.delete(room);

    this.log(`Client ${clientId} left room ${room}`);
  }

  /**
   * Subscribe to a memory key
   */
  subscribe(clientId, key) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(key);

    // Send current value
    const entry = this.memory.getEntry(key);
    if (entry) {
      this.sendToClient(clientId, 'memory:change', {
        key,
        newValue: entry.value,
        version: entry.version,
        timestamp: entry.timestamp,
        source: entry.source,
        type: 'set',
      });
    }
  }

  /**
   * Unsubscribe from a memory key
   */
  unsubscribe(clientId, key) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(key);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      const message = JSON.stringify({ event, data, timestamp: Date.now() });

      if (client.connection.readyState === 1) {
        // WebSocket OPEN
        client.connection.send(message);
      } else if (client.connection.write) {
        // SSE
        client.connection.write(`data: ${message}\n\n`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data, options = {}) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    let sent = 0;

    for (const [clientId, client] of this.clients) {
      // Skip excluded clients
      if (options.exclude?.includes(clientId)) continue;

      // Filter by room
      if (options.room && !client.rooms.has(options.room)) continue;

      // Filter by subscription (for memory events)
      if (event === 'memory:change' && data.key) {
        if (!client.subscriptions.has(data.key) && !client.subscriptions.has('*')) continue;
      }

      try {
        if (client.connection.readyState === 1) {
          client.connection.send(message);
          sent++;
        } else if (client.connection.write) {
          client.connection.write(`data: ${message}\n\n`);
          sent++;
        }
      } catch (error) {
        console.error(`Failed to broadcast to client ${clientId}:`, error);
      }
    }

    return sent;
  }

  /**
   * Broadcast to a room
   */
  broadcastToRoom(room, event, data) {
    return this.broadcast(event, data, { room });
  }

  /**
   * Get client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get room count
   */
  getRoomCount(room) {
    return this.rooms.get(room)?.size || 0;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      clientsPerRoom: Array.from(this.rooms.entries()).map(([room, clients]) => ({
        room,
        count: clients.size,
      })),
    };
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
      const clientId = req.headers['x-client-id'] || `ws-${Date.now()}-${Math.random()}`;
      
      this.addClient(clientId, ws, { syncOnConnect: true });

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message);
          this.handleClientMessage(clientId, parsed);
        } catch (error) {
          console.error('Invalid message from client:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.removeClient(clientId);
      });
    });

    this.log('WebSocket server configured');
  }

  /**
   * Setup SSE endpoint
   */
  setupSSE(app) {
    app.get('/api/events', (req, res) => {
      const clientId = req.headers['x-client-id'] || `sse-${Date.now()}-${Math.random()}`;

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      this.addClient(clientId, res, {
        syncOnConnect: req.query.sync === 'true',
        metadata: { userId: req.user?.id, ip: req.ip },
      });

      // Handle client disconnect
      req.on('close', () => {
        this.removeClient(clientId);
      });

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ event: 'connected', data: { clientId } })}\n\n`);
    });

    this.log('SSE endpoint configured at /api/events');
  }

  /**
   * Handle client message
   */
  handleClientMessage(clientId, message) {
    const { event, data } = message;

    switch (event) {
      case 'subscribe':
        if (data.key) {
          this.subscribe(clientId, data.key);
        }
        break;

      case 'unsubscribe':
        if (data.key) {
          this.unsubscribe(clientId, data.key);
        }
        break;

      case 'join':
        if (data.room) {
          this.joinRoom(clientId, data.room);
        }
        break;

      case 'leave':
        if (data.room) {
          this.leaveRoom(clientId, data.room);
        }
        break;

      case 'memory:set':
        if (data.key && data.value !== undefined) {
          this.memory.set(data.key, data.value, { source: `client:${clientId}` });
        }
        break;

      case 'memory:update':
        if (data.key && data.updater) {
          // Note: updater function can't be serialized, use merge instead
          this.memory.merge(data.key, data.updater, { source: `client:${clientId}` });
        }
        break;

      case 'ping':
        this.sendToClient(clientId, 'pong', { timestamp: Date.now() });
        break;

      default:
        this.emit('client:message', { clientId, event, data });
    }
  }
}

// Singleton instance
let broadcaster = null;

export function getBroadcaster(options = {}) {
  if (!broadcaster) {
    broadcaster = new Broadcaster(options);
  }
  return broadcaster;
}

export function createBroadcaster(options = {}) {
  return new Broadcaster(options);
}

export { Broadcaster };
export default getBroadcaster;
