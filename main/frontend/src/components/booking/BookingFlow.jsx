import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Clock, CreditCard, Check, Loader2, AlertCircle, FileText, Layers, X } from 'lucide-react';
import { DatePicker } from '../calendar/DatePicker';
import { SlotGrid } from './SlotGrid';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import { formatLocalDate } from '../../utils/dateUtils';
import { slotAPI, bookingAPI, paymentAPI } from '../../api';
import { useSlotUpdates } from '../../socket/useSocket';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Base steps - questions and resources steps will be added dynamically if needed
const baseSteps = [
  { id: 'date', title: 'Select Date', icon: Calendar },
  { id: 'time', title: 'Choose Time', icon: Clock },
  { id: 'confirm', title: 'Confirm & Pay', icon: CreditCard },
];

const questionsStep = { id: 'questions', title: 'Details', icon: FileText };
const resourcesStep = { id: 'resources', title: 'Select Resource', icon: Layers };

export function BookingFlow({ provider, appointmentType, onComplete, onCancel }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [answers, setAnswers] = useState({});
  const [availability, setAvailability] = useState({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  
  // Check if this appointment type has questions or resources
  const hasQuestions = appointmentType?.questions?.length > 0;
  const hasResources = appointmentType?.hasResources && appointmentType?.resources?.length > 0;
  
  // Build steps dynamically - insert resources after time, questions before confirm if needed
  const steps = useMemo(() => {
    let result = [baseSteps[0], baseSteps[1]]; // date, time
    if (hasResources) {
      result.push(resourcesStep);
    }
    if (hasQuestions) {
      result.push(questionsStep);
    }
    result.push(baseSteps[2]); // confirm
    return result;
  }, [hasQuestions, hasResources]);
  const [error, setError] = useState(null);

  // Computed values
  const unitPrice = appointmentType?.price || 0;
  const totalPrice = unitPrice * selectedSlots.length;

  // Fetch availability for a date range
  const fetchAvailabilityForRange = useCallback(async (startDateObj, endDateObj) => {
    if (!provider?._id) return;

    // Check if we already have data for this range
    const startStr = format(startDateObj, 'yyyy-MM-dd');
    const endStr = format(endDateObj, 'yyyy-MM-dd');

    setIsLoadingAvailability(true);
    try {
      const response = await slotAPI.getAvailabilityRange(
        provider._id,
        startStr,
        endStr,
        appointmentType?._id
      );
      
      const availabilityData = response.data.data?.availability || response.data.availability || {};
      // Merge with existing availability data
      setAvailability(prev => ({ ...prev, ...availabilityData }));
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [provider?._id, appointmentType?._id]);

  // Fetch availability for the next 30 days when component mounts
  useEffect(() => {
    if (!provider?._id) return;

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true);
      try {
        const startDate = format(new Date(), 'yyyy-MM-dd');
        const endDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
        
        const response = await slotAPI.getAvailabilityRange(
          provider._id,
          startDate,
          endDate,
          appointmentType?._id
        );
        
        const availabilityData = response.data.data?.availability || response.data.availability || {};
        setAvailability(availabilityData);
      } catch (err) {
        console.error('Failed to fetch availability:', err);
        // Don't show error to user, they can still select dates manually
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [provider?._id, appointmentType?._id]);

  // Real-time slot updates callback
  const handleSlotTaken = useCallback((data) => {
    setSlots(prev => prev.map(slot => {
      if (slot.startTime === data.slot?.startTime) {
        return { ...slot, isAvailable: false };
      }
      return slot;
    }));

    // If any selected slot was taken, remove it from selection
    setSelectedSlots(prev => {
      const filtered = prev.filter(s => s.startTime !== data.slot?.startTime);
      if (filtered.length < prev.length) {
        setError('One of your selected slots was just booked by someone else.');
        toast.error('A slot was taken! Please review your selection.');
      }
      return filtered;
    });
  }, []);

  const handleBookingCancelled = useCallback((data) => {
    setSlots(prev => prev.map(slot => {
      if (slot.startTime === data.slot?.startTime) {
        return { ...slot, isAvailable: true };
      }
      return slot;
    }));
  }, []);

  // Connect to real-time updates
  const { isConnected } = useSlotUpdates(provider?._id, handleSlotTaken, handleBookingCancelled);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !provider?._id) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setError(null);
      setSelectedSlots([]);

      try {
        // Use local date components to avoid timezone issues
        const formattedDate = formatLocalDate(selectedDate);
        const response = await slotAPI.getAvailable(provider._id, formattedDate, appointmentType?._id);
        const slotsData = response.data.data?.slots || response.data.slots || response.data || [];
        setSlots(slotsData);
      } catch (err) {
        console.error('Failed to fetch slots:', err);
        setError('Failed to load available slots. Please try again.');
        setSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, provider?._id, appointmentType?._id]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setCurrentStep(1);
  };

  // Multi-select: toggle slot in/out of selectedSlots array
  const handleSlotSelect = (slot) => {
    setError(null);
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.startTime === slot.startTime);
      if (exists) {
        return prev.filter(s => s.startTime !== slot.startTime);
      }
      return [...prev, slot];
    });
    setSelectedResource(null);
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
    setError(null);
  };

  const handleConfirmSlot = () => {
    if (selectedSlots.length > 0) {
      // Go to next step (resources if has resources, questions if has questions, otherwise confirm)
      setCurrentStep(2);
    }
  };

  const handleResourceConfirm = () => {
    if (!selectedResource) {
      setError('Please select a resource');
      return;
    }
    // Move to next step (questions if has questions, otherwise confirm)
    const nextStepIndex = steps.findIndex(s => s.id === 'resources') + 1;
    setCurrentStep(nextStepIndex);
  };

  // Handle answer changes for questions
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Validate all required questions are answered
  const validateAnswers = () => {
    if (!hasQuestions) return true;
    
    const requiredQuestions = appointmentType.questions.filter(q => q.required);
    for (const q of requiredQuestions) {
      const answer = answers[q._id || q.question];
      if (!answer || answer.trim() === '') {
        setError(`Please answer: ${q.question}`);
        return false;
      }
    }
    return true;
  };

  // Proceed from questions to confirm step
  const handleQuestionsSubmit = () => {
    if (validateAnswers()) {
      const confirmStepIndex = steps.findIndex(s => s.id === 'confirm');
      setCurrentStep(confirmStepIndex);
    }
  };

  // Remove a single slot from the confirm page
  const handleRemoveSlot = (slot) => {
    setSelectedSlots(prev => prev.filter(s => s.startTime !== slot.startTime));
  };

  const handleBookAndPay = async () => {
    if (selectedSlots.length === 0 || !selectedDate) return;

    // Validate resource selection if service has resources
    if (hasResources && !selectedResource) {
      setError('Please select a resource');
      return;
    }

    // Validate answers if there are required questions
    if (!validateAnswers()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Format answers as array of { question, answer } objects
      const formattedAnswers = hasQuestions
        ? appointmentType.questions.map(q => ({
            question: q.question,
            answer: answers[q._id || q.question] || ''
          })).filter(a => a.answer) // Only include non-empty answers
        : [];

      // Create a booking for each selected slot
      const bookingPromises = selectedSlots.map(async (slot) => {
        const startTime = typeof slot.startTime === 'string' && slot.startTime.includes('T')
          ? slot.startTime
          : new Date(`${formatLocalDate(selectedDate)}T${slot.startTime}`).toISOString();

        const bookingPayload = {
          appointmentTypeId: appointmentType._id,
          providerId: provider._id,
          startTime,
          answers: formattedAnswers,
        };

        if (hasResources && selectedResource) {
          bookingPayload.resourceId = selectedResource.resourceId || selectedResource._id;
        }

        const bookingResponse = await bookingAPI.create(bookingPayload);
        return bookingResponse.data.data?.booking || bookingResponse.data.booking || bookingResponse.data;
      });

      const bookings = await Promise.all(bookingPromises);

      // Check if payment is required
      if (unitPrice > 0) {
        if (bookings.length === 1) {
          // Single booking — use existing single-checkout flow
          const paymentResponse = await paymentAPI.createCheckout(bookings[0]._id);
          const checkoutUrl = paymentResponse.data.data?.sessionUrl || paymentResponse.data.sessionUrl ||
                             paymentResponse.data.data?.url || paymentResponse.data.url;
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
          }
        } else {
          // Multiple bookings — use multi-checkout
          const bookingIds = bookings.map(b => b._id);
          const paymentResponse = await paymentAPI.createMultiCheckout(bookingIds);
          const checkoutUrl = paymentResponse.data.data?.sessionUrl || paymentResponse.data.sessionUrl ||
                             paymentResponse.data.data?.url || paymentResponse.data.url;
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
          }
        }
      }

      // If free appointment or payment not required
      toast.success(bookings.length > 1 ? `${bookings.length} bookings confirmed!` : 'Booking confirmed!');
      onComplete?.(bookings.length === 1 ? bookings[0] : bookings);
      navigate('/my-bookings');

    } catch (err) {
      console.error('Booking failed:', err);
      
      // Handle 409 Conflict - slot already taken
      if (err.response?.status === 409) {
        setError('One or more slots were just booked by someone else. Please select different times.');
        toast.error('Slot already booked! Please choose another time.');
        setCurrentStep(1); // Go back to time selection
        setSelectedSlots([]);
        // Refresh slots
        const formattedDate = formatLocalDate(selectedDate);
        const response = await slotAPI.getAvailable(provider._id, formattedDate, appointmentType?._id);
        setSlots(response.data.data?.slots || response.data.slots || []);
      } else {
        setError(err.response?.data?.message || 'Booking failed. Please try again.');
        toast.error(err.response?.data?.message || 'Booking failed');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onCancel?.();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* Progress steps - Fixed at top */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 relative">
              <div className="flex items-center">
                <div className={classNames(
                  'w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors',
                  index < currentStep
                    ? 'bg-cyan-500 text-white'
                    : index === currentStep
                    ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                    : 'bg-dark-700 text-gray-500'
                )}>
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={classNames(
                    'flex-1 h-0.5 mx-2',
                    index < currentStep ? 'bg-cyan-500' : 'bg-dark-700'
                  )} />
                )}
              </div>
              <p className={classNames(
                'text-xs mt-1.5 font-medium',
                index <= currentStep ? 'text-gray-300' : 'text-gray-500'
              )}>
                {step.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Error message - Fixed */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 flex-shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {steps[currentStep]?.id === 'date' && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Select a Date</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Dates with available slots are highlighted in green
                </p>
                <DatePicker
                  selectedDate={selectedDate}
                  onDateChange={handleDateSelect}
                  minDate={new Date()}
                  availability={availability}
                  isLoadingAvailability={isLoadingAvailability}
                  onVisibleRangeChange={fetchAvailabilityForRange}
                />
              </Card>
            )}

            {steps[currentStep]?.id === 'time' && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Available Times</h3>
                    <p className="text-sm text-gray-400">{formatDate(selectedDate)}</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Change date
                  </button>
                </div>

                <SlotGrid
                  slots={slots}
                  selectedSlots={selectedSlots}
                  onSlotSelect={handleSlotSelect}
                  multiSelect={true}
                  isLoading={isLoadingSlots}
                  isConnected={isConnected}
                />

                {/* Selected slots summary pill */}
                {selectedSlots.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 pt-4 border-t border-white/5"
                  >
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedSlots.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          {formatTime(s.startTime)}
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveSlot(s); }} className="hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <Button onClick={handleConfirmSlot} className="w-full">
                      Continue with {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
                      {unitPrice > 0 && ` — ${formatCurrency(totalPrice)}`}
                    </Button>
                  </motion.div>
                )}
              </Card>
            )}

            {steps[currentStep]?.id === 'resources' && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Select a Resource</h3>
                <p className="text-sm text-gray-400 mb-6">
                  Choose which {appointmentType?.title?.toLowerCase() || 'resource'} you want to book
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(selectedSlots[0]?.availableResources || appointmentType?.resources?.filter(r => r.isActive !== false))?.map((resource, index) => {
                    const resourceId = resource.resourceId || resource._id;
                    const isSelected = selectedResource?.resourceId === resourceId || selectedResource?._id === resourceId;
                    return (
                      <motion.button
                        key={resourceId || index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        type="button"
                        onClick={() => handleResourceSelect({ resourceId: resourceId, name: resource.name })}
                        className={classNames(
                          'p-4 rounded-xl text-center transition-all border-2 font-medium',
                          isSelected 
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white shadow-lg shadow-cyan-500/25' 
                            : 'bg-dark-700/50 border-white/5 hover:border-cyan-500/30 text-gray-300 hover:bg-dark-700'
                        )}
                      >
                        <span className="block text-lg">{resource.name}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {selectedResource && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <Button onClick={handleResourceConfirm} className="w-full">
                      Continue with {selectedResource.name}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {steps[currentStep]?.id === 'questions' && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Additional Details</h3>
                <p className="text-sm text-gray-400 mb-6">Please answer the following questions</p>

                <div className="space-y-4">
                  {appointmentType?.questions?.map((q, index) => (
                    <div key={q._id || index} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        {q.question}
                        {q.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {q.type === 'TEXTAREA' ? (
                        <textarea
                          value={answers[q._id || q.question] || ''}
                          onChange={(e) => handleAnswerChange(q._id || q.question, e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                          placeholder="Type your answer..."
                        />
                      ) : q.type === 'SELECT' && q.options?.length > 0 ? (
                        <select
                          value={answers[q._id || q.question] || ''}
                          onChange={(e) => handleAnswerChange(q._id || q.question, e.target.value)}
                          className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                        >
                          <option value="">Select an option</option>
                          {q.options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={answers[q._id || q.question] || ''}
                          onChange={(e) => handleAnswerChange(q._id || q.question, e.target.value)}
                          className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                          placeholder="Type your answer..."
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5">
                  <Button onClick={handleQuestionsSubmit} className="w-full">
                    Continue to Confirmation
                  </Button>
                </div>
              </Card>
            )}

            {steps[currentStep]?.id === 'confirm' && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Confirm Your Booking</h3>

                {/* Booking summary */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-dark-700/50">
                      <p className="text-xs text-gray-400 mb-1">Service</p>
                      <p className="font-medium text-white text-sm">{appointmentType?.title || appointmentType?.name}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-dark-700/50">
                      <p className="text-xs text-gray-400 mb-1">Provider</p>
                      <p className="font-medium text-white text-sm">{provider?.name || provider?.businessName}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-700/50">
                    <p className="text-xs text-gray-400 mb-1">Date</p>
                    <p className="font-medium text-white text-sm">{formatDate(selectedDate)}</p>
                  </div>

                  {/* Selected slots list */}
                  <div className="p-3 rounded-lg bg-dark-700/50">
                    <p className="text-xs text-gray-400 mb-2">
                      Selected Slots ({selectedSlots.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSlots.map((slot, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(slot.startTime)}
                          {selectedSlots.length > 1 && (
                            <button
                              onClick={() => handleRemoveSlot(slot)}
                              className="ml-1 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resource - only show if service has resources */}
                  {hasResources && selectedResource && (
                    <div className="p-3 rounded-lg bg-dark-700/50">
                      <p className="text-xs text-gray-400 mb-1">Resource</p>
                      <p className="font-medium text-white text-sm">{selectedResource.name}</p>
                    </div>
                  )}

                  {/* Price breakdown */}
                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    {selectedSlots.length > 1 && (
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-gray-400 text-xs">
                          {formatCurrency(unitPrice)} × {selectedSlots.length} slots
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-gray-300 text-sm">Total Amount</p>
                      <p className="text-xl font-bold text-cyan-400">
                        {formatCurrency(totalPrice)}
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleBookAndPay} 
                  disabled={isProcessing || selectedSlots.length === 0}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : totalPrice > 0 ? (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay {formatCurrency(totalPrice)}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {selectedSlots.length > 1 ? `Confirm ${selectedSlots.length} Bookings` : 'Confirm Booking'}
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center mt-3">
                  {totalPrice > 0 ? "You'll be redirected to Stripe for secure payment" : 'Your bookings will be confirmed instantly'}
                </p>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between flex-shrink-0">
        <Button variant="ghost" onClick={goBack} size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {steps[currentStep]?.id === 'time' && selectedSlots.length > 0 && (
          <Button onClick={handleConfirmSlot} size="sm">
            Continue
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
