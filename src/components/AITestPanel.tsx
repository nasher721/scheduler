/**
 * AI Services Test Panel
 * Comprehensive testing interface for all AI services
 */

import React, { useState } from 'react';
import {
  useAIOptimization,
  useDemandForecast,
  useNLPAssistant,
  usePreferenceLearning,
  useAnomalyDetection,
  useAIStatus,
} from '../hooks/useAI';

// Mock schedule state for testing
const mockScheduleState = {
  providers: [
    {
      id: 'dr-smith',
      name: 'Dr. Smith',
      skills: ['general', 'stroke'],
      targetWeekDays: 5,
      targetWeekendDays: 2,
      targetWeekNights: 2,
      timeOffRequests: [],
    },
    {
      id: 'dr-jones',
      name: 'Dr. Jones',
      skills: ['general', 'trauma', 'pediatrics'],
      targetWeekDays: 5,
      targetWeekendDays: 2,
      targetWeekNights: 2,
      timeOffRequests: [{ date: '2024-03-20', reason: 'Conference' }],
    },
    {
      id: 'dr-chen',
      name: 'Dr. Chen',
      skills: ['general', 'stroke', 'neuro'],
      targetWeekDays: 4,
      targetWeekendDays: 2,
      targetWeekNights: 3,
      timeOffRequests: [],
    },
  ],
  slots: [
    { id: 's1', date: '2024-03-15', type: 'DAY', providerId: 'dr-smith', isWeekendLayout: false, requiredSkill: 'general', priority: 'STANDARD' },
    { id: 's2', date: '2024-03-15', type: 'NIGHT', providerId: null, isWeekendLayout: false, requiredSkill: 'stroke', priority: 'CRITICAL' },
    { id: 's3', date: '2024-03-16', type: 'DAY', providerId: null, isWeekendLayout: true, requiredSkill: 'general', priority: 'STANDARD' },
    { id: 's4', date: '2024-03-16', type: 'NIGHT', providerId: 'dr-chen', isWeekendLayout: true, requiredSkill: 'stroke', priority: 'STANDARD' },
    { id: 's5', date: '2024-03-17', type: 'DAY', providerId: null, isWeekendLayout: true, requiredSkill: 'general', priority: 'STANDARD' },
  ],
};

export function AITestPanel() {
  const [activeTab, setActiveTab] = useState<'status' | 'optimize' | 'forecast' | 'chat' | 'preferences' | 'anomalies'>('status');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI Services Test Panel</h1>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['status', 'optimize', 'forecast', 'chat', 'preferences', 'anomalies'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'optimize' && <OptimizeTab />}
        {activeTab === 'forecast' && <ForecastTab />}
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'anomalies' && <AnomaliesTab />}
      </div>
    </div>
  );
}

// ============ STATUS TAB ============

function StatusTab() {
  const { status, isLoading, refresh } = useAIStatus();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">AI Services Status</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {status ? (
        <div className="space-y-4">
          <StatusCard
            title="Multi-Agent System"
            status={status.multiAgent?.status || 'unknown'}
            details={status.multiAgent}
          />
          <StatusCard
            title="Anomaly Detection"
            status={status.anomalyDetection?.status || 'unknown'}
            details={{
              ...status.anomalyDetection,
              activeAlerts: status.anomalyDetection?.activeAlerts || 0,
            }}
          />
          <StatusCard
            title="Preference Learning"
            status={status.preferenceLearning?.modelsCount > 0 ? 'active' : 'idle'}
            details={{
              modelsLearned: status.preferenceLearning?.modelsCount || 0,
            }}
          />
          <StatusCard
            title="Demand Forecast"
            status={status.demandForecast?.lastForecast > 0 ? 'active' : 'idle'}
            details={{
              forecastsGenerated: status.demandForecast?.lastForecast || 0,
            }}
          />
        </div>
      ) : (
        <p className="text-gray-500">No status available</p>
      )}
    </div>
  );
}

function StatusCard({ title, status, details }: { title: string; status: string; details: any }) {
  const statusColors: Record<string, string> = {
    running: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
    idle: 'bg-gray-100 text-gray-800',
    stopped: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
    unknown: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium">{title}</h3>
        <span className={`px-2 py-1 rounded text-sm capitalize ${statusColors[status] || statusColors.unknown}`}>
          {status}
        </span>
      </div>
      {details && (
        <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ============ OPTIMIZE TAB ============

function OptimizeTab() {
  const { isOptimizing, progress, result, error, startOptimization, stopOptimization } = useAIOptimization();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Multi-Agent Optimization</h2>

      <div className="mb-4">
        <button
          onClick={() => startOptimization(mockScheduleState)}
          disabled={isOptimizing}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 mr-2"
        >
          {isOptimizing ? 'Optimizing...' : 'Start Optimization'}
        </button>
        {isOptimizing && (
          <button
            onClick={stopOptimization}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Stop
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {isOptimizing && progress && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Progress</h3>
          <pre className="text-sm bg-gray-50 p-2 rounded">
            {JSON.stringify(progress, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div>
          <h3 className="font-medium mb-2">Result</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <MetricCard label="Compliance" value={`${result.metrics?.complianceScore}%`} />
            <MetricCard label="Coverage" value={`${result.metrics?.coverageScore}%`} />
            <MetricCard label="Fairness" value={`${result.metrics?.fairnessScore}%`} />
            <MetricCard label="Preferences" value={`${result.metrics?.preferenceScore}%`} />
          </div>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-blue-50 p-3 rounded text-center">
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

// ============ FORECAST TAB ============

function ForecastTab() {
  const { forecast, isLoading, error, generateForecast } = useDemandForecast();
  const [startDate, setStartDate] = useState('2024-03-15');
  const [days, setDays] = useState(7);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Demand Forecasting</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          min={1}
          max={30}
          className="border rounded px-3 py-2 w-20"
        />
        <button
          onClick={() => generateForecast(startDate, days)}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? 'Generating...' : 'Generate Forecast'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {forecast && (
        <div>
          <h3 className="font-medium mb-2">Forecast Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-center">Day Shift</th>
                  <th className="p-2 text-center">Night Shift</th>
                  <th className="p-2 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((day: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{day.date}</td>
                    <td className="p-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayOfWeek]}</td>
                    <td className="p-2 text-center">
                      {day.dayShift?.required} ({day.dayShift?.optimal})
                    </td>
                    <td className="p-2 text-center">
                      {day.nightShift?.required} ({day.nightShift?.optimal})
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        day.confidence > 80 ? 'bg-green-100 text-green-800' :
                        day.confidence > 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {day.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ CHAT TAB ============

function ChatTab() {
  const userId = 'test-user';
  const { messages, isProcessing, error, sendMessage, clearHistory } = useNLPAssistant(userId);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input, { scheduleState: mockScheduleState });
      setInput('');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">NLP Assistant</h2>
        <button
          onClick={clearHistory}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Clear History
        </button>
      </div>

      <div className="border rounded-lg h-96 overflow-y-auto mb-4 p-4 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-32">
            Try asking: "Who can cover Friday night?" or "What is the schedule for next week?"
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-3 ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block max-w-3/4 px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border'
                }`}
              >
                {msg.content}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {isProcessing && (
          <div className="text-left">
            <div className="inline-block px-4 py-2 rounded-lg bg-gray-200">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">
          Error: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about scheduling..."
          className="flex-1 border rounded px-4 py-2"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="mt-4 text-sm text-gray-600">
        <p className="font-medium">Example queries:</p>
        <ul className="list-disc list-inside mt-1">
          <li>"Who can cover Friday night shift?"</li>
          <li>"Assign Dr. Smith to March 15 day shift"</li>
          <li>"What is Dr. Jones schedule?"</li>
          <li>"How many shifts does each person have?"</li>
          <li>"I need March 20-22 off"</li>
        </ul>
      </div>
    </div>
  );
}

// ============ PREFERENCES TAB ============

function PreferencesTab() {
  const { models, isLearning, error, learnAll, getRecommendation } = usePreferenceLearning();
  const [recommendation, setRecommendation] = useState<any>(null);

  const testShift = { date: '2024-03-20', type: 'DAY' };

  const handleGetRecommendation = async (providerId: string) => {
    const rec = await getRecommendation(providerId, testShift);
    setRecommendation(rec);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Preference Learning</h2>

      <div className="mb-4">
        <button
          onClick={() => learnAll(mockScheduleState)}
          disabled={isLearning}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {isLearning ? 'Learning...' : 'Learn All Provider Preferences'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {Object.keys(models).length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Learned Models ({Object.keys(models).length})</h3>
          <div className="space-y-2">
            {Object.entries(models).map(([providerId, model]: [string, any]) => (
              <div key={providerId} className="border rounded p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{model.providerId}</span>
                  <button
                    onClick={() => handleGetRecommendation(providerId)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Test Recommendation
                  </button>
                </div>
                {model.shiftTypePreference && (
                  <div className="text-sm text-gray-600 mt-1">
                    Prefers: {model.shiftTypePreference.preference} shifts
                    (strength: {model.shiftTypePreference.strength})
                  </div>
                )}
                {model.confidence && (
                  <div className="text-sm text-gray-500 mt-1">
                    Confidence: {Math.round(
                      Object.values(model.confidence as Record<string, number>).reduce(
                        (a, b) => a + b,
                        0
                      ) / Math.max(1, Object.keys(model.confidence).length) * 100
                    )}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendation && (
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-medium mb-2">Recommendation for {testShift.date} {testShift.type}</h3>
          <div className="text-2xl font-bold text-blue-600 mb-2">
            Score: {Math.round(recommendation.score * 100)}%
          </div>
          <div className="text-sm">
            <p className="font-medium">Factors:</p>
            <ul className="list-disc list-inside">
              {recommendation.factors?.map((factor: string, idx: number) => (
                <li key={idx}>{factor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ANOMALIES TAB ============

function AnomaliesTab() {
  const {
    alerts,
    isMonitoring,
    status,
    startMonitoring,
    stopMonitoring,
    fetchAlerts,
    resolveAlert,
  } = useAnomalyDetection();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Anomaly Detection</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={startMonitoring}
          disabled={isMonitoring}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          Start Monitoring
        </button>
        <button
          onClick={stopMonitoring}
          disabled={!isMonitoring}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          Stop Monitoring
        </button>
        <button
          onClick={() => fetchAlerts()}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Refresh Alerts
        </button>
      </div>

      <div className="mb-4">
        <span className={`px-3 py-1 rounded text-sm ${
          isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          Status: {isMonitoring ? 'Monitoring' : 'Stopped'}
        </span>
        {status?.lastCheck && (
          <span className="ml-2 text-sm text-gray-500">
            Last check: {new Date(status.lastCheck).toLocaleTimeString()}
          </span>
        )}
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-medium">Active Alerts ({alerts.length})</h3>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded p-3 ${
                alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                alert.severity === 'HIGH' ? 'bg-orange-50 border-orange-200' :
                'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      alert.severity === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                      alert.severity === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500">{alert.category}</span>
                  </div>
                  <h4 className="font-medium mt-1">{alert.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                  {alert.suggestedAction && (
                    <p className="text-sm text-blue-600 mt-1">
                      Suggested: {alert.suggestedAction}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => resolveAlert(alert.id, 'Resolved via UI')}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No active alerts</p>
      )}
    </div>
  );
}

export default AITestPanel;
