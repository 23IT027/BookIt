import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Mail, Phone, User, ChevronRight, 
  ChevronLeft, Check, AlertCircle, Globe, Loader2, CreditCard,
  CheckCircle, Star, Sparkles, ArrowRight, Shield, Zap
} from 'lucide-react';
import { publicBookingAPI, paymentAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatCurrency, classNames } from '../../utils/helpers';
import { formatLocalDate, addDaysFormatted } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

// Steps for booking flow
const STEPS = {
  SERVICE: 0,
  DATE_TIME: 1,
  DETAILS: 2,
  PAYMENT: 3,
  CONFIRMATION: 4
};

export function PublicBookingPage() {
  const { slug } = useParams();
  
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Booking state
  const [currentStep, setCurrentStep] = useState(STEPS.SERVICE);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  
  // Availability state
  const [availability, setAvailability] = useState({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  
  // Guest info
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  // Question answers
  const [questionAnswers, setQuestionAnswers] = useState({});
  
  // Booking result
  const [bookingResult, setBookingResult] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    fetchProviderData();
  }, [slug]);

  const fetchProviderData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [providerRes, servicesRes] = await Promise.all([
        publicBookingAPI.getProvider(slug),
        publicBookingAPI.getServices(slug)
      ]);
      
      const providerData = providerRes.data?.data?.provider || providerRes.data?.provider;
      const servicesData = servicesRes.data?.data?.appointmentTypes || servicesRes.data?.appointmentTypes || [];
      
      setProvider(providerData);
      setServices(servicesData);
    } catch (error) {
      console.error('Failed to fetch provider:', error);
      setError(error.response?.data?.message || 'Booking page not found');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async (date) => {
    if (!selectedService) return;
    
    setIsFetchingSlots(true);
    try {
      const response = await publicBookingAPI.getSlots(slug, date, selectedService._id);
      const slots = response.data?.data?.slots || response.data?.slots || [];
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      toast.error('Failed to load available times');
      setAvailableSlots([]);
    } finally {
      setIsFetchingSlots(false);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setCurrentStep(STEPS.DATE_TIME);
    // Fetch availability for the next 14 days
    fetchAvailabilityRange(service._id);
  };

  // Fetch availability for a date range
  const fetchAvailabilityRange = async (appointmentTypeId) => {
    setIsLoadingAvailability(true);
    try {
      const today = new Date();
      const startDate = formatLocalDate(today);
      const endDate = addDaysFormatted(today, 14);
      
      const response = await publicBookingAPI.getAvailabilityRange(
        slug,
        startDate,
        endDate,
        appointmentTypeId
      );
      
      const availabilityData = response.data?.data?.availability || response.data?.availability || {};
      setAvailability(availabilityData);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Don't show error - user can still select dates manually
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchAvailableSlots(date);
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    // Reset resource selection when slot changes
    setSelectedResource(null);
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
  };

  const handleContinueToDetails = () => {
    if (!selectedSlot) return;
    
    // Check if service has resources and resource is not selected
    if (selectedService?.hasResources && selectedService?.resources?.length > 0) {
      if (!selectedResource) {
        toast.error('Please select a resource');
        return;
      }
    }
    
    setCurrentStep(STEPS.DETAILS);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBooking = async () => {
    if (!guestInfo.name || !guestInfo.email) {
      toast.error('Please fill in your name and email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestInfo.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate required questions
    const questions = selectedService?.questions || [];
    const requiredQuestions = questions.filter(q => q.required);
    for (const q of requiredQuestions) {
      if (!questionAnswers[q.question] || questionAnswers[q.question].trim() === '') {
        toast.error(`Please answer: ${q.question}`);
        return;
      }
    }

    // Format answers for API
    const answers = Object.entries(questionAnswers)
      .filter(([_, answer]) => answer && answer.trim() !== '')
      .map(([question, answer]) => ({ question, answer }));
    
    setIsBooking(true);
    try {
      const bookingData = {
        appointmentTypeId: selectedService._id,
        startTime: selectedSlot.startTime,
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        customerNotes: guestInfo.notes,
        answers
      };
      
      // Add resourceId if a resource is selected
      if (selectedResource?.resourceId) {
        bookingData.resourceId = selectedResource.resourceId;
      }
      
      const response = await publicBookingAPI.createBooking(slug, bookingData);
      
      const booking = response.data?.data?.booking || response.data?.booking;
      const requiresPayment = response.data?.data?.requiresPayment || response.data?.requiresPayment;
      
      setBookingResult(booking);
      
      if (requiresPayment && selectedService.price > 0) {
        // Redirect to payment
        setCurrentStep(STEPS.PAYMENT);
      } else {
        // Free service - go to confirmation
        setCurrentStep(STEPS.CONFIRMATION);
        toast.success('Booking confirmed!');
      }
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error(error.response?.data?.message || 'Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  };

  const handlePayment = async () => {
    if (!bookingResult?._id) {
      toast.error('Booking not found');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await paymentAPI.createGuestCheckout(bookingResult._id, guestInfo.email);
      const sessionUrl = response.data?.data?.sessionUrl || response.data?.sessionUrl;
      
      if (sessionUrl) {
        // Redirect to Stripe checkout
        window.location.href = sessionUrl;
      } else {
        throw new Error('Failed to get payment URL');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
      setIsProcessingPayment(false);
    }
  };

  const handleSkipPayment = () => {
    // Allow proceeding without payment (payment pending)
    setCurrentStep(STEPS.CONFIRMATION);
    toast.success('Booking created! Payment can be completed later.');
  };

  // Generate next 14 days for date picker
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }).format(new Date(date));
  };

  const formatLongDate = (date) => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  const formatTime = (dateString) => {
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).format(new Date(dateString));
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/25">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <div className="absolute -inset-4 bg-cyan-500/20 rounded-3xl blur-xl animate-pulse" />
          </div>
          <p className="text-gray-400 font-medium">Loading booking page...</p>
        </motion.div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Page Not Found</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <Link to="/">
            <Button size="lg" className="px-8">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const stepLabels = ['Service', 'Date & Time', 'Details'];
  if (selectedService?.price > 0) {
    stepLabels.push('Payment');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-dark-800/50 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center gap-5">
            {provider?.avatar ? (
              <img 
                src={provider.avatar} 
                alt={provider.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <span className="text-2xl sm:text-3xl font-bold text-white">{provider?.name?.[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{provider?.name}</h1>
              {provider?.description && (
                <p className="text-gray-400 text-sm sm:text-base mt-1 line-clamp-2">{provider.description}</p>
              )}
              {provider?.specialization && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {provider.specialization}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      {currentStep < STEPS.CONFIRMATION && (
        <div className="relative border-b border-white/5 bg-dark-800/30 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 py-5">
            <div className="flex items-center justify-center gap-1 sm:gap-3">
              {stepLabels.map((step, index) => (
                <div key={step} className="flex items-center gap-1 sm:gap-3">
                  <motion.button
                    disabled={index > currentStep}
                    onClick={() => index < currentStep && setCurrentStep(index)}
                    className={classNames(
                      'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all',
                      currentStep === index 
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
                        : currentStep > index
                          ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer'
                          : 'bg-dark-700/50 text-gray-500'
                    )}
                    whileHover={index < currentStep ? { scale: 1.02 } : {}}
                    whileTap={index < currentStep ? { scale: 0.98 } : {}}
                  >
                    <span className={classNames(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      currentStep >= index ? 'bg-white/20' : 'bg-dark-600'
                    )}>
                      {currentStep > index ? <Check className="w-3 h-3" /> : index + 1}
                    </span>
                    <span className="hidden sm:block text-sm font-medium">{step}</span>
                  </motion.button>
                  {index < stepLabels.length - 1 && (
                    <div className={classNames(
                      'w-6 sm:w-12 h-0.5 rounded-full',
                      currentStep > index ? 'bg-cyan-500' : 'bg-dark-700'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="relative max-w-5xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          {/* Step 1: Select Service */}
          {currentStep === STEPS.SERVICE && (
            <motion.div
              key="service"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Choose a Service
                </h2>
                <p className="text-gray-400">Select from our available services below</p>
              </div>

              <div className="grid gap-4 max-w-2xl mx-auto">
                {services.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-gray-500/10 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-lg">No services available for booking</p>
                  </div>
                ) : (
                  services.map((service, index) => (
                    <motion.div
                      key={service._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card 
                        className="group p-5 sm:p-6 cursor-pointer hover:border-cyan-500/50 hover:bg-dark-700/50 transition-all duration-300"
                        onClick={() => handleServiceSelect(service)}
                      >
                        <div className="flex items-center gap-4">
                          {service.images?.[0]?.url ? (
                            <img 
                              src={service.images[0].url} 
                              alt={service.title}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                              <Sparkles className="w-6 h-6 text-cyan-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                              {service.title}
                            </h3>
                            {service.description && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{service.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                <Clock className="w-4 h-4 text-cyan-500" />
                                {service.durationMinutes} min
                              </div>
                              <div className={classNames(
                                "text-sm font-semibold px-3 py-1 rounded-full",
                                service.price > 0 
                                  ? "bg-cyan-500/10 text-cyan-400" 
                                  : "bg-green-500/10 text-green-400"
                              )}>
                                {service.price > 0 ? formatCurrency(service.price, service.currency) : 'Free'}
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-dark-600 group-hover:bg-cyan-500 items-center justify-center transition-colors">
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Date & Time */}
          {currentStep === STEPS.DATE_TIME && (
            <motion.div
              key="datetime"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-3xl mx-auto">
                {/* Selected Service Summary */}
                <Card className="p-4 mb-8 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{selectedService?.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {selectedService?.durationMinutes} min
                        </span>
                        <span className="text-cyan-400 font-medium">
                          {selectedService?.price > 0 ? formatCurrency(selectedService.price) : 'Free'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={handleBack}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </Card>

                <h2 className="text-xl font-bold text-white mb-2">Select a Date</h2>
                
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-400">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-400">Fully Booked</span>
                  </div>
                  {isLoadingAvailability && (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                      <span className="text-gray-400">Loading availability...</span>
                    </div>
                  )}
                </div>
                
                {/* Date Picker */}
                <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide -mx-4 px-4">
                  {getAvailableDates().map((date) => {
                    const dateStr = formatLocalDate(date);
                    const isSelected = selectedDate === dateStr;
                    const isToday = dateStr === formatLocalDate(new Date());
                    const dateAvailability = availability[dateStr];
                    const hasAvailability = dateAvailability?.hasAvailability;
                    const slotCount = dateAvailability?.availableSlots || 0;
                    const isLoaded = dateAvailability !== undefined;
                    
                    return (
                      <motion.button
                        key={dateStr}
                        onClick={() => handleDateSelect(dateStr)}
                        className={classNames(
                          'relative flex-shrink-0 p-4 rounded-2xl text-center min-w-[90px] transition-all border-2',
                          isSelected 
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white shadow-lg shadow-cyan-500/25' 
                            : isLoaded && !hasAvailability
                            ? 'bg-red-500/10 border-red-500/20 text-gray-500 opacity-60'
                            : isLoaded && hasAvailability
                            ? 'bg-dark-700/50 border-emerald-500/30 text-gray-300 hover:bg-dark-700'
                            : 'bg-dark-700/50 border-white/5 hover:border-cyan-500/30 text-gray-300 hover:bg-dark-700'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Availability dot */}
                        {!isSelected && isLoaded && (
                          <div className={classNames(
                            'absolute top-2 right-2 w-2 h-2 rounded-full',
                            hasAvailability ? 'bg-emerald-500' : 'bg-red-500'
                          )} />
                        )}
                        
                        <div className={classNames(
                          "text-xs font-medium mb-1",
                          isSelected ? "text-cyan-100" : "text-gray-500"
                        )}>
                          {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-2xl font-bold">{date.getDate()}</div>
                        <div className={classNames(
                          "text-xs mt-1",
                          isSelected ? "text-cyan-100" : "text-gray-500"
                        )}>
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        
                        {/* Slot count */}
                        {!isSelected && isLoaded && (
                          <div className={classNames(
                            "text-[10px] mt-1 font-medium",
                            hasAvailability ? "text-emerald-400" : "text-red-400"
                          )}>
                            {hasAvailability ? `${slotCount} slot${slotCount !== 1 ? 's' : ''}` : 'Full'}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <>
                    <h2 className="text-xl font-bold text-white mb-4">Select a Time</h2>
                    {isFetchingSlots ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center py-16 bg-dark-700/30 rounded-2xl border border-white/5">
                        <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">No available times for this date</p>
                        <p className="text-gray-500 text-sm mt-1">Try selecting a different date</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {availableSlots.map((slot, index) => {
                          const isSelected = selectedSlot?.startTime === slot.startTime;
                          return (
                            <motion.button
                              key={slot.startTime}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => handleSlotSelect(slot)
                              }
                              className={classNames(
                                'p-3 sm:p-4 rounded-xl text-center transition-all border-2 font-medium',
                                isSelected 
                                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white shadow-lg shadow-cyan-500/25' 
                                  : 'bg-dark-700/50 border-white/5 hover:border-cyan-500/30 text-gray-300 hover:bg-dark-700'
                              )}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {formatTime(slot.startTime)}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Resource Selection - Show if slot is selected and service has resources */}
                {selectedSlot && selectedService?.hasResources && selectedService?.resources?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8"
                  >
                    <h2 className="text-xl font-bold text-white mb-4">Select a Resource</h2>
                    <p className="text-gray-400 text-sm mb-4">
                      Choose which {selectedService.title?.toLowerCase() || 'resource'} you want to book
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(selectedSlot.availableResources || selectedService.resources.filter(r => r.isActive !== false)).map((resource, index) => {
                        const resourceId = resource.resourceId || resource._id;
                        const isSelected = selectedResource?.resourceId === resourceId || selectedResource?._id === resourceId;
                        return (
                          <motion.button
                            key={resourceId}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleResourceSelect({ resourceId: resourceId, name: resource.name })}
                            className={classNames(
                              'p-4 rounded-xl text-center transition-all border-2 font-medium',
                              isSelected 
                                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white shadow-lg shadow-cyan-500/25' 
                                : 'bg-dark-700/50 border-white/5 hover:border-cyan-500/30 text-gray-300 hover:bg-dark-700'
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="block text-lg">{resource.name}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Continue Button */}
                {selectedSlot && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8"
                  >
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleContinueToDetails}
                      disabled={selectedService?.hasResources && selectedService?.resources?.length > 0 && !selectedResource}
                    >
                      Continue
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Guest Details */}
          {currentStep === STEPS.DETAILS && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-2xl mx-auto">
                {/* Booking Summary Card */}
                <Card className="p-5 mb-8 bg-gradient-to-br from-dark-700/50 to-dark-800/50">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">Booking Summary</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="text-white font-medium">{formatLongDate(selectedSlot?.startTime)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Time</p>
                        <p className="text-white font-medium">
                          {formatTime(selectedSlot?.startTime)} · {selectedService?.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    {selectedResource && (
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Resource</p>
                          <p className="text-white font-medium">{selectedResource.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{selectedService?.title}</p>
                      <p className="text-xs text-gray-500">{provider?.name}</p>
                    </div>
                    <p className={classNames(
                      "text-xl font-bold",
                      selectedService?.price > 0 ? "text-cyan-400" : "text-green-400"
                    )}>
                      {selectedService?.price > 0 ? formatCurrency(selectedService.price) : 'Free'}
                    </p>
                  </div>
                </Card>

                <h2 className="text-xl font-bold text-white mb-6">Your Information</h2>
                
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          value={guestInfo.name}
                          onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                          placeholder="John Doe"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="email"
                          value={guestInfo.email}
                          onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                          placeholder="john@example.com"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number <span className="text-gray-500">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="tel"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all"
                      />
                    </div>
                  </div>

                  {/* Service Questions */}
                  {selectedService?.questions?.length > 0 && (
                    <div className="pt-6 border-t border-white/5">
                      <h3 className="text-lg font-semibold text-white mb-5">Additional Questions</h3>
                      <div className="space-y-5">
                        {selectedService.questions.map((q, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              {q.question} {q.required && <span className="text-red-400">*</span>}
                            </label>
                            {q.type === 'TEXTAREA' ? (
                              <textarea
                                value={questionAnswers[q.question] || ''}
                                onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.question]: e.target.value })}
                                placeholder="Enter your answer..."
                                rows={3}
                                className="w-full px-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all resize-none"
                              />
                            ) : q.type === 'SELECT' || q.type === 'RADIO' ? (
                              <select
                                value={questionAnswers[q.question] || ''}
                                onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.question]: e.target.value })}
                                className="w-full px-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all"
                              >
                                <option value="">Select an option...</option>
                                {q.options?.map((option, i) => (
                                  <option key={i} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={questionAnswers[q.question] || ''}
                                onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.question]: e.target.value })}
                                placeholder="Enter your answer..."
                                className="w-full px-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Additional Notes <span className="text-gray-500">(optional)</span>
                    </label>
                    <textarea
                      value={guestInfo.notes}
                      onChange={(e) => setGuestInfo({ ...guestInfo, notes: e.target.value })}
                      placeholder="Any special requests or information..."
                      rows={3}
                      className="w-full px-4 py-3.5 rounded-xl bg-dark-700/50 border-2 border-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-dark-700 transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <Button 
                    variant="secondary"
                    size="lg"
                    onClick={handleBack}
                    className="px-6"
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back
                  </Button>
                  <Button 
                    className="flex-1" 
                    size="lg"
                    onClick={handleBooking}
                    disabled={isBooking || !guestInfo.name || !guestInfo.email}
                  >
                    {isBooking ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : selectedService?.price > 0 ? (
                      <>
                        Continue to Payment
                        <CreditCard className="w-5 h-5 ml-2" />
                      </>
                    ) : (
                      <>
                        Confirm Booking
                        <Check className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Payment */}
          {currentStep === STEPS.PAYMENT && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-lg mx-auto text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <CreditCard className="w-10 h-10 text-cyan-400" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
                <p className="text-gray-400 mb-8">
                  Your booking has been reserved. Complete payment to confirm.
                </p>

                <Card className="p-6 mb-8 text-left">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <span className="text-gray-400">Service</span>
                    <span className="text-white font-medium">{selectedService?.title}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <span className="text-gray-400">Date & Time</span>
                    <span className="text-white font-medium">
                      {formatDate(selectedSlot?.startTime)} at {formatTime(selectedSlot?.startTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg text-gray-300">Total</span>
                    <span className="text-2xl font-bold text-cyan-400">
                      {formatCurrency(selectedService?.price)}
                    </span>
                  </div>
                </Card>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                  <Shield className="w-4 h-4" />
                  Secure payment powered by Stripe
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handlePayment}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting to payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay {formatCurrency(selectedService?.price)}
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="ghost"
                    className="w-full text-gray-400 hover:text-white"
                    onClick={handleSkipPayment}
                    disabled={isProcessingPayment}
                  >
                    Pay Later
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === STEPS.CONFIRMATION && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="max-w-lg mx-auto text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/25"
                >
                  <CheckCircle className="w-12 h-12 text-white" />
                </motion.div>
                
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold text-white mb-3"
                >
                  Booking Confirmed!
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 mb-8"
                >
                  A confirmation email has been sent to <span className="text-white">{guestInfo.email}</span>
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="p-6 text-left">
                    <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                      Booking Details
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Service</span>
                        <span className="text-white font-medium">{selectedService?.title}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Date</span>
                        <span className="text-white font-medium">{formatLongDate(selectedSlot?.startTime)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Time</span>
                        <span className="text-white font-medium">{formatTime(selectedSlot?.startTime)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Duration</span>
                        <span className="text-white font-medium">{selectedService?.durationMinutes} minutes</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Provider</span>
                        <span className="text-white font-medium">{provider?.name}</span>
                      </div>
                      <div className="flex justify-between py-3 mt-2 bg-dark-600/50 rounded-xl px-4 -mx-2">
                        <span className="text-gray-300">Status</span>
                        <span className={classNames(
                          "font-semibold px-3 py-1 rounded-full text-xs",
                          bookingResult?.paymentStatus === 'PAID' 
                            ? "bg-green-500/20 text-green-400"
                            : bookingResult?.status === 'CONFIRMED'
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-amber-500/20 text-amber-400"
                        )}>
                          {bookingResult?.paymentStatus === 'PAID' 
                            ? 'Paid & Confirmed' 
                            : bookingResult?.status === 'CONFIRMED'
                              ? 'Confirmed'
                              : 'Pending Approval'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8"
                >
                  <Link to="/">
                    <Button variant="secondary" size="lg" className="px-8">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back to Home
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-900/80 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-cyan-500" />
          <span className="text-sm text-gray-500">
            Powered by <span className="text-cyan-400 font-medium">BookingApp</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default PublicBookingPage;
