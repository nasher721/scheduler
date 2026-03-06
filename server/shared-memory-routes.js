/**
 * Shared Memory API Routes
 * REST API endpoints for the shared memory system
 */

import { getSharedMemoryService } from './shared-memory-service.js';
import { getBroadcaster } from './broadcaster.js';

/**
 * Register shared memory routes
 */
export function registerSharedMemoryRoutes(app) {
  const memory = getSharedMemoryService();
  const broadcaster = getBroadcaster();

  /**
   * Get a value by key
   */
  app.get('/api/memory/:key', (req, res) => {
    const { key } = req.params;
    const entry = memory.getEntry(key);

    if (!entry) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json(entry);
  });

  /**
   * Set a value
   */
  app.post('/api/memory/:key', (req, res) => {
    const { key } = req.params;
    const { value, ttl } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const entry = memory.set(key, value, {
      source: req.user?.id || 'api',
      ttl,
    });

    res.json(entry);
  });

  /**
   * Update a value (merge)
   */
  app.patch('/api/memory/:key', (req, res) => {
    const { key } = req.params;
    const updates = req.body;

    if (!memory.has(key)) {
      return res.status(404).json({ error: 'Key not found' });
    }

    const entry = memory.merge(key, updates, {
      source: req.user?.id || 'api',
    });

    res.json(entry);
  });

  /**
   * Delete a value
   */
  app.delete('/api/memory/:key', (req, res) => {
    const { key } = req.params;

    if (!memory.has(key)) {
      return res.status(404).json({ error: 'Key not found' });
    }

    memory.remove(key, { source: req.user?.id || 'api' });
    res.json({ success: true });
  });

  /**
   * Query memory
   */
  app.get('/api/memory', (req, res) => {
    const { pattern, key, source, since } = req.query;

    const results = memory.query({
      pattern,
      key,
      source,
      since: since ? parseInt(since) : undefined,
    });

    res.json(results);
  });

  /**
   * Get all memory entries
   */
  app.get('/api/memory-all', (req, res) => {
    res.json(memory.getAll());
  });

  /**
   * Create snapshot
   */
  app.get('/api/memory/snapshot', (req, res) => {
    res.json(memory.snapshot());
  });

  /**
   * Restore from snapshot
   */
  app.post('/api/memory/restore', (req, res) => {
    const { snapshot } = req.body;

    if (!snapshot) {
      return res.status(400).json({ error: 'Snapshot is required' });
    }

    memory.restore(snapshot);
    res.json({ success: true });
  });

  /**
   * Get change history
   */
  app.get('/api/memory/history', (req, res) => {
    const { limit } = req.query;
    const history = memory.getHistory(limit ? parseInt(limit) : undefined);
    res.json(history);
  });

  /**
   * Clear all memory
   */
  app.post('/api/memory/clear', (req, res) => {
    memory.clear();
    res.json({ success: true });
  });

  /**
   * Get memory statistics
   */
  app.get('/api/memory/stats', (req, res) => {
    res.json(memory.getStats());
  });

  /**
   * Persist to disk
   */
  app.post('/api/memory/persist', async (req, res) => {
    await memory.persistToDisk();
    res.json({ success: true });
  });

  /**
   * Broadcast to all clients
   */
  app.post('/api/broadcast', (req, res) => {
    const { event, data, room } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event is required' });
    }

    const sent = broadcaster.broadcast(event, data, { room });
    res.json({ sent });
  });

  /**
   * Get broadcaster statistics
   */
  app.get('/api/broadcast/stats', (req, res) => {
    res.json(broadcaster.getStats());
  });

  console.log('[SharedMemory] Routes registered');
}

export default registerSharedMemoryRoutes;
