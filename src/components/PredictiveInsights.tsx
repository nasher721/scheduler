import { useState } from "react";
import { useScheduleStore } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  User, 
  Check, 
  X, 
  BarChart3,
  Lightbulb,
  Zap
} from "lucide-react";
import { format, parseISO } from "date-fns";

export function PredictiveInsights() {
  const {
    preferenceProfiles,
    mlSuggestions,
    providers,
    slots,
    analyzeProviderPatterns,
    generateMLSuggestions,
    applyMLSuggestion,
    dismissMLSuggestion,
  } = useScheduleStore();
  
  const [activeTab, setActiveTab] = useState<"suggestions" | "profiles">("suggestions");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate ML processing
    analyzeProviderPatterns();
    setIsAnalyzing(false);
  };

  const handleGenerateSuggestions = () => {
    generateMLSuggestions();
  };

  const unappliedSuggestions = mlSuggestions.filter(s => !s.applied);
  const profileCount = Object.keys(preferenceProfiles).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <Brain className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Predictive Insights</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              ML-powered scheduling recommendations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-primary/5 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {isAnalyzing ? "Analyzing..." : "Analyze Patterns"}
          </button>
          <button
            onClick={handleGenerateSuggestions}
            className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Suggestions
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Profiles</span>
          </div>
          <p className="text-2xl font-bold text-primary">{profileCount}</p>
          <p className="text-[10px] text-slate-400">of {providers.length} providers</p>
        </div>
        <div className="p-4 bg-success/5 rounded-2xl border border-success/10">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-success" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-success">Suggestions</span>
          </div>
          <p className="text-2xl font-bold text-success">{unappliedSuggestions.length}</p>
          <p className="text-[10px] text-slate-400">pending assignments</p>
        </div>
        <div className="p-4 bg-warning/5 rounded-2xl border border-warning/10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-warning" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-warning">Confidence</span>
          </div>
          <p className="text-2xl font-bold text-warning">
            {unappliedSuggestions.length > 0 
              ? Math.round(unappliedSuggestions.reduce((a, s) => a + s.confidence, 0) / unappliedSuggestions.length * 100) 
              : 0}%
          </p>
          <p className="text-[10px] text-slate-400">avg confidence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["suggestions", "profiles"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {tab === "suggestions" ? (
              <span className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Suggestions
                {unappliedSuggestions.length > 0 && (
                  <span className="bg-primary px-1.5 py-0.5 rounded-full text-[8px]">{unappliedSuggestions.length}</span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <User className="w-3.5 h-3.5" />
                Profiles
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {activeTab === "suggestions" ? (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {unappliedSuggestions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Brain className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-700">No Suggestions Yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Click "Generate Suggestions" to get ML-powered recommendations
                  </p>
                </div>
              ) : (
                unappliedSuggestions.map((suggestion) => {
                  const provider = providers.find(p => p.id === suggestion.providerId);
                  const slot = slots.find(s => s.id === suggestion.slotId);
                  if (!provider || !slot) return null;
                  
                  return (
                    <motion.div
                      key={suggestion.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-4 bg-white/40 rounded-2xl border border-slate-200/40"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-slate-800">
                              Assign {provider.name}
                            </span>
                            <span className="text-[10px] text-slate-400">to</span>
                            <span className="text-sm font-bold text-primary">
                              {slot.type} on {format(parseISO(slot.date), "MMM d")}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 mb-3">{suggestion.reason}</p>
                          
                          {/* Confidence bar */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] text-slate-400">Confidence:</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${suggestion.confidence * 100}%` }}
                                className={`h-full rounded-full ${
                                  suggestion.confidence > 0.8 ? "bg-success" :
                                  suggestion.confidence > 0.6 ? "bg-warning" : "bg-error"
                                }`}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                          
                          {/* Factor breakdown */}
                          <div className="flex flex-wrap gap-2">
                            {suggestion.factors.skillMatch > 0 && (
                              <span className="text-[9px] px-2 py-1 bg-primary/10 text-primary rounded-full">
                                ✓ Skills match
                              </span>
                            )}
                            {suggestion.factors.preferenceMatch > 0.3 && (
                              <span className="text-[9px] px-2 py-1 bg-success/10 text-success rounded-full">
                                ✓ Preference match
                              </span>
                            )}
                            {suggestion.factors.fairnessBalance > 0.5 && (
                              <span className="text-[9px] px-2 py-1 bg-warning/10 text-warning rounded-full">
                                ⚖ Under target
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => applyMLSuggestion(suggestion.id)}
                            className="p-2 bg-success/10 text-success rounded-xl hover:bg-success/20 transition-all"
                            title="Apply Suggestion"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => dismissMLSuggestion(suggestion.id)}
                            className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
                            title="Dismiss"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="profiles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {profileCount === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <User className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-700">No Profiles Yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Click "Analyze Patterns" to generate provider preference profiles
                  </p>
                </div>
              ) : (
                providers.map((provider) => {
                  const profile = preferenceProfiles[provider.id];
                  if (!profile) return null;
                  
                  return (
                    <motion.div
                      key={provider.id}
                      layout
                      className="p-4 bg-white/40 rounded-2xl border border-slate-200/40"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{provider.name}</h4>
                          
                          {/* Detected Patterns */}
                          {profile.detectedPatterns.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {profile.detectedPatterns.map((pattern, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Lightbulb className="w-3 h-3 text-warning" />
                                  <span className="text-xs text-slate-600">{pattern.description}</span>
                                  <span className="text-[9px] text-slate-400">
                                    ({Math.round(pattern.confidence * 100)}% confidence)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Shift Distribution */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(profile.historicalShiftDistribution)
                              .filter(([, count]) => count > 0)
                              .map(([type, count]) => (
                                <span key={type} className="text-[9px] px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                                  {type}: {count}
                                </span>
                              ))}
                          </div>
                          
                          {/* Swap Willingness */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Swap willingness:</span>
                            <div className="flex-1 h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${profile.swapWillingness * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600">
                              {Math.round(profile.swapWillingness * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400">
                            Updated {format(parseISO(profile.lastUpdated), "MMM d")}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
