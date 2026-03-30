import { useState, useEffect } from 'react';
import { useScheduleStore } from '@/store';
import { CommunicationPreferences } from '@/types';
import { User, Mail, Phone, Bell, Zap, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FatigueIndicator } from './FatigueIndicator';

interface ProviderProfileEditorProps {
  providerId: string;
  className?: string;
  onClose?: () => void;
}

export function ProviderProfileEditor({ providerId, className, onClose }: ProviderProfileEditorProps) {
  const { providers, updateProvider } = useScheduleStore();
  const provider = providers.find((p) => p.id === providerId);

  const [communicationPrefs, setCommunicationPrefs] = useState<CommunicationPreferences>({
    sms: true,
    email: true,
    push: true,
  });
  const [autoApproveClaims, setAutoApproveClaims] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (provider) {
      setCommunicationPrefs(
        provider.communicationPreferences || {
          sms: true,
          email: true,
          push: true,
        }
      );
      setAutoApproveClaims(provider.autoApproveClaims || false);
    }
  }, [provider]);

  const handleSave = () => {
    if (!provider) return;
    
    updateProvider(providerId, {
      communicationPreferences: communicationPrefs,
      autoApproveClaims,
    });
    
    setHasChanges(false);
  };

  const handleToggle = (
    key: keyof CommunicationPreferences,
    value: boolean
  ) => {
    setCommunicationPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleAutoApproveToggle = (value: boolean) => {
    setAutoApproveClaims(value);
    setHasChanges(true);
  };

  if (!provider) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        Provider not found
      </div>
    );
  }

  return (
    <div className={cn('bg-card rounded-lg border shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{provider.email}</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Fatigue Indicator */}
      <div className="p-4 border-b">
        <FatigueIndicator providerId={providerId} showDetails />
      </div>

      {/* Communication Preferences */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Communication Preferences</h4>
        </div>

        <div className="space-y-3">
          {/* SMS Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">SMS Notifications</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('sms', !communicationPrefs.sms)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                communicationPrefs.sms
                  ? 'bg-primary'
                  : 'bg-secondary'
              )}
              role="switch"
              aria-checked={communicationPrefs.sms}
            >
              <motion.span
                initial={false}
                animate={{
                  x: communicationPrefs.sms ? 22 : 2,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
              />
            </button>
          </div>

          {/* Email Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Email Notifications</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('email', !communicationPrefs.email)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                communicationPrefs.email
                  ? 'bg-primary'
                  : 'bg-secondary'
              )}
              role="switch"
              aria-checked={communicationPrefs.email}
            >
              <motion.span
                initial={false}
                animate={{
                  x: communicationPrefs.email ? 22 : 2,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
              />
            </button>
          </div>

          {/* Push Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Push Notifications</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('push', !communicationPrefs.push)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                communicationPrefs.push
                  ? 'bg-primary'
                  : 'bg-secondary'
              )}
              role="switch"
              aria-checked={communicationPrefs.push}
            >
              <motion.span
                initial={false}
                animate={{
                  x: communicationPrefs.push ? 22 : 2,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Approve Toggle */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Auto-Approve Claims</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Automatically approve shift claims from marketplace without manual review
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Enable auto-approve</span>
          <button
            type="button"
            onClick={() => handleAutoApproveToggle(!autoApproveClaims)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              autoApproveClaims
                ? 'bg-primary'
                : 'bg-secondary'
            )}
            role="switch"
            aria-checked={autoApproveClaims}
          >
            <motion.span
              initial={false}
              animate={{
                x: autoApproveClaims ? 22 : 2,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="p-4 border-t bg-muted/30">
          <button
            type="button"
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
