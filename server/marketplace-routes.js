/**
 * Marketplace and Broadcast API Routes
 * Endpoints for shift marketplace operations and broadcast notifications
 */

export function registerMarketplaceRoutes(app, supabase) {
  app.post('/api/marketplace/shifts', async (req, res) => {
    try {
      const { slotId, postedByProviderId, notes } = req.body;
      
      if (!slotId || !postedByProviderId) {
        return res.status(400).json({ error: 'slotId and postedByProviderId are required' });
      }

      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slotId)
        .single();
        
      if (slotError || !slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', postedByProviderId)
        .single();
        
      if (providerError || !provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const id = `msk-${crypto.randomUUID()}`;
      const newShift = {
        id,
        slot_id: slotId,
        posted_by_provider_id: postedByProviderId,
        date: slot.date,
        shift_type: slot.type || slot.shift_type,
        location: slot.location,
        lifecycle_state: 'POSTED',
        posted_at: new Date().toISOString(),
        broadcast_recipients: [],
        notes: notes || ''
      };

      const { data: createdShift, error: insertError } = await supabase
        .from('marketplace_shifts')
        .insert(newShift)
        .select()
        .single();
        
      if (insertError) throw insertError;

      res.json(createdShift);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/marketplace/shifts', async (req, res) => {
    try {
      const { status, postedByProviderId, dateFrom, dateTo } = req.query;
      let query = supabase.from('marketplace_shifts').select('*');

      if (status) query = query.eq('lifecycle_state', status);
      if (postedByProviderId) query = query.eq('posted_by_provider_id', postedByProviderId);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);

      const { data: shifts, error } = await query;
      if (error) throw error;

      res.json({ shifts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/marketplace/shifts/:id/claim', async (req, res) => {
    try {
      const { id } = req.params;
      const { providerId } = req.body;

      if (!providerId) {
        return res.status(400).json({ error: 'providerId is required' });
      }

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', id)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      if (shift.lifecycle_state !== 'BROADCASTING') {
        return res.status(409).json({ error: 'Shift is not in BROADCASTING state' });
      }

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();
        
      if (providerError || !provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const timeOff = provider.time_off || provider.timeOff || [];
      if (timeOff.includes(shift.date)) {
        return res.status(409).json({ error: 'Provider has time off on this date' });
      }

      const { data: updatedShift, error: updateError } = await supabase
        .from('marketplace_shifts')
        .update({
          lifecycle_state: 'CLAIMED',
          claimed_by_provider_id: providerId,
          claimed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json(updatedShift);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/marketplace/eligible-providers/:shiftId', async (req, res) => {
    try {
      const { shiftId } = req.params;

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      const { data: allProviders, error: providersError } = await supabase
        .from('providers')
        .select('*');
        
      if (providersError) throw providersError;

      const broadcastRecipients = (shift.broadcast_recipients || []).map(r => r.id || r.providerId || r.provider_id || r);
      
      const eligibleProviders = allProviders.filter(p => {
        if (p.id === shift.posted_by_provider_id) return false;
        
        const timeOff = p.time_off || p.timeOff || [];
        if (timeOff.includes(shift.date)) return false;

        if (broadcastRecipients.includes(p.id)) return false;

        return true;
      });

      const currentMonthPrefix = shift.date.substring(0, 7);
      const { data: monthSlots, error: slotsError } = await supabase
        .from('slots')
        .select('*')
        .like('date', `${currentMonthPrefix}%`);
        
      if (slotsError) throw slotsError;

      const providerShiftCounts = {};
      monthSlots.forEach(slot => {
        if (slot.provider_id) {
          providerShiftCounts[slot.provider_id] = (providerShiftCounts[slot.provider_id] || 0) + 1;
        }
      });

      const providersWithCounts = eligibleProviders.map(p => ({
        id: p.id,
        name: p.name,
        shiftsThisMonth: providerShiftCounts[p.id] || 0
      }));

      providersWithCounts.sort((a, b) => a.shiftsThisMonth - b.shiftsThisMonth);

      res.json({ providers: providersWithCounts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/marketplace/shifts/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { approvedBy } = req.body;

      if (!approvedBy) {
        return res.status(400).json({ error: 'approvedBy is required' });
      }

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', id)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      if (shift.lifecycle_state !== 'CLAIMED') {
        return res.status(409).json({ error: 'Shift is not in CLAIMED state' });
      }

      const { data: updatedShift, error: updateError } = await supabase
        .from('marketplace_shifts')
        .update({
          lifecycle_state: 'APPROVED',
          approved_by: approvedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const { error: slotUpdateError } = await supabase
        .from('slots')
        .update({ provider_id: shift.claimed_by_provider_id })
        .eq('id', shift.slot_id);

      if (slotUpdateError) throw slotUpdateError;

      res.json(updatedShift);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/marketplace/shifts/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', id)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      if (!['POSTED', 'CLAIMED'].includes(shift.lifecycle_state)) {
        return res.status(409).json({ error: 'Shift cannot be cancelled from current state' });
      }

      const { error: updateError } = await supabase
        .from('marketplace_shifts')
        .update({ lifecycle_state: 'CANCELLED' })
        .eq('id', id);

      if (updateError) throw updateError;

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/broadcast/dispatch', async (req, res) => {
    try {
      const { shiftId, channel } = req.body;

      if (!shiftId || !channel) {
        return res.status(400).json({ error: 'shiftId and channel are required' });
      }

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      const { data: allProviders, error: providersError } = await supabase
        .from('providers')
        .select('*');
        
      if (providersError) throw providersError;

      const existingRecipients = (shift.broadcast_recipients || []).map(r => r.id);
      
      const eligibleProviders = allProviders.filter(p => {
        if (p.id === shift.posted_by_provider_id) return false;
        const timeOff = p.time_off || p.timeOff || [];
        if (timeOff.includes(shift.date)) return false;
        if (existingRecipients.includes(p.id)) return false;
        return true;
      });

      const recipients = eligibleProviders.map(p => {
        const prefs = p.communicationPreferences || p.communication_preferences || {};
        let selectedChannel = channel;
        if (prefs.sms) selectedChannel = 'sms';
        else if (prefs.email) selectedChannel = 'email';
        else selectedChannel = 'push';

        return {
          id: p.id,
          name: p.name,
          channel: selectedChannel,
          sentAt: new Date().toISOString()
        };
      });

      const updatedBroadcastRecipients = [...(shift.broadcast_recipients || []), ...recipients];

      const { error: updateShiftError } = await supabase
        .from('marketplace_shifts')
        .update({ 
          broadcast_recipients: updatedBroadcastRecipients,
          lifecycle_state: 'BROADCASTING'
        })
        .eq('id', shiftId);

      if (updateShiftError) throw updateShiftError;

      const broadcastHistoryId = `bh-${crypto.randomUUID()}`;
      const historyEntry = {
        id: broadcastHistoryId,
        marketplace_shift_id: shiftId,
        tier: 1,
        recipients,
        sent_at: new Date().toISOString(),
        channel,
        status: 'sent'
      };

      const { data: createdHistory, error: historyError } = await supabase
        .from('broadcast_history')
        .insert(historyEntry)
        .select()
        .single();
        
      if (historyError) throw historyError;

      res.json(createdHistory);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/broadcast/escalate/:shiftId', async (req, res) => {
    try {
      const { shiftId } = req.params;

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      const { data: historyList, error: historyFetchError } = await supabase
        .from('broadcast_history')
        .select('tier')
        .eq('marketplace_shift_id', shiftId)
        .order('tier', { ascending: false })
        .limit(1);

      if (historyFetchError) throw historyFetchError;

      const maxTier = historyList.length > 0 ? historyList[0].tier : 0;

      const { data: configData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'escalation_config')
        .single();
      
      const config = (configData && configData.value) 
        ? configData.value 
        : { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 };

      if (maxTier >= config.maxEscalationTiers) {
        return res.status(400).json({ error: 'Max escalation tiers reached' });
      }

      const nextTier = maxTier + 1;

      const { data: allProviders, error: providersError } = await supabase
        .from('providers')
        .select('*');
        
      if (providersError) throw providersError;

      const existingRecipients = (shift.broadcast_recipients || []).map(r => r.id);
      
      const eligibleProviders = allProviders.filter(p => {
        if (p.id === shift.posted_by_provider_id) return false;
        const timeOff = p.time_off || p.timeOff || [];
        if (timeOff.includes(shift.date)) return false;
        if (existingRecipients.includes(p.id)) return false;
        return true;
      });

      const newRecipients = eligibleProviders.map(p => {
        const prefs = p.communicationPreferences || p.communication_preferences || {};
        let selectedChannel = 'push';
        if (prefs.sms) selectedChannel = 'sms';
        else if (prefs.email) selectedChannel = 'email';

        return {
          id: p.id,
          name: p.name,
          channel: selectedChannel,
          sentAt: new Date().toISOString()
        };
      });

      const updatedBroadcastRecipients = [...(shift.broadcast_recipients || []), ...newRecipients];

      const { error: updateShiftError } = await supabase
        .from('marketplace_shifts')
        .update({ broadcast_recipients: updatedBroadcastRecipients })
        .eq('id', shiftId);

      if (updateShiftError) throw updateShiftError;

      const historyEntry = {
        id: `bh-${crypto.randomUUID()}`,
        marketplace_shift_id: shiftId,
        tier: nextTier,
        recipients: newRecipients,
        sent_at: new Date().toISOString(),
        channel: 'mixed',
        status: 'sent'
      };

      const { error: historyError } = await supabase
        .from('broadcast_history')
        .insert(historyEntry);
        
      if (historyError) throw historyError;

      res.json({ tier: nextTier, count: newRecipients.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/broadcast/history', async (req, res) => {
    try {
      const { shiftId, tier, status } = req.query;
      let query = supabase.from('broadcast_history').select('*');

      if (shiftId) query = query.eq('marketplace_shift_id', shiftId);
      if (tier) query = query.eq('tier', parseInt(tier));
      if (status) query = query.eq('status', status);

      const { data: broadcasts, error } = await query;
      if (error) throw error;

      res.json({ broadcasts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/broadcast/status/:shiftId', async (req, res) => {
    try {
      const { shiftId } = req.params;

      const { data: shift, error: shiftError } = await supabase
        .from('marketplace_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
        
      if (shiftError || !shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }

      const { data: historyList, error: historyFetchError } = await supabase
        .from('broadcast_history')
        .select('*')
        .eq('marketplace_shift_id', shiftId)
        .order('tier', { ascending: false });

      if (historyFetchError) throw historyFetchError;

      if (historyList.length === 0) {
        return res.json({ status: 'no_broadcasts_yet', shift });
      }

      const latestBroadcast = historyList[0];
      const currentTier = latestBroadcast.tier;
      let totalRecipients = 0;
      historyList.forEach(h => {
        totalRecipients += (h.recipients || []).length;
      });

      const { data: configData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'escalation_config')
        .single();
        
      const escalationConfig = (configData && configData.value) 
        ? configData.value 
        : { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 };

      const sentTime = new Date(latestBroadcast.sent_at).getTime();
      const now = Date.now();
      const minutesSinceLastBroadcast = (now - sentTime) / (1000 * 60);

      const countdown = (currentTier * escalationConfig.autoEscalationDelayMinutes) - minutesSinceLastBroadcast;

      res.json({
        status: 'active',
        shift,
        currentTier,
        totalRecipients,
        escalationConfig,
        minutesSinceLastBroadcast,
        countdown
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/broadcast/escalation-config', async (req, res) => {
    try {
      const { data: configData, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'escalation_config')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const config = (configData && configData.value) 
        ? configData.value 
        : { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 };
        
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/broadcast/escalation-config', async (req, res) => {
    try {
      const updates = req.body;

      const { data: currentData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'escalation_config')
        .single();
      
      const currentConfig = (currentData && currentData.value) 
        ? currentData.value 
        : { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 };

      const mergedConfig = { ...currentConfig, ...updates };

      const { data: upsertData, error: upsertError } = await supabase
        .from('global_settings')
        .upsert({ key: 'escalation_config', value: mergedConfig }, { onConflict: 'key' })
        .select()
        .single();

      if (upsertError) throw upsertError;

      res.json(upsertData ? upsertData.value : mergedConfig);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
