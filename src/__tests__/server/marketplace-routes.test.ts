import { describe, it, expect, vi } from 'vitest';

interface MockRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (data: unknown) => MockRes;
}

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(data: unknown) { this.body = data; return this; },
  };
}

interface MockReq {
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
}

function createMockReq(overrides: Partial<MockReq> = {}): MockReq {
  return {
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
  };
}

interface MockData {
  slots: Array<{ id: string; date: string; type: string; shift_type?: string; location: string; provider_id?: string }>;
  providers: Array<{ id: string; name: string; shiftsThisMonth?: number; timeOffRequests?: Array<{ start: string; end: string }>; time_off?: string[]; timeOff?: string[]; communicationPreferences?: { sms?: boolean; email?: boolean; push?: boolean } }>;
  marketplace_shifts: Array<{ id: string; slot_id: string; posted_by_provider_id: string; date: string; shift_type: string; location: string; lifecycle_state: string; claimed_by_provider_id?: string; claimed_at?: string; approved_by?: string; approved_at?: string; broadcast_recipients: Array<{ id: string }>; notes: string; posted_at?: string }>;
  broadcast_history: Array<{ id: string; marketplace_shift_id: string; tier: number; recipients: unknown[]; sent_at: string; channel: string; status: string; created_at?: string }>;
  global_settings: Array<{ key: string; value: unknown }>;
}

function createMockSupabase(initialData?: MockData) {
  const mockData: MockData = {
    slots: initialData?.slots ?? [],
    providers: initialData?.providers ?? [],
    marketplace_shifts: initialData?.marketplace_shifts ?? [],
    broadcast_history: initialData?.broadcast_history ?? [],
    global_settings: initialData?.global_settings ?? [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
  };

  function from(table: string) {
    let filters: Array<{ field: string; value: string; op?: string }> = [];
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let insertRow: Record<string, unknown> | null = null;
    let upsertKey: string | null = null;
    let updateRow: Record<string, unknown> | null = null;
    let pendingInsertData: Record<string, unknown> | null = null;

    function resolve(): { data: unknown; error: null | { message: string } } {
      if (pendingInsertData) {
        const newRow = { ...pendingInsertData, id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}` };
        const tableData = (mockData as unknown as Record<string, unknown[]>)[table] || [];
        tableData.push(newRow);
        pendingInsertData = null;
        return { data: newRow, error: null };
      }
      const tableData = (mockData as unknown as Record<string, unknown[]>)[table] || [];
      if (op === 'insert') {
        const newRow = { ...insertRow!, id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}` };
        tableData.push(newRow);
        return { data: newRow, error: null };
      }
      if (op === 'upsert') {
        if (upsertKey && insertRow) {
          const idx = (tableData as Record<string, unknown>[]).findIndex(r =>
            String((r as Record<string, unknown>)[upsertKey!]) === String(insertRow![upsertKey!])
          );
          if (idx >= 0) {
            const merged = { ...(tableData[idx] as Record<string, unknown>), ...insertRow };
            tableData[idx] = merged;
            return { data: merged, error: null };
          }
        }
        const newRow = { ...insertRow!, id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}` };
        tableData.push(newRow);
        return { data: newRow, error: null };
      }
      if (op === 'update' && updateRow) {
        const filtered = (tableData as Record<string, unknown>[]).filter(r =>
          filters.every(f => {
            if (f.op === 'like') {
              const re = new RegExp('^' + f.value.replace(/%/g, '.*') + '$');
              return re.test(String((r as Record<string, unknown>)[f.field] ?? ''));
            }
            return String((r as Record<string, unknown>)[f.field]) === f.value;
          })
        );
        if (filtered.length === 1) {
          Object.assign(filtered[0] as Record<string, unknown>, updateRow);
          return { data: filtered[0], error: null };
        }
        return { data: null, error: { message: 'No rows found' } };
      }
      if (op === 'delete') {
        const filtered = (tableData as Record<string, unknown>[]).filter(r =>
          filters.every(f => String((r as Record<string, unknown>)[f.field]) === f.value)
        );
        const idx = tableData.indexOf(filtered[0]);
        if (idx >= 0) tableData.splice(idx, 1);
        return { data: filtered[0] ?? null, error: null };
      }
      let filtered = (tableData as Record<string, unknown>[]).filter(r =>
        filters.every(f => {
          if (f.op === 'like') {
            const re = new RegExp('^' + f.value.replace(/%/g, '.*') + '$');
            return re.test(String((r as Record<string, unknown>)[f.field] ?? ''));
          }
          return String((r as Record<string, unknown>)[f.field]) === f.value;
        })
      );
      if (table === 'broadcast_history' && filters.some(f => f.field === 'marketplace_shift_id')) {
        filtered = [...filtered].sort((a, b) => (b as { tier: number }).tier - (a as { tier: number }).tier);
      }
      return { data: filtered, error: null };
    }

    // Track if .single() was called for proper Supabase emulation
    let isSingle = false;

    // Each method returns the proxy itself to preserve the chain
    const proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (_onFulfilled: (v: unknown) => void) => {
            const result = resolve();
            // Apply .single() semantics: throw on empty/multi, return single row or error
            if (isSingle) {
              if (result.error) {
                _onFulfilled({ data: null, error: result.error });
                return Promise.resolve({ data: null, error: result.error });
              }
              const rows = Array.isArray(result.data) ? result.data : [result.data].filter(Boolean);
              if (rows.length === 0) {
                const singleResult = { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
                _onFulfilled(singleResult);
                return Promise.resolve(singleResult);
              }
              if (rows.length > 1) {
                const singleResult = { data: null, error: { message: 'Multiple rows found', code: 'PGRST116' } };
                _onFulfilled(singleResult);
                return Promise.resolve(singleResult);
              }
              const singleResult = { data: rows[0], error: null };
              _onFulfilled(singleResult);
              return Promise.resolve(singleResult);
            }
            _onFulfilled(result);
            return Promise.resolve(result);
          };
        }
        if (prop === 'select') return () => { op = 'select'; isSingle = false; return proxy; };
        if (prop === 'eq') return (field: string, value: unknown) => { filters.push({ field, value: String(value) }); return proxy; };
        if (prop === 'single') return () => { isSingle = true; return proxy; };
        if (prop === 'insert') return (data: Record<string, unknown>) => { op = 'insert'; insertRow = data; pendingInsertData = data; return proxy; };
        if (prop === 'upsert') return (data: Record<string, unknown>, opts?: { onConflict?: string }) => { op = 'upsert'; insertRow = data; upsertKey = opts?.onConflict ?? null; return proxy; };
        if (prop === 'update') return (data: Record<string, unknown>) => { op = 'update'; updateRow = data; return proxy; };
        if (prop === 'delete') return () => { op = 'delete'; return proxy; };
        if (prop === 'order') return () => proxy;
        if (prop === 'limit') return () => proxy;
        if (prop === 'like') return (field: string, value: string) => { filters.push({ field, value, op: 'like' }); return proxy; };
        return undefined;
      },
    });

    return proxy;
  }

  return { from };
}

describe('Marketplace Routes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerMarketplaceRoutes: any;

  async function setupApp(mockData?: MockData) {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error - importing JS module
    const mod = await import('../../../server/marketplace-routes.js');
    registerMarketplaceRoutes = mod.registerMarketplaceRoutes;

    const data = mockData ?? {
      slots: [],
      providers: [],
      marketplace_shifts: [],
      broadcast_history: [],
      global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
    };
    const routes: Array<{ method: string; path: string; handler: (req: MockReq, res: MockRes) => Promise<void> }> = [];
    const app: Record<string, unknown> = {
      _routes: routes,
      post: (path: string, handler: (req: MockReq, res: MockRes) => Promise<void>) => { routes.push({ method: 'POST', path, handler }); },
      get: (path: string, handler: (req: MockReq, res: MockRes) => Promise<void>) => { routes.push({ method: 'GET', path, handler }); },
      patch: (path: string, handler: (req: MockReq, res: MockRes) => Promise<void>) => { routes.push({ method: 'PATCH', path, handler }); },
      delete: (path: string, handler: (req: MockReq, res: MockRes) => Promise<void>) => { routes.push({ method: 'DELETE', path, handler }); },
    };
    const mockSupabase = createMockSupabase(data);
    registerMarketplaceRoutes(app, mockSupabase);

    async function makeRequest(method: string, path: string, body?: unknown) {
      const [pathOnly, queryString] = path.split('?');
      const params: Record<string, string> = {};
      const query: Record<string, string> = {};
      if (queryString) {
        queryString.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) query[k] = decodeURIComponent(v);
        });
      }
      const route = routes.find((r) => {
        if (r.method !== method) return false;
        const pp = r.path.split('/');
        const xp = pathOnly.split('/');
        if (pp.length !== xp.length) return false;
        return pp.every((p, i) => {
          if (p.startsWith(':')) { params[p.slice(1)] = xp[i]; return true; }
          return p === xp[i];
        });
      });
      if (!route) throw new Error('Route not found: ' + method + ' ' + path);
      const req = createMockReq({ body: (body || {}) as Record<string, unknown>, params, query });
      const res = createMockRes();
      await route.handler(req, res);
      return { statusCode: res.statusCode, body: res.body };
    }

    return { app, data, makeRequest };
  }

  describe('POST /api/marketplace/shifts', () => {
    it('creates a marketplace shift successfully', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-01', type: 'DAY', location: 'NICU' }],
        providers: [{ id: 'prov-1', name: 'Dr. Smith' }],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts', { slotId: 'slot-1', postedByProviderId: 'prov-1', notes: 'Need coverage' });
      expect(result.statusCode).toBe(200);
    });

    it('returns 400 when slotId is missing', async () => {
      const { makeRequest } = await setupApp();
      const result = await makeRequest('POST', '/api/marketplace/shifts', { postedByProviderId: 'prov-1' });
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when postedByProviderId is missing', async () => {
      const { makeRequest } = await setupApp();
      const result = await makeRequest('POST', '/api/marketplace/shifts', { slotId: 'slot-1' });
      expect(result.statusCode).toBe(400);
    });

    it('returns 404 when slot not found', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [{ id: 'prov-1', name: 'Dr. Smith' }],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts', { slotId: 'nonexistent', postedByProviderId: 'prov-1' });
      expect(result.statusCode).toBe(404);
    });

    it('returns 404 when provider not found', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-01', type: 'DAY', location: 'NICU' }],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts', { slotId: 'slot-1', postedByProviderId: 'nonexistent' });
      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /api/marketplace/shifts', () => {
    it('returns all marketplace shifts', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('GET', '/api/marketplace/shifts');
      expect(result.statusCode).toBe(200);
    });

    it('filters by status query param', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('GET', '/api/marketplace/shifts?status=POSTED');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('POST /api/marketplace/shifts/:id/claim', () => {
    it('claims a shift when in BROADCASTING state', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-01', type: 'DAY', location: 'NICU' }],
        providers: [{ id: 'prov-2', name: 'Dr. Jones' }],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'BROADCASTING', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts/msk-1/claim', { providerId: 'prov-2' });
      expect(result.statusCode).toBe(200);
    });

    it('returns 409 when shift is not in BROADCASTING state', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-01', type: 'DAY', location: 'NICU' }],
        providers: [{ id: 'prov-2', name: 'Dr. Jones' }],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts/msk-1/claim', { providerId: 'prov-2' });
      expect(result.statusCode).toBe(409);
    });

    it('returns 404 when shift not found', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [{ id: 'prov-2', name: 'Dr. Jones' }],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/marketplace/shifts/nonexistent/claim', { providerId: 'prov-2' });
      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /api/marketplace/eligible-providers/:shiftId', () => {
    it('returns providers filtered by availability', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-15', type: 'DAY', location: 'NICU' }],
        providers: [
          { id: 'prov-1', name: 'Dr. Smith', shiftsThisMonth: 10 },
          { id: 'prov-2', name: 'Dr. Jones', shiftsThisMonth: 5 },
        ],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-15', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('GET', '/api/marketplace/eligible-providers/msk-1');
      expect(result.statusCode).toBe(200);
    });

    it('returns 404 when shift not found', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('GET', '/api/marketplace/eligible-providers/nonexistent');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/marketplace/shifts/:id/approve', () => {
    it('approves a claimed shift', async () => {
      const { makeRequest } = await setupApp({
        slots: [{ id: 'slot-1', date: '2026-04-01', type: 'DAY', location: 'NICU' }],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'CLAIMED', claimed_by_provider_id: 'prov-2', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('PATCH', '/api/marketplace/shifts/msk-1/approve', { approvedBy: 'admin-1' });
      expect(result.statusCode).toBe(200);
    });

    it('returns 409 for invalid lifecycle state', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'APPROVED', claimed_by_provider_id: 'prov-2', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('PATCH', '/api/marketplace/shifts/msk-1/approve', { approvedBy: 'admin-1' });
      expect(result.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/marketplace/shifts/:id', () => {
    it('deletes a marketplace shift in POSTED state', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('DELETE', '/api/marketplace/shifts/msk-1');
      expect(result.statusCode).toBe(200);
    });

    it('returns 409 for non-cancellable state', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'APPROVED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('DELETE', '/api/marketplace/shifts/msk-1');
      expect(result.statusCode).toBe(409);
    });
  });

  describe('POST /api/broadcast/dispatch', () => {
    it('dispatches broadcast to providers', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [
          { id: 'prov-1', name: 'Dr. Smith', communicationPreferences: { sms: true, email: true, push: false } },
        ],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-2', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/broadcast/dispatch', { shiftId: 'msk-1', channel: 'SMS' });
      expect(result.statusCode).toBe(200);
    });

    it('returns 404 when shift not found', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [],
      });
      const result = await makeRequest('POST', '/api/broadcast/dispatch', { shiftId: 'nonexistent', channel: 'SMS' });
      expect(result.statusCode).toBe(404);
    });
  });

  describe('POST /api/broadcast/escalate/:shiftId', () => {
    it('escalates broadcast to next tier', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [{ id: 'prov-1', name: 'Dr. Smith', communicationPreferences: { push: true } }],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-2', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'BROADCASTING', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('POST', '/api/broadcast/escalate/msk-1', {});
      expect(result.statusCode).toBe(200);
    });

    it('returns 400 when max tiers reached', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'BROADCASTING', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [
          { id: 'bh-1', marketplace_shift_id: 'msk-1', tier: 1, recipients: [], sent_at: new Date().toISOString(), channel: 'SMS', status: 'SENT' },
          { id: 'bh-2', marketplace_shift_id: 'msk-1', tier: 2, recipients: [], sent_at: new Date().toISOString(), channel: 'EMAIL', status: 'SENT' },
          { id: 'bh-3', marketplace_shift_id: 'msk-1', tier: 3, recipients: [], sent_at: new Date().toISOString(), channel: 'PUSH', status: 'SENT' },
        ],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('POST', '/api/broadcast/escalate/msk-1', {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /api/broadcast/history', () => {
    it('returns broadcast history for a shift', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [
          { id: 'bh-1', marketplace_shift_id: 'msk-1', tier: 1, recipients: [], sent_at: new Date().toISOString(), channel: 'SMS', status: 'SENT' },
        ],
        global_settings: [],
      });
      const result = await makeRequest('GET', '/api/broadcast/history?shiftId=msk-1');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('GET /api/broadcast/status/:shiftId', () => {
    it('returns broadcast status summary', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'BROADCASTING', broadcast_recipients: [{ id: 'prov-1' }], notes: '' },
        ],
        broadcast_history: [
          { id: 'bh-1', marketplace_shift_id: 'msk-1', tier: 1, recipients: ['prov-1'], sent_at: new Date().toISOString(), channel: 'SMS', status: 'SENT' },
        ],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('GET', '/api/broadcast/status/msk-1');
      expect(result.statusCode).toBe(200);
    });

    it('returns no_broadcasts_yet when no history', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [
          { id: 'msk-1', slot_id: 'slot-1', posted_by_provider_id: 'prov-1', date: '2026-04-01', shift_type: 'DAY', location: 'NICU', lifecycle_state: 'POSTED', broadcast_recipients: [], notes: '' },
        ],
        broadcast_history: [],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('GET', '/api/broadcast/status/msk-1');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('GET /api/broadcast/escalation-config', () => {
    it('returns escalation config', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('GET', '/api/broadcast/escalation-config');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('PATCH /api/broadcast/escalation-config', () => {
    it('updates and returns merged config', async () => {
      const { makeRequest } = await setupApp({
        slots: [],
        providers: [],
        marketplace_shifts: [],
        broadcast_history: [],
        global_settings: [{ key: 'escalation_config', value: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 } }],
      });
      const result = await makeRequest('PATCH', '/api/broadcast/escalation-config', { autoEscalationDelayMinutes: 120 });
      expect(result.statusCode).toBe(200);
    });
  });
});
