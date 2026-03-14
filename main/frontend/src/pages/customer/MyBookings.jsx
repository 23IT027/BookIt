import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Search, Filter, ChevronDown, X,
  CheckCircle, XCircle, AlertCircle, RefreshCcw, MapPin, CreditCard, RotateCcw, Info
} from 'lucide-react';
import { bookingAPI, publicBookingAPI } from '../../api';
import { BookingList, UpcomingBookings } from '../../components/booking/BookingCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge, PaymentBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

const statusFilters = [
  { value: 'all', label: 'All Bookings', color: 'gray' },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'emerald' },
  { value: 'PENDING', label: 'Pending', color: 'amber' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'red' },
  { value: 'COMPLETED', label: 'Completed', color: 'blue' },
];

export function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelBookingData, setCancelBookingData] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const response = await bookingAPI.getCustomerBookings();
      const bookingsData = response.data.data?.bookings || response.data.bookings || response.data || [];
      setBookings(bookingsData);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelClick = (bookingId) => {
    const booking = bookings.find(b => b._id === bookingId);
    setCancelBookingData(booking);
    setShowCancelModal(true);
  };

  const handleCancelComplete = () => {
    fetchBookings();
    setShowCancelModal(false);
    setCancelBookingData(null);
  };

  const handleRescheduleClick = (bookingId) => {
    const booking = bookings.find(b => b._id === bookingId);
    if (booking) {
      setRescheduleBooking(booking);
      setShowRescheduleModal(true);
    }
  };

  const handleRescheduleComplete = () => {
    fetchBookings();
    setShowRescheduleModal(false);
    setRescheduleBooking(null);
  };

  const handleViewDetails = (bookingId) => {
    const booking = bookings.find(b => b._id === bookingId);
    if (booking) {
      setDetailsBooking(booking);
      setShowDetailsModal(true);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const status = booking.status?.toUpperCase?.() || booking.status;
    const appointmentType = booking.appointmentTypeId || booking.appointmentType;
    const provider = booking.providerId || booking.provider;
    
    const matchesFilter = activeFilter === 'all' || status === activeFilter;
    const matchesSearch = 
      appointmentType?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointmentType?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider?.businessName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const upcomingBookings = bookings.filter(
    b => new Date(b.startTime || b.slot?.date) >= new Date() && 
    (b.status?.toUpperCase?.() === 'CONFIRMED' || b.status === 'CONFIRMED')
  );

  const stats = {
    total: bookings.length,
    upcoming: upcomingBookings.length,
    completed: bookings.filter(b => b.status?.toUpperCase?.() === 'COMPLETED' || b.status === 'COMPLETED').length,
    cancelled: bookings.filter(b => b.status?.toUpperCase?.() === 'CANCELLED' || b.status === 'CANCELLED').length,
  };

  return (
    <div className="min-h-screen bg-dark-900 pb-12">
      {/* Cancel Modal with OTP Verification */}
      <CancelBookingModal
        booking={cancelBookingData}
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelBookingData(null);
        }}
        onCancelComplete={handleCancelComplete}
      />

      {/* Booking Details Modal */}
      <BookingDetailsModal
        booking={detailsBooking}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setDetailsBooking(null);
        }}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        booking={rescheduleBooking}
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setRescheduleBooking(null);
        }}
        onRescheduleComplete={handleRescheduleComplete}
      />

      {/* Header - Compact */}
      <div className="bg-dark-800/50 border-b border-white/5">
        <div className="container mx-auto px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-white">My Bookings</h1>
              <p className="text-sm text-gray-400">Manage and track your appointments</p>
            </div>

            {/* Stats - Inline on desktop */}
            <div className="flex gap-3 overflow-x-auto pb-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.total} Total</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.upcoming} Upcoming</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.completed} Done</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-400">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{stats.cancelled} Cancelled</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
            {/* Filters - Fixed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 mb-4 flex-shrink-0"
            >
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Status filter */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                    className={classNames(
                      'px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                      activeFilter === filter.value
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : 'bg-dark-700 text-gray-400 border border-white/5 hover:border-white/10'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Bookings list - Scrollable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex-1 overflow-y-auto pr-2 -mr-2"
            >
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="p-3">
                      <div className="flex gap-3">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="w-40 h-4" />
                          <Skeleton className="w-28 h-3" />
                          <Skeleton className="w-20 h-3" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title={searchQuery ? 'No bookings match your search' : 'No bookings yet'}
                  description={searchQuery ? 'Try a different search term' : 'Book your first appointment to get started'}
                  action={!searchQuery ? {
                    label: 'Browse Providers',
                    href: '/providers',
                  } : undefined}
                />
              ) : (
                <BookingList
                  bookings={filteredBookings}
                  onCancel={handleCancelClick}
                  onReschedule={handleRescheduleClick}
                  onViewDetails={handleViewDetails}
                />
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {/* Upcoming bookings widget */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white text-sm">Upcoming</h3>
                  <Badge variant="cyan">{upcomingBookings.length}</Badge>
                </div>
                
                {upcomingBookings.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto">
                    <UpcomingBookings 
                      bookings={upcomingBookings.slice(0, 5)}
                      onViewDetails={handleViewDetails}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-3">
                    No upcoming appointments
                  </p>
                )}
              </Card>
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-4">
                <h3 className="font-semibold text-white text-sm mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Link to="/providers">
                    <Button variant="secondary" size="sm" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      Book New Appointment
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full justify-start"
                    onClick={fetchBookings}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh Bookings
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    gray: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function BookingDetailsModal({ booking, isOpen, onClose }) {
  if (!booking) return null;

  // Handle both old and new data structures
  const provider = booking.providerId || booking.provider;
  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
  const status = booking.status?.toUpperCase?.() || booking.status;
  const paymentStatus = booking.paymentStatus?.toUpperCase?.() || booking.paymentStatus;
  const startTime = booking.startTime || booking.slot?.startTime;
  const endTime = booking.endTime || booking.slot?.endTime;
  const totalAmount = appointmentType?.price || booking.totalAmount || 0;
  const createdAt = booking.createdAt;
  const answers = booking.answers || [];
  
  // Refund and cancellation info
  const refundAmount = booking.refundAmount || 0;
  const refundStatus = booking.refundStatus || (paymentStatus === 'REFUNDED' ? 'PROCESSED' : null);
  const refundedAt = booking.refundedAt;
  const cancellationReason = booking.cancellationReason;
  const cancelledAt = booking.cancelledAt;
  const isCancelled = status === 'CANCELLED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Booking Details">
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={status} />
          <PaymentBadge status={paymentStatus} bookingStatus={status} />
        </div>

        {/* Cancellation Info - Show if cancelled */}
        {isCancelled && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="font-medium text-red-400">Booking Cancelled</p>
            </div>
            {cancellationReason && (
              <p className="text-sm text-gray-300 mb-2">
                <span className="text-gray-400">Reason:</span> {cancellationReason}
              </p>
            )}
            {cancelledAt && (
              <p className="text-xs text-gray-500">
                Cancelled on {formatDate(cancelledAt)} at {formatTime(cancelledAt)}
              </p>
            )}
          </div>
        )}

        {/* Refund Info - Show if there was a refund */}
        {isCancelled && (refundAmount > 0 || refundStatus) && (
          <div className={`p-4 rounded-xl border ${
            refundStatus === 'PROCESSED' 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <p className="font-medium text-white">Refund Details</p>
              </div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                refundStatus === 'PROCESSED' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : refundStatus === 'PENDING'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {refundStatus === 'PROCESSED' ? '✓ Completed' : refundStatus === 'PENDING' ? '⏳ Pending' : refundStatus || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-gray-400">Refunded Amount</p>
              <p className="text-xl font-bold text-emerald-400">₹{refundAmount.toFixed(2)}</p>
            </div>
            {refundedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Refunded on {formatDate(refundedAt)} at {formatTime(refundedAt)}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Refunds typically take 5-10 business days to appear on your statement.
            </p>
          </div>
        )}

        {/* No refund message for cancelled bookings without payment */}
        {isCancelled && refundAmount === 0 && !refundStatus && paymentStatus !== 'REFUNDED' && (
          <div className="p-4 rounded-xl bg-gray-700/50 border border-gray-600/30">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-400" />
              <p className="text-gray-400 text-sm">No refund applicable - booking was not paid</p>
            </div>
          </div>
        )}

        {/* Service & Provider */}
        <div className="p-4 rounded-xl bg-dark-700/50">
          <div className="flex items-start gap-4">
            {appointmentType?.images?.[0]?.url ? (
              <img 
                src={appointmentType.images[0].url}
                alt={appointmentType?.title}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-cyan-400" />
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-white">{appointmentType?.title || appointmentType?.name}</p>
              <p className="text-sm text-gray-400">with {provider?.name || provider?.businessName}</p>
              {provider?.contactEmail && (
                <p className="text-sm text-gray-500 mt-1">{provider.contactEmail}</p>
              )}
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <p className="text-sm text-gray-400">Date</p>
            </div>
            <p className="font-medium text-white">{formatDate(startTime)}</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-cyan-400" />
              <p className="text-sm text-gray-400">Time</p>
            </div>
            <p className="font-medium text-white">
              {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          </div>
        </div>

        {/* Resource - only show if booking has selected resource */}
        {booking.selectedResource?.name && (
          <div className="p-4 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <p className="text-sm text-gray-400">Resource</p>
            </div>
            <p className="font-medium text-white">{booking.selectedResource.name}</p>
          </div>
        )}

        {/* Location */}
        {(appointmentType?.location?.address || provider?.address) && (
          <div className="p-4 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <p className="text-sm text-gray-400">Location</p>
            </div>
            <p className="text-white">
              {appointmentType?.location?.address || 
               (typeof provider?.address === 'object' 
                 ? `${provider.address.street}, ${provider.address.city}` 
                 : provider?.address)}
            </p>
          </div>
        )}

        {/* Answers */}
        {answers.length > 0 && (
          <div className="p-4 rounded-xl bg-dark-700/50">
            <p className="text-sm text-gray-400 mb-3">Your Responses</p>
            <div className="space-y-3">
              {answers.map((a, i) => (
                <div key={i} className="border-l-2 border-cyan-500/30 pl-3">
                  <p className="text-sm text-gray-400">{a.question}</p>
                  <p className="text-white">{a.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <p className="text-gray-300">Total Amount</p>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Booking ID & Created at */}
        <div className="text-sm text-gray-500 text-center space-y-1">
          <p>Booking ID: <span className="font-mono text-gray-400">{booking._id}</span></p>
          <p>Booked on {formatDate(createdAt)}</p>
        </div>
      </div>
    </Modal>
  );
}

function RescheduleModal({ booking, isOpen, onClose, onRescheduleComplete }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reason, setReason] = useState('');

  const provider = booking?.providerId || booking?.provider;
  const appointmentType = booking?.appointmentTypeId || booking?.appointmentType;

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(new Date());
      setSelectedDate(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
      setReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDate && provider?.bookingSlug && appointmentType?._id) {
      fetchSlots();
    }
  }, [selectedDate]);

  const fetchSlots = async () => {
    setIsLoadingSlots(true);
    setSelectedSlot(null);
    try {
      // Format date as YYYY-MM-DD without timezone conversion
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await publicBookingAPI.getSlots(
        provider.bookingSlug,
        dateStr,
        appointmentType._id
      );
      const slots = response.data.data?.slots || response.data.slots || [];
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      toast.error('Failed to load available slots');
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      toast.error('Please select a new time slot');
      return;
    }

    setIsRescheduling(true);
    try {
      await bookingAPI.reschedule(booking._id, selectedSlot.startTime, reason);
      toast.success('Appointment rescheduled successfully!');
      onRescheduleComplete();
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error(error.response?.data?.message || 'Failed to reschedule appointment');
    } finally {
      setIsRescheduling(false);
    }
  };

  if (!booking) return null;

  // Calendar helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
        isPast: true
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isPast: date < today,
        isToday: date.toDateString() === today.toDateString()
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isPast: false
      });
    }
    
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCurrentMonth(prev);
    }
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    const maxMonth = new Date(today);
    maxMonth.setMonth(maxMonth.getMonth() + 2);
    if (next <= maxMonth) {
      setCurrentMonth(next);
    }
  };

  const isDateSelectable = (day) => {
    return day.isCurrentMonth && !day.isPast && !day.isToday;
  };

  const handleDateClick = (day) => {
    if (isDateSelectable(day)) {
      setSelectedDate(day.date);
      setSelectedSlot(null);
      setAvailableSlots([]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Appointment" size="lg">
      <div className="space-y-6">
        {/* Current Booking Info */}
        <div className="p-4 rounded-xl bg-dark-700/50 border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="font-medium text-white">{appointmentType?.title}</p>
              <p className="text-sm text-gray-400">with {provider?.name}</p>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-gray-400 mb-1">Current Time (will be cancelled)</p>
            <p className="text-red-400 font-medium line-through">
              {formatDate(booking.startTime)} at {formatTime(booking.startTime)}
            </p>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-dark-700/50 rounded-xl p-4 border border-white/10">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>
            <h3 className="text-lg font-semibold text-white">{monthName}</h3>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5 -rotate-90" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isSelected = selectedDate?.toDateString() === day.date.toDateString();
              const selectable = isDateSelectable(day);
              
              return (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  disabled={!selectable}
                  className={classNames(
                    'aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all',
                    !day.isCurrentMonth && 'text-gray-700',
                    day.isCurrentMonth && day.isPast && 'text-gray-600 cursor-not-allowed',
                    day.isToday && 'text-gray-500 border border-gray-600',
                    selectable && !isSelected && 'text-white hover:bg-cyan-500/20 cursor-pointer',
                    isSelected && 'bg-cyan-500 text-white',
                    !selectable && day.isCurrentMonth && !day.isPast && !day.isToday && 'text-gray-600'
                  )}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Available Times for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </label>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-gray-400">Loading available slots...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 bg-dark-700/50 rounded-xl border border-white/10">
                <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No available slots on this date</p>
                <p className="text-sm text-gray-500 mt-1">Try selecting a different day</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                {availableSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={classNames(
                      'px-3 py-2.5 rounded-lg text-sm font-medium transition-all border',
                      selectedSlot?.startTime === slot.startTime
                        ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/25'
                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600 hover:text-white border-white/10 hover:border-cyan-500/50'
                    )}
                  >
                    {formatTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New Time Preview */}
        {selectedSlot && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-400">New Appointment Time</p>
            </div>
            <p className="text-lg font-semibold text-white">
              {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-emerald-400 font-medium">
              {formatTime(selectedSlot.startTime)}
            </p>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason for rescheduling (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rescheduling?"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl bg-dark-700 text-white font-medium border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleReschedule}
            disabled={!selectedSlot || isRescheduling}
            className={classNames(
              'flex-1 px-6 py-3 rounded-xl font-medium flex items-center justify-center transition-all',
              selectedSlot && !isRescheduling
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            {isRescheduling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Rescheduling...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Reschedule
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CancelBookingModal({ booking, isOpen, onClose, onCancelComplete }) {
  const [step, setStep] = useState('confirm'); // 'confirm', 'otp', 'success'
  const [isRequestingOTP, setIsRequestingOTP] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [reason, setReason] = useState('');
  const [refundInfo, setRefundInfo] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const appointmentType = booking?.appointmentTypeId || booking?.appointmentType;
  const provider = booking?.providerId || booking?.provider;

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setOtp(['', '', '', '', '', '']);
      setReason('');
      setRefundInfo(null);
      setMaskedEmail('');
    }
  }, [isOpen]);

  const handleRequestOTP = async () => {
    setIsRequestingOTP(true);
    try {
      const response = await bookingAPI.requestCancelOTP(booking._id);
      const data = response.data.data || response.data;
      setRefundInfo({
        amount: data.refundAmount,
        percentage: data.refundPercentage
      });
      setMaskedEmail(data.email);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (error) {
      console.error('Failed to request OTP:', error);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsRequestingOTP(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs[Math.min(pastedData.length, 5)].current?.focus();
  };

  const handleConfirmCancel = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await bookingAPI.cancel(booking._id, otpString, reason);
      const data = response.data.data || response.data;
      setRefundInfo(data.refund);
      setStep('success');
      toast.success('Booking cancelled successfully!');
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onCancelComplete();
    } else {
      onClose();
    }
  };

  if (!booking) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={
      step === 'confirm' ? 'Cancel Booking' :
      step === 'otp' ? 'Verify Cancellation' :
      'Booking Cancelled'
    }>
      <div className="space-y-6">
        {step === 'confirm' && (
          <>
            {/* Booking Info */}
            <div className="p-4 rounded-xl bg-dark-700/50 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{appointmentType?.title}</p>
                  <p className="text-sm text-gray-400">with {provider?.name}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-600/50">
                <p className="text-sm text-gray-400">Scheduled for</p>
                <p className="text-white font-medium">
                  {formatDate(booking.startTime)} at {formatTime(booking.startTime)}
                </p>
              </div>
            </div>

            {/* Refund Info */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <p className="font-medium text-amber-400">Cancellation Policy</p>
              </div>
              <p className="text-sm text-gray-300">
                If cancelled, you will receive a <span className="font-bold text-emerald-400">90% refund</span> of the booking amount.
              </p>
              {appointmentType?.price > 0 && (
                <p className="text-lg font-bold text-emerald-400 mt-2">
                  Refund Amount: ₹{((appointmentType.price * 90) / 100).toFixed(2)}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you cancelling?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl bg-dark-700 text-white font-medium border border-white/10 transition-none"
              >
                Keep Booking
              </button>
              <button
                onClick={handleRequestOTP}
                disabled={isRequestingOTP}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500/10 text-red-400 font-medium border border-red-500/30 disabled:opacity-50 transition-none flex items-center justify-center"
              >
                {isRequestingOTP ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                    Sending OTP...
                  </>
                ) : (
                  'Proceed to Cancel'
                )}
              </button>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            {/* OTP Sent Info */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <p className="text-gray-300">
                We've sent a verification code to
              </p>
              <p className="font-medium text-white">{maskedEmail}</p>
            </div>

            {/* Refund Preview */}
            {refundInfo && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="text-sm text-gray-400 mb-1">You will receive</p>
                <p className="text-2xl font-bold text-emerald-400">₹{refundInfo.amount?.toFixed(2)}</p>
                <p className="text-xs text-gray-500">({refundInfo.percentage}% refund)</p>
              </div>
            )}

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
                Enter 6-digit OTP
              </label>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={inputRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                ))}
              </div>
            </div>

            {/* Resend */}
            <p className="text-center text-sm text-gray-500">
              Didn't receive the code?{' '}
              <button
                onClick={handleRequestOTP}
                disabled={isRequestingOTP}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Resend OTP
              </button>
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 px-6 py-3 rounded-xl bg-dark-700 text-white font-medium border border-white/10 transition-none"
              >
                Back
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={otp.join('').length !== 6 || isCancelling}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500/10 text-red-400 font-medium border border-red-500/30 disabled:opacity-50 transition-none flex items-center justify-center"
              >
                {isCancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            {/* Success Message */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Booking Cancelled</h3>
              <p className="text-gray-400">Your booking has been successfully cancelled.</p>
            </div>

            {/* Refund Confirmation */}
            {refundInfo?.refunded ? (
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">💰</span>
                  <p className="font-semibold text-emerald-400">Refund Processed!</p>
                </div>
                <p className="text-3xl font-bold text-emerald-400 mb-2">
                  ₹{refundInfo.amount?.toFixed(2)}
                </p>
                <p className="text-sm text-gray-400">
                  ({refundInfo.percentage}% of your payment has been refunded)
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  The refund will be credited to your original payment method within 5-10 business days.
                </p>
              </div>
            ) : refundInfo?.amount > 0 ? (
              <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">ℹ️</span>
                  <p className="font-semibold text-amber-400">No Payment to Refund</p>
                </div>
                <p className="text-sm text-gray-400">
                  {refundInfo.message || 'No payment was made for this booking.'}
                </p>
              </div>
            ) : null}

            {/* Close Button */}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

export default MyBookings;
