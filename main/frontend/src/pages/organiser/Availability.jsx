import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Clock, Plus, Trash2, Save, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  AlertCircle, Check, X, Building2
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { availabilityAPI, providerAPI, appointmentTypeAPI, slotAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { classNames } from '../../utils/helpers';
import { useSlotUpdates } from '../../socket/useSocket';
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
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [availability, setAvailability] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [noProvider, setNoProvider] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchServices();
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (selectedService && activeTab === 'schedule') {
      fetchServiceAvailability();
    }
  }, [selectedService, activeTab]);

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
      if (error.response?.status === 404) {
        setNoProvider(true);
      } else {
        toast.error('Failed to load provider data');
      }
    }
  };

  const fetchServices = async () => {
    try {
      const response = await appointmentTypeAPI.getByProvider(selectedProvider);
      const data = response.data?.data?.appointmentTypes || response.data?.appointmentTypes || response.data || [];
      const activeServices = data.filter(s => s.isActive !== false);
      setServices(activeServices);
      if (activeServices.length > 0 && !selectedService) {
        setSelectedService(activeServices[0]._id);
        if (activeTab === 'schedule') {
           fetchServiceAvailabilityFor(activeServices[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
    }
  };

  const fetchServiceAvailability = async () => {
    const service = services.find(s => s._id === selectedService);
    fetchServiceAvailabilityFor(service);
  };

  const fetchServiceAvailabilityFor = (service) => {
    setIsLoading(true);
    try {
      const rules = service?.availability || [];
      const transformed = {};
      DAYS.forEach(day => {
        transformed[day] = [];
      });
      
      if (Array.isArray(rules)) {
        rules.forEach(rule => {
          const dayIndex = rule.dayOfWeek;
          const dayName = DAYS[dayIndex];
          if (dayName) {
            transformed[dayName].push({
              startTime: rule.startTime,
              endTime: rule.endTime,
            });
          }
        });
      }
      
      setAvailability(transformed);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to format availability:', error);
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
      if (!selectedService) {
        toast.error('No service selected');
        setIsSaving(false);
        return;
      }

      const newAvailability = [];
      DAYS.forEach((day, dayIndex) => {
        const blocks = availability[day] || [];
        blocks.forEach(block => {
          newAvailability.push({
            dayOfWeek: dayIndex,
            startTime: block.startTime,
            endTime: block.endTime,
            isActive: true
          });
        });
      });
      
      await appointmentTypeAPI.update(selectedService, {
        availability: newAvailability,
        useCustomAvailability: true
      });
      
      toast.success('Service availability saved successfully');
      await fetchServices(); // refresh services data
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
          !noProvider && activeTab === 'schedule' && (
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

      {/* Tabs */}
      {!noProvider && providers.length > 0 && (
        <div className="flex bg-dark-800 p-1 rounded-lg w-max border border-white/5 mb-6">
          <button
            onClick={() => setActiveTab('schedule')}
            className={classNames(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'schedule' 
                ? 'bg-dark-700 text-white shadow-sm border border-white/10' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            Working Hours
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={classNames(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'slots' 
                ? 'bg-dark-700 text-white shadow-sm border border-white/10' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            Available Slots
          </button>
        </div>
      )}

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
      ) : activeTab === 'schedule' ? (
        <>
          {/* Selectors */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
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
            {services.length > 0 && (
              <Card className="p-4">
                <Select
                  label="Select Service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  options={services.map(s => ({ value: s._id, label: s.title || s.name || s.serviceName }))}
                />
              </Card>
            )}
          </div>

          {services.length === 0 ? (
            <Card className="p-8">
              <EmptyState title="No Services Found" description="Create a service first before setting availability." action={
                <Link to="/organiser/appointment-types">
                  <Button><Plus className="w-4 h-4 mr-2" /> Add Service</Button>
                </Link>
              }/>
            </Card>
          ) : (
            <>
              {/* Unsaved changes warning */}
              <AnimatePresence>
                {hasChanges && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 mb-4"
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
        </>
      ) : (
        <AvailableSlotsViewer 
          providerId={selectedProvider} 
          services={services}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
        />
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

function AvailableSlotsViewer({ providerId, services, selectedService, setSelectedService }) {
  const [availabilityRange, setAvailabilityRange] = useState({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);

  const fetchAvailabilityRangeData = useCallback(async () => {
    setIsLoadingSlots(true);
    try {
      const today = new Date();
      const startDate = format(today, 'yyyy-MM-dd');
      const endDate = format(addDays(today, 6), 'yyyy-MM-dd');

      const response = await slotAPI.getAvailabilityRange(
        providerId,
        startDate,
        endDate,
        selectedService || undefined
      );

      const dayMap = response.data?.data?.availability || response.data?.availability || {};
      setAvailabilityRange(dayMap);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [providerId, selectedService]);

  // Use the socket hook to dynamically refresh slots when someone books
  useSlotUpdates(providerId, fetchAvailabilityRangeData, fetchAvailabilityRangeData);

  useEffect(() => {
    if (providerId) {
      fetchAvailabilityRangeData();
    }
  }, [fetchAvailabilityRangeData]);

  if (!providerId) return null;

  const today = new Date();
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(today, i);
    return format(d, 'yyyy-MM-dd');
  });

  return (
    <div className="space-y-6">
      <Card className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="font-semibold text-white">Available Slots</h3>
          <p className="text-sm text-gray-400">View generated slots for the next 7 days</p>
        </div>

        {services.length > 0 && (
          <div className="w-full sm:w-64">
             <Select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              options={[
                { value: '', label: 'All Services / Default' },
                ...services.map(s => ({ value: s._id, label: s.title || s.name || s.serviceName }))
              ]}
            />
          </div>
        )}
      </Card>

      {isLoadingSlots ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="w-32 h-6 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="w-20 h-8 rounded-full" />
                <Skeleton className="w-20 h-8 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {next7Days.map((dateStr) => {
            const dayData = availabilityRange[dateStr] || { hasAvailability: false, availableSlots: [] };
            const dateObj = new Date(dateStr);
            const isToday = dateStr === format(today, 'yyyy-MM-dd');

            return (
              <Card key={dateStr} className="p-5">
                <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                  <div className="w-32 flex-shrink-0">
                    <p className="font-medium text-white">
                      {isToday ? 'Today' : format(dateObj, 'EEEE')}
                    </p>
                    <p className="text-sm text-gray-400">
                      {format(dateObj, 'MMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex-1">
                    {!dayData.hasAvailability || dayData.availableSlots.length === 0 ? (
                      <div className="flex items-center gap-2 text-gray-500 py-1">
                        <X className="w-4 h-4" />
                        <span className="text-sm">No slots available</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {dayData.availableSlots.map((slotTime, i) => {
                          const timeVal = typeof slotTime === 'string' ? slotTime : slotTime.startTime || slotTime;
                          return (
                            <div 
                              key={i}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            >
                              {format(new Date(timeVal), 'h:mm a')}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AvailabilityEditor;
