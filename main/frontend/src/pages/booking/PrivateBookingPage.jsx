import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Mail, Phone, User, ChevronRight, 
  ChevronLeft, Check, AlertCircle, Globe, Loader2, CreditCard,
  CheckCircle, Lock, ArrowRight, Shield
} from 'lucide-react';
import { privateBookingAPI, paymentAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatCurrency, classNames } from '../../utils/helpers';
import { formatLocalDate, addDaysFormatted } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

// Steps for booking flow (simplified - no service selection needed)
const STEPS = {
  DATE_TIME: 0,
  DETAILS: 1,
  PAYMENT: 2,
  CONFIRMATION: 3
};

export function PrivateBookingPage() {
  const { token } = useParams();
  
  const [service, setService] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Booking state
  const [currentStep, setCurrentStep] = useState(STEPS.DATE_TIME);
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
    fetchPrivateService();
  }, [token]);

  const fetchPrivateService = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await privateBookingAPI.getService(token);
      const serviceData = response.data?.data?.service || response.data?.service;
      const providerData = response.data?.data?.provider || response.data?.provider;
      
      setService(serviceData);
      setProvider(providerData);
      
      // Fetch availability for the next 14 days
      fetchAvailabilityRange();
    } catch (error) {
      console.error('Failed to fetch private service:', error);
      setError(error.response?.data?.message || 'Private booking page not found or link has expired');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailabilityRange = async () => {
    setIsLoadingAvailability(true);
    try {
      const today = new Date();
      const startDate = formatLocalDate(today);
      const endDate = addDaysFormatted(today, 14);
      
      const response = await privateBookingAPI.getAvailabilityRange(
        token,
        startDate,
        endDate
      );
      
      const availabilityData = response.data?.data?.availability || response.data?.availability || {};
      setAvailability(availabilityData);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const fetchAvailableSlots = async (date) => {
    setIsFetchingSlots(true);
    try {
      const response = await privateBookingAPI.getSlots(token, date);
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

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchAvailableSlots(date);
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setSelectedResource(null);
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
  };

  const handleContinueToDetails = () => {
    if (!selectedSlot) return;
    
    // Check if service has resources and resource is not selected
    if (service?.hasResources && service?.resources?.length > 0) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestInfo.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate required questions
    const questions = service?.questions || [];
    const requiredQuestions = questions.filter(q => q.required);
    for (const q of requiredQuestions) {
      if (!questionAnswers[q.question] || questionAnswers[q.question].trim() === '') {
        toast.error(`Please answer: ${q.question}`);
        return;
      }
    }

    const answers = Object.entries(questionAnswers)
      .filter(([_, answer]) => answer && answer.trim() !== '')
      .map(([question, answer]) => ({ question, answer }));
    
    setIsBooking(true);
    try {
      const bookingData = {
        startTime: selectedSlot.startTime,
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        notes: guestInfo.notes,
        questionAnswers: answers
      };
      
      // Add resourceId if a resource is selected
      if (selectedResource?.resourceId) {
        bookingData.resourceId = selectedResource.resourceId;
      }
      
      const response = await privateBookingAPI.createBooking(token, bookingData);
      
      const booking = response.data?.data?.booking || response.data?.booking;
      const requiresPayment = response.data?.data?.requiresPayment || response.data?.requiresPayment;
      
      setBookingResult(booking);
      
      if (requiresPayment && service.price > 0) {
        setCurrentStep(STEPS.PAYMENT);
      } else {
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
    setCurrentStep(STEPS.CONFIRMATION);
    toast.success('Booking created! Payment can be completed later.');
  };

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
          <p className="text-gray-400 font-medium">Loading private booking...</p>
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
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Private Link Invalid</h2>
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

  const stepLabels = ['Date & Time', 'Your Details'];
  if (service?.price > 0) {
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
          <div className="flex items-center gap-2 text-cyan-400 text-sm mb-4">
            <Lock className="w-4 h-4" />
            <span>Private Booking</span>
          </div>
          <div className="flex items-center gap-5">
            {provider?.avatar ? (
              <img 
                src={provider.avatar} 
                alt={provider.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-cyan-500/30"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <span className="text-2xl sm:text-3xl font-bold text-white">{provider?.name?.[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{service?.title}</h1>
              <p className="text-gray-400 text-sm sm:text-base mt-1">{provider?.name}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Clock className="w-4 h-4" />
                  {service?.durationMinutes} min
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <CreditCard className="w-4 h-4" />
                  {formatCurrency(service?.price || 0)}
                </span>
              </div>
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
                    <span className="hidden sm:inline font-medium">{step}</span>
                  </motion.button>
                  {index < stepLabels.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Date & Time Selection */}
          {currentStep === STEPS.DATE_TIME && (
            <motion.div
              key="datetime"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Select a Date & Time</h2>
                <p className="text-gray-400">Choose when you'd like to book this service</p>
              </div>

              {/* Date Selector */}
              <div className="grid grid-cols-7 sm:grid-cols-7 gap-2 sm:gap-3">
                {getAvailableDates().map((date) => {
                  const dateStr = formatLocalDate(date);
                  const dayAvailability = availability[dateStr];
                  const isAvailable = dayAvailability?.available !== false;
                  const isSelected = selectedDate === dateStr;
                  
                  return (
                    <motion.button
                      key={dateStr}
                      onClick={() => isAvailable && handleDateSelect(dateStr)}
                      disabled={!isAvailable}
                      className={classNames(
                        'p-2 sm:p-3 rounded-xl text-center transition-all',
                        isSelected
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                          : isAvailable
                            ? 'bg-dark-700 hover:bg-dark-600 text-white'
                            : 'bg-dark-800 text-gray-600 cursor-not-allowed'
                      )}
                      whileHover={isAvailable ? { scale: 1.02 } : {}}
                      whileTap={isAvailable ? { scale: 0.98 } : {}}
                    >
                      <div className="text-xs text-gray-400 font-medium">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold mt-1">{date.getDate()}</div>
                      {isLoadingAvailability ? (
                        <div className="w-2 h-2 rounded-full bg-gray-600 mx-auto mt-1 animate-pulse" />
                      ) : (
                        <div className={classNames(
                          'w-2 h-2 rounded-full mx-auto mt-1',
                          isAvailable ? 'bg-green-500' : 'bg-gray-600'
                        )} />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Available Times for {formatDate(selectedDate)}
                  </h3>
                  
                  {isFetchingSlots ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-12 bg-dark-800/50 rounded-xl">
                      <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No available slots for this date</p>
                      <p className="text-gray-500 text-sm mt-1">Please try another date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <motion.button
                          key={slot.startTime}
                          onClick={() => handleSlotSelect(slot)}
                          className={classNames(
                            'px-4 py-3 rounded-xl font-medium transition-all',
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                              : 'bg-dark-700 hover:bg-dark-600 text-white'
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {formatTime(slot.startTime)}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Resource Selection - Show if slot is selected and service has resources */}
              {selectedSlot && service?.hasResources && service?.resources?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Select a Resource</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Choose which {service.title?.toLowerCase() || 'resource'} you want to book
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(selectedSlot.availableResources || service.resources.filter(r => r.isActive !== false)).map((resource, index) => {
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
                  className="flex justify-end pt-6"
                >
                  <Button 
                    size="lg" 
                    onClick={handleContinueToDetails}
                    disabled={service?.hasResources && service?.resources?.length > 0 && !selectedResource}
                    className="px-8 bg-gradient-to-r from-cyan-500 to-blue-600"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Details Form */}
          {currentStep === STEPS.DETAILS && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Your Details</h2>
                <p className="text-gray-400">Tell us a bit about yourself</p>
              </div>

              {/* Booking Summary */}
              <Card className="p-5 bg-cyan-500/5 border-cyan-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{service?.title}</p>
                    <p className="text-gray-400 text-sm">
                      {formatLongDate(selectedDate)} at {formatTime(selectedSlot?.startTime)}
                    </p>
                    {selectedResource && (
                      <p className="text-cyan-400 text-sm mt-1">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {selectedResource.name}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={guestInfo.phone}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={guestInfo.notes}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    rows={3}
                    placeholder="Any special requirements or notes..."
                  />
                </div>

                {/* Custom Questions */}
                {service?.questions?.map((q, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {q.question} {q.required && '*'}
                    </label>
                    {q.type === 'TEXTAREA' ? (
                      <textarea
                        value={questionAnswers[q.question] || ''}
                        onChange={(e) => setQuestionAnswers(prev => ({ 
                          ...prev, 
                          [q.question]: e.target.value 
                        }))}
                        className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        rows={3}
                        required={q.required}
                      />
                    ) : q.type === 'SELECT' || q.type === 'RADIO' ? (
                      <select
                        value={questionAnswers[q.question] || ''}
                        onChange={(e) => setQuestionAnswers(prev => ({ 
                          ...prev, 
                          [q.question]: e.target.value 
                        }))}
                        className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        required={q.required}
                      >
                        <option value="">Select an option</option>
                        {q.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={questionAnswers[q.question] || ''}
                        onChange={(e) => setQuestionAnswers(prev => ({ 
                          ...prev, 
                          [q.question]: e.target.value 
                        }))}
                        className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        required={q.required}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-6">
                <Button variant="secondary" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  size="lg" 
                  onClick={handleBooking}
                  disabled={isBooking}
                  className="px-8 bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : service?.price > 0 ? (
                    <>
                      Continue to Payment
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Confirm Booking
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Payment Step */}
          {currentStep === STEPS.PAYMENT && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
                <p className="text-gray-400">Secure payment via Stripe</p>
              </div>

              <Card className="p-6 space-y-6">
                {/* Booking Summary */}
                <div className="p-4 bg-dark-700 rounded-xl">
                  <h3 className="font-medium text-white mb-3">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Service</span>
                      <span className="text-white">{service?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date</span>
                      <span className="text-white">{formatLongDate(selectedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time</span>
                      <span className="text-white">{formatTime(selectedSlot?.startTime)}</span>
                    </div>
                    <div className="border-t border-white/10 my-3" />
                    <div className="flex justify-between text-lg font-medium">
                      <span className="text-white">Total</span>
                      <span className="text-cyan-400">{formatCurrency(service?.price || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Note */}
                <div className="flex items-start gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium text-sm">Secure Payment</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Your payment is processed securely through Stripe. We never store your card details.
                    </p>
                  </div>
                </div>

                {/* Payment Buttons */}
                <div className="space-y-3">
                  <Button
                    size="lg"
                    onClick={handlePayment}
                    disabled={isProcessingPayment}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecting to payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay {formatCurrency(service?.price || 0)}
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={handleSkipPayment}
                    className="w-full text-gray-400 hover:text-white"
                  >
                    Pay Later
                  </Button>
                </div>
              </Card>

              <div className="mt-4">
                <Button variant="secondary" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {/* Confirmation */}
          {currentStep === STEPS.CONFIRMATION && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto text-center"
            >
              <div className="relative mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-green-500/30"
                >
                  <CheckCircle className="w-12 h-12 text-white" />
                </motion.div>
                <div className="absolute -inset-4 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
              </div>

              <h2 className="text-3xl font-bold text-white mb-3">Booking Confirmed!</h2>
              <p className="text-gray-400 mb-8">
                A confirmation email has been sent to {guestInfo.email}
              </p>

              <Card className="p-6 text-left space-y-4 bg-dark-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{service?.title}</p>
                    <p className="text-gray-400 text-sm">with {provider?.name}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-white">{formatLongDate(selectedDate)}</p>
                      <p className="text-gray-400 text-sm">{formatTime(selectedSlot?.startTime)} ({service?.durationMinutes} min)</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-500" />
                    <p className="text-white">{guestInfo.email}</p>
                  </div>

                  {guestInfo.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-500" />
                      <p className="text-white">{guestInfo.phone}</p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="mt-8">
                <Link to="/">
                  <Button size="lg" variant="secondary" className="px-8">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default PrivateBookingPage;
