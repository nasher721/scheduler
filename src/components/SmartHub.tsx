import { useState } from 'react';
import { useScheduleStore } from '@/store';
import { ProviderProfileEditor } from './profiles/ProviderProfileEditor';
import { FatigueIndicator } from './profiles/FatigueIndicator';
import { Users, User, Zap, LayoutDashboard, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getAvatarColor, getInitials } from '@/lib/utils';

type TabType = 'profiles' | 'fatigue' | 'overview';

interface SmartHubProps {
  className?: string;
}

export function SmartHub({ className }: SmartHubProps) {
  const { providers } = useScheduleStore();
  const [activeTab, setActiveTab] = useState<TabType>('profiles');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profiles', label: 'Provider Profiles', icon: <User className="w-4 h-4" /> },
    { id: 'fatigue', label: 'Fatigue Overview', icon: <Zap className="w-4 h-4" /> },
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  ];

  return (
    <div className={cn('bg-card rounded-lg border shadow-sm overflow-hidden', className)}>
      {/* Header with Tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-foreground">Smart Hub</h2>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-secondary rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>
        </div>

        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">
              {activeTab === 'profiles' && (
                <div className="space-y-4">
                  {/* Provider Selection */}
                  <div>
                    <label htmlFor="provider-select" className="text-sm font-medium text-foreground mb-2 block">
                      Select Provider
                    </label>
                    <select
                      id="provider-select"
                      value={selectedProviderId || ''}
                      onChange={(e) => setSelectedProviderId(e.target.value || null)}
                      className="w-full input-base rounded-lg"
                    >
                      <option value="">Choose a provider...</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Profile Editor */}
                  {selectedProviderId && (
                    <ProviderProfileEditor
                      providerId={selectedProviderId}
                      onClose={() => setSelectedProviderId(null)}
                    />
                  )}
                </div>
              )}

              {activeTab === 'fatigue' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Provider Fatigue Status
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {providers.map((provider) => (
                      <button
                        type="button"
                        key={provider.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors w-full text-left',
                          selectedProviderId === provider.id
                            ? 'border-primary bg-primary/5'
                            : 'bg-card hover:bg-muted/50'
                        )}
                        onClick={() => setSelectedProviderId(provider.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: getAvatarColor(provider.name) }}
                          >
                            {getInitials(provider.name)}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {provider.name}
                          </span>
                        </div>
                        <FatigueIndicator providerId={provider.id} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Quick Stats</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total Providers</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{providers.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">High Fatigue</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">
                        {providers.filter((p) => {
                          const slots = useScheduleStore.getState().slots.filter(
                            (s) => s.providerId === p.id
                          );
                          const today = new Date();
                          let consecutive = 0;
                          const sorted = [...slots].sort(
                            (a, b) =>
                              new Date(b.date).getTime() - new Date(a.date).getTime()
                          );
                          for (const slot of sorted) {
                            const diff = Math.floor(
                              (today.getTime() - new Date(slot.date).getTime()) /
                                (1000 * 60 * 60 * 24)
                            );
                            if (diff === consecutive) {
                              consecutive++;
                            } else {
                              break;
                            }
                          }
                          return consecutive >= 3;
                        }).length}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Active Profiles</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {providers.filter((p) => p.communicationPreferences).length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
