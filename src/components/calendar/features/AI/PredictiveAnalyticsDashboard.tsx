/**
 * PredictiveAnalyticsDashboard Component
 * 
 * AI-powered analytics dashboard showing coverage predictions,
 * burnout risk assessments, and staffing recommendations.
 * 
 * Part of Phase 5: AI Features
 */

import { useState, useMemo } from 'react';
import { useScheduleStore } from '@/store';
import type { 
  CoveragePrediction, 
  BurnoutRisk, 
  DemandForecast,
  StaffingRecommendation 
} from '@/lib/ai/predictiveAnalytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  BarChart3,
  Flame,
  Target,
  RefreshCw,
  ChevronRight,
  Info
} from 'lucide-react';

interface PredictiveAnalyticsDashboardProps {
  /** Additional CSS classes */
  className?: string;
}

// Mock data for demonstration
const MOCK_COVERAGE_PREDICTIONS: CoveragePrediction[] = [
  { date: '2026-03-07', predictedFillRate: 0.95, riskLevel: 'LOW', riskFactors: [] },
  { date: '2026-03-08', predictedFillRate: 0.88, riskLevel: 'MEDIUM', riskFactors: ['Weekend staffing below target'] },
  { date: '2026-03-09', predictedFillRate: 0.92, riskLevel: 'LOW', riskFactors: [] },
  { date: '2026-03-10', predictedFillRate: 0.78, riskLevel: 'HIGH', riskFactors: ['2 critical shifts unfilled', 'Low overall coverage (78%)'] },
  { date: '2026-03-11', predictedFillRate: 0.85, riskLevel: 'MEDIUM', riskFactors: ['1 critical shift unfilled'] },
  { date: '2026-03-12', predictedFillRate: 0.91, riskLevel: 'LOW', riskFactors: [] },
  { date: '2026-03-13', predictedFillRate: 0.73, riskLevel: 'CRITICAL', riskFactors: ['3 critical shifts unfilled', 'Weekend staffing below target', 'Holiday scheduling'] },
];

const MOCK_BURNOUT_RISKS: BurnoutRisk[] = [
  {
    providerId: 'p1',
    providerName: 'Dr. Sarah Chen',
    riskScore: 75,
    riskLevel: 'HIGH',
    factors: [
      { type: 'CONSECUTIVE_SHIFTS', severity: 8, description: '8 consecutive days scheduled' },
      { type: 'NIGHT_RATIO', severity: 65, description: '65% night shifts' }
    ],
    recommendations: ['Add break days', 'Balance with day shifts']
  },
  {
    providerId: 'p2',
    providerName: 'Dr. Michael Ross',
    riskScore: 45,
    riskLevel: 'MEDIUM',
    factors: [
      { type: 'WEEKEND_LOAD', severity: 45, description: '45% weekend shifts' }
    ],
    recommendations: ['Consider reducing weekend assignments']
  },
  {
    providerId: 'p3',
    providerName: 'Dr. Emily Wang',
    riskScore: 25,
    riskLevel: 'LOW',
    factors: [],
    recommendations: []
  }
];

const MOCK_DEMAND_FORECASTS: DemandForecast[] = [
  {
    period: { start: '2026-03-07', end: '2026-03-13' },
    expectedDemand: 95,
    confidence: 0.85,
    trend: 'INCREASING',
    factors: [
      { name: 'Seasonal Pattern', impact: 0.1, description: 'Spring increase typical' }
    ]
  },
  {
    period: { start: '2026-03-14', end: '2026-03-20' },
    expectedDemand: 102,
    confidence: 0.78,
    trend: 'INCREASING',
    factors: [
      { name: 'Holiday Season', impact: 0.15, description: 'St. Patrick\'s Day weekend' }
    ]
  },
  {
    period: { start: '2026-03-21', end: '2026-03-27' },
    expectedDemand: 88,
    confidence: 0.82,
    trend: 'STABLE',
    factors: []
  },
  {
    period: { start: '2026-03-28', end: '2026-04-03' },
    expectedDemand: 91,
    confidence: 0.80,
    trend: 'STABLE',
    factors: []
  }
];

const MOCK_RECOMMENDATIONS: StaffingRecommendation[] = [
  {
    date: '2026-03-10',
    currentStaffing: 18,
    recommendedStaffing: 22,
    gap: 4,
    confidence: 0.82,
    reasoning: ['2 critical shifts unfilled', 'Expected increase in admissions']
  },
  {
    date: '2026-03-13',
    currentStaffing: 15,
    recommendedStaffing: 21,
    gap: 6,
    confidence: 0.75,
    reasoning: ['Holiday weekend coverage needed', '3 critical shifts unfilled']
  }
];

/**
 * Predictive Analytics Dashboard
 * 
 * Comprehensive dashboard showing AI-generated insights:
 * - Coverage risk predictions
 * - Burnout risk assessment
 * - Demand forecasting
 * - Staffing recommendations
 */
export function PredictiveAnalyticsDashboard({
  className
}: PredictiveAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const criticalCount = MOCK_COVERAGE_PREDICTIONS.filter(
      p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH'
    ).length;
    
    const highBurnoutCount = MOCK_BURNOUT_RISKS.filter(
      r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL'
    ).length;

    const avgCoverage = MOCK_COVERAGE_PREDICTIONS.reduce(
      (sum, p) => sum + p.predictedFillRate, 0
    ) / MOCK_COVERAGE_PREDICTIONS.length;

    return {
      criticalCount,
      highBurnoutCount,
      avgCoverage: avgCoverage * 100,
      overallHealth: Math.round(avgCoverage * 100 - criticalCount * 5 - highBurnoutCount * 3)
    };
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" />
            Predictive Analytics
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          <SummaryMetric
            label="Overall Health"
            value={`${Math.max(0, summary.overallHealth)}%`}
            icon={<Target className="w-4 h-4" />}
            trend={summary.overallHealth >= 80 ? 'up' : 'down'}
            color={summary.overallHealth >= 80 ? 'green' : summary.overallHealth >= 60 ? 'amber' : 'red'}
          />
          <SummaryMetric
            label="Avg Coverage"
            value={`${summary.avgCoverage.toFixed(0)}%`}
            icon={<BarChart3 className="w-4 h-4" />}
            trend={summary.avgCoverage >= 85 ? 'up' : 'down'}
            color={summary.avgCoverage >= 85 ? 'green' : 'amber'}
          />
          <SummaryMetric
            label="At-Risk Days"
            value={summary.criticalCount.toString()}
            icon={<Calendar className="w-4 h-4" />}
            trend={summary.criticalCount === 0 ? 'up' : 'down'}
            color={summary.criticalCount === 0 ? 'green' : 'red'}
          />
          <SummaryMetric
            label="Burnout Risk"
            value={summary.highBurnoutCount.toString()}
            icon={<Flame className="w-4 h-4" />}
            trend={summary.highBurnoutCount === 0 ? 'up' : 'down'}
            color={summary.highBurnoutCount === 0 ? 'green' : 'amber'}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mx-4 mb-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="burnout">Burnout</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            <TabsContent value="overview" className="mt-0 space-y-3">
              <OverviewTab 
                predictions={MOCK_COVERAGE_PREDICTIONS}
                burnoutRisks={MOCK_BURNOUT_RISKS}
                recommendations={MOCK_RECOMMENDATIONS}
              />
            </TabsContent>

            <TabsContent value="coverage" className="mt-0 space-y-3">
              <CoverageTab predictions={MOCK_COVERAGE_PREDICTIONS} />
            </TabsContent>

            <TabsContent value="burnout" className="mt-0 space-y-3">
              <BurnoutTab burnoutRisks={MOCK_BURNOUT_RISKS} />
            </TabsContent>

            <TabsContent value="forecast" className="mt-0 space-y-3">
              <ForecastTab forecasts={MOCK_DEMAND_FORECASTS} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Summary metric card
function SummaryMetric({ 
  label, 
  value, 
  icon, 
  trend, 
  color 
}: { 
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: 'up' | 'down';
  color: 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <div className="text-center p-2 rounded-lg bg-slate-50">
      <div className={cn('inline-flex items-center gap-1 mb-1', colorClasses[color])}>
        {icon}
        {trend === 'up' ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// Overview tab content
function OverviewTab({
  predictions,
  burnoutRisks,
  recommendations
}: {
  predictions: CoveragePrediction[];
  burnoutRisks: BurnoutRisk[];
  recommendations: StaffingRecommendation[];
}) {
  const criticalPredictions = predictions.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH');
  const highBurnoutRisks = burnoutRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL');

  return (
    <div className="space-y-3">
      {/* Critical Issues */}
      {criticalPredictions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <h4 className="font-medium text-sm">Coverage Alerts</h4>
          </div>
          <div className="space-y-1">
            {criticalPredictions.slice(0, 2).map(prediction => (
              <div key={prediction.date} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{prediction.date}</span>
                <Badge variant="outline" className={getRiskColor(prediction.riskLevel)}>
                  {prediction.riskLevel}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Burnout Alerts */}
      {highBurnoutRisks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 mb-2">
            <Flame className="w-4 h-4" />
            <h4 className="font-medium text-sm">Burnout Risk</h4>
          </div>
          <div className="space-y-1">
            {highBurnoutRisks.slice(0, 2).map(risk => (
              <div key={risk.providerId} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{risk.providerName}</span>
                <span className="text-amber-600 font-medium">{risk.riskScore}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Target className="w-4 h-4" />
            <h4 className="font-medium text-sm">Recommendations</h4>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 2).map(rec => (
              <div key={rec.date} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{rec.date}</span>
                  <span className="text-blue-600">+{rec.gap} staff needed</span>
                </div>
                <p className="text-xs text-slate-500">{rec.reasoning[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Issues */}
      {criticalPredictions.length === 0 && highBurnoutRisks.length === 0 && recommendations.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p className="text-sm">No critical issues detected</p>
          <p className="text-xs">Schedule looks healthy!</p>
        </div>
      )}
    </div>
  );
}

// Coverage tab content
function CoverageTab({ predictions }: { predictions: CoveragePrediction[] }) {
  return (
    <div className="space-y-2">
      {predictions.map(prediction => (
        <div 
          key={prediction.date}
          className={cn(
            'border rounded-lg p-3 transition-all',
            prediction.riskLevel === 'CRITICAL' && 'border-red-300 bg-red-50',
            prediction.riskLevel === 'HIGH' && 'border-orange-300 bg-orange-50',
            prediction.riskLevel === 'MEDIUM' && 'border-amber-200 bg-amber-50',
            prediction.riskLevel === 'LOW' && 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{prediction.date}</span>
            <Badge variant="outline" className={getRiskColor(prediction.riskLevel)}>
              {prediction.riskLevel}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full rounded-full',
                  prediction.predictedFillRate >= 0.9 ? 'bg-green-500' :
                  prediction.predictedFillRate >= 0.8 ? 'bg-blue-500' :
                  prediction.predictedFillRate >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${prediction.predictedFillRate * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium w-10 text-right">
              {(prediction.predictedFillRate * 100).toFixed(0)}%
            </span>
          </div>

          {prediction.riskFactors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prediction.riskFactors.map((factor, i) => (
                <span key={i} className="text-xs text-slate-500 bg-white/50 px-2 py-0.5 rounded">
                  {factor}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Burnout tab content
function BurnoutTab({ burnoutRisks }: { burnoutRisks: BurnoutRisk[] }) {
  return (
    <div className="space-y-3">
      {burnoutRisks.map(risk => (
        <div 
          key={risk.providerId}
          className={cn(
            'border rounded-lg p-3',
            risk.riskLevel === 'CRITICAL' && 'border-red-300 bg-red-50',
            risk.riskLevel === 'HIGH' && 'border-orange-300 bg-orange-50',
            risk.riskLevel === 'MEDIUM' && 'border-amber-200 bg-amber-50',
            risk.riskLevel === 'LOW' && 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-sm">{risk.providerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-bold',
                risk.riskScore >= 70 ? 'text-red-600' :
                risk.riskScore >= 50 ? 'text-orange-600' :
                risk.riskScore >= 30 ? 'text-amber-600' : 'text-green-600'
              )}>
                {risk.riskScore}
              </span>
              <Badge variant="outline" className={getRiskColor(risk.riskLevel)}>
                {risk.riskLevel}
              </Badge>
            </div>
          </div>

          {/* Risk Factors */}
          {risk.factors.length > 0 && (
            <div className="space-y-1 mb-2">
              {risk.factors.map((factor, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Info className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600">{factor.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {risk.recommendations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {risk.recommendations.map((rec, i) => (
                <span key={i} className="text-xs bg-white/70 text-slate-600 px-2 py-0.5 rounded">
                  {rec}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Forecast tab content
function ForecastTab({ forecasts }: { forecasts: DemandForecast[] }) {
  return (
    <div className="space-y-3">
      {forecasts.map((forecast, index) => (
        <div key={index} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Week of {forecast.period.start}
            </span>
            <Badge variant="outline" className={getTrendColor(forecast.trend)}>
              {forecast.trend === 'INCREASING' && <TrendingUp className="w-3 h-3 mr-1" />}
              {forecast.trend === 'DECREASING' && <TrendingDown className="w-3 h-3 mr-1" />}
              {forecast.trend === 'STABLE' && <span className="w-3 h-3 mr-1">-</span>}
              {forecast.trend}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mb-2">
            <div>
              <p className="text-2xl font-bold">{forecast.expectedDemand}</p>
              <p className="text-xs text-slate-500">shifts needed</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${forecast.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {(forecast.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>
          </div>

          {forecast.factors.length > 0 && (
            <div className="space-y-1">
              {forecast.factors.map((factor, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600">{factor.description}</span>
                  <span className={cn(
                    'ml-auto',
                    factor.impact > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {factor.impact > 0 ? '+' : ''}{(factor.impact * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Helper functions
function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'CRITICAL':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'HIGH':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'MEDIUM':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    default:
      return 'text-green-600 bg-green-50 border-green-200';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'INCREASING':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'DECREASING':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

export default PredictiveAnalyticsDashboard;
