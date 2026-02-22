import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Clock, Plus, Trash2, Save, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  AlertCircle, Check, X, Building2
} from 'lucide-react';
import { availabilityAPI, providerAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:${minute}`);
  }
}

export function AvailabilityEditor() {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [availability, setAvailability] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [noProvider, setNoProvider] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchAvailability();
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    try {
      const response = await providerAPI.getByUser();
      const provider = response.data?.data?.provider || response.data?.provider || response.data;
      if (provider && provider._id) {
        setProviders([provider]);
        setSelectedProvider(provider._id);
        setNoProvider(false);
      } else {
        setProviders([]);
        setNoProvider(true);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      // Check if it's a 404 - meaning no provider exists
      if (error.response?.status === 404) {
        setNoProvider(true);
      } else {
        toast.error('Failed to load provider data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailability = async () => {
    setIsLoading(true);
    try {
      const response = await availabilityAPI.getByProvider(selectedProvider);
      const rules = response.data?.data?.availabilityRules || response.data?.availabilityRules || response.data || [];
      
      // Transform availability rules array to day-keyed format
      const transformed = {};
      DAYS.forEach(day => {
        transformed[day] = [];
      });
      
      // Group rules by dayOfWeek (0=Sunday, 1=Monday, etc.)
      if (Array.isArray(rules)) {
        rules.forEach(rule => {
          const dayIndex = rule.dayOfWeek;
          const dayName = DAYS[dayIndex];
          if (dayName) {
            transformed[dayName].push({
              _id: rule._id,
              startTime: rule.startTime,
              endTime: rule.endTime,
            });
          }
        });
      }
      
      setAvailability(transformed);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Initialize empty availability
      const empty = {};
      DAYS.forEach(day => {
        empty[day] = [];
      });
      setAvailability(empty);
    } finally {
      setIsLoading(false);
    }
  };

  const addTimeBlock = (day) => {
    const newBlock = { startTime: '09:00', endTime: '17:00' };
    setAvailability(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newBlock],
    }));
    setHasChanges(true);
  };

  const updateTimeBlock = (day, index, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].map((block, i) => 
        i === index ? { ...block, [field]: value } : block
      ),
    }));
    setHasChanges(true);
  };

  const removeTimeBlock = (day, index) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get current rules from backend to compare
      const currentResponse = await availabilityAPI.getByProvider(selectedProvider);
      const currentRules = currentResponse.data?.data?.availabilityRules || currentResponse.data?.availabilityRules || [];
      
      // Build a map of current rule IDs
      const existingRuleIds = new Set(currentRules.map(r => r._id));
      
      // Collect all operations
      const operations = [];
      
      // Process each day
      DAYS.forEach((day, dayIndex) => {
        const blocks = availability[day] || [];
        
        blocks.forEach(block => {
          if (block._id && existingRuleIds.has(block._id)) {
            // Update existing rule
            operations.push(
              availabilityAPI.update(block._id, {
                startTime: block.startTime,
                endTime: block.endTime,
              })
            );
            existingRuleIds.delete(block._id);
          } else if (!block._id) {
            // Create new rule
            operations.push(
              availabilityAPI.create({
                providerId: selectedProvider,
                dayOfWeek: dayIndex,
                startTime: block.startTime,
                endTime: block.endTime,
                effectiveFrom: new Date().toISOString(),
              })
            );
          }
        });
      });
      
      // Delete rules that no longer exist
      existingRuleIds.forEach(ruleId => {
        operations.push(availabilityAPI.delete(ruleId));
      });
      
      // Execute all operations
      await Promise.all(operations);
      
      toast.success('Availability saved successfully');
      // Refresh to get updated IDs
      await fetchAvailability();
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save availability:', error);
      toast.error(error.response?.data?.message || 'Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const copyDaySchedule = (fromDay, toDay) => {
    setAvailability(prev => ({
      ...prev,
      [toDay]: [...prev[fromDay]].map(block => ({ ...block })),
    }));
    setHasChanges(true);
  };

  const applyToAllWeekdays = (sourceDay) => {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const sourceBlocks = availability[sourceDay] || [];
    
    const updated = { ...availability };
    weekdays.forEach(day => {
      updated[day] = sourceBlocks.map(block => ({ ...block }));
    });
    
    setAvailability(updated);
    setHasChanges(true);
    toast.success('Applied to all weekdays');
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Availability"
        subtitle="Set your working hours for each day"
        action={
          !noProvider && (
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          )
        }
      />

      {/* No provider state */}
      {noProvider ? (
        <Card className="p-8">
          <EmptyState
            icon={Building2}
            title="No Provider Found"
            description="You need to create a provider profile before setting up your availability."
            action={
              <Link to="/organiser/providers">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Provider
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Provider selector */}
          {providers.length > 1 && (
            <Card className="p-4">
              <Select
                label="Select Provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                options={providers.map(p => ({ value: p._id, label: p.businessName }))}
              />
            </Card>
          )}

      {/* Unsaved changes warning */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300 flex-1">You have unsaved changes</p>
            <Button onClick={handleSave} disabled={isSaving} className="text-sm px-4 py-2">
              Save Now
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Availability grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(7)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-6" />
                <Skeleton className="flex-1 h-10" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {DAYS.map((day, dayIndex) => (
            <DaySchedule
              key={day}
              day={day}
              label={DAY_LABELS[dayIndex]}
              blocks={availability[day] || []}
              onAdd={() => addTimeBlock(day)}
              onUpdate={(index, field, value) => updateTimeBlock(day, index, field, value)}
              onRemove={(index) => removeTimeBlock(day, index)}
              onApplyToWeekdays={() => applyToAllWeekdays(day)}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function DaySchedule({ day, label, blocks, onAdd, onUpdate, onRemove, onApplyToWeekdays }) {
  const isWeekend = day === 'saturday' || day === 'sunday';
  const hasBlocks = blocks.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={classNames(
        'p-4',
        !hasBlocks && 'opacity-60'
      )}>
        <div className="flex items-start gap-4">
          {/* Day label */}
          <div className="w-24 flex-shrink-0">
            <span className={classNames(
              'text-lg font-semibold',
              hasBlocks ? 'text-white' : 'text-gray-500'
            )}>
              {label}
            </span>
            <p className="text-xs text-gray-500 capitalize">{day}</p>
          </div>

          {/* Time blocks */}
          <div className="flex-1 space-y-3">
            {blocks.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <X className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500 text-sm">Unavailable</span>
              </div>
            ) : (
              blocks.map((block, index) => (
                <TimeBlock
                  key={index}
                  block={block}
                  onUpdate={(field, value) => onUpdate(index, field, value)}
                  onRemove={() => onRemove(index)}
                />
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onAdd}
              className="text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            {hasBlocks && !isWeekend && (
              <Button
                variant="ghost"
                onClick={onApplyToWeekdays}
                className="text-sm text-gray-400"
                title="Apply to all weekdays"
              >
                Apply to weekdays
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function TimeBlock({ block, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-3">
      <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
      
      <div className="relative">
        <select
          value={block.startTime}
          onChange={(e) => onUpdate('startTime', e.target.value)}
          className="appearance-none px-4 py-2 pr-10 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer min-w-[100px]"
        >
          {TIME_SLOTS.map(time => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      <span className="text-gray-500">to</span>

      <div className="relative">
        <select
          value={block.endTime}
          onChange={(e) => onUpdate('endTime', e.target.value)}
          className="appearance-none px-4 py-2 pr-10 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer min-w-[100px]"
        >
          {TIME_SLOTS.map(time => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      <IconButton
        icon={Trash2}
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
      />
    </div>
  );
}

export default AvailabilityEditor;
