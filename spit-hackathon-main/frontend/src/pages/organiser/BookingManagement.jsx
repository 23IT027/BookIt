import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, Filter, Calendar, Clock, CheckCircle, XCircle, 
  AlertCircle, RefreshCcw, Eye, MoreVertical, RotateCcw, CreditCard, Info,
  ChevronLeft, ChevronRight, Sun, Sunset, Moon, Building2, Plus
} from 'lucide-react';
import { bookingAPI, providerAPI, publicBookingAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge, PaymentBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

const statusFilters = [
  { value: 'all', label: 'All', icon: Calendar },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
];

export function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [provider, setProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noProvider, setNoProvider] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionBooking, setActionBooking] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

  useEffect(() => {
    fetchProvider();
  }, []);

  useEffect(() => {
    if (provider?._id) {
      fetchBookings();
    }
  }, [provider]);

  const fetchProvider = async () => {
    try {
      const response = await providerAPI.getByUser();
      const providerData = response.data?.data?.provider || response.data?.provider || response.data;
      if (providerData && providerData._id) {
        setProvider(providerData);
        setNoProvider(false);
      } else {
        setNoProvider(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch provider:', error);
      if (error.response?.status === 404) {
        setNoProvider(true);
      }
      setIsLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!provider?._id) return;
    
    setIsLoading(true);
    try {
      const response = await bookingAPI.getProviderBookings(provider._id);
      const bookingsData = response.data?.data?.bookings || response.data?.bookings || response.data || [];
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!actionBooking || !actionType) return;

    setIsProcessing(true);
    try {
      if (actionType === 'confirm') {
        await bookingAPI.updateStatus(actionBooking._id, 'CONFIRMED');
        toast.success('Booking confirmed');
      } else if (actionType === 'cancel') {
        await bookingAPI.cancel(actionBooking._id);
        toast.success('Booking cancelled');
      } else if (actionType === 'complete') {
        await bookingAPI.updateStatus(actionBooking._id, 'COMPLETED');
        toast.success('Booking marked as completed');
      }
      fetchBookings();
    } catch (error) {
      console.error('Failed to update booking:', error);
      toast.error(error.response?.data?.message || 'Failed to update booking');
    } finally {
      setIsProcessing(false);
      setActionBooking(null);
      setActionType(null);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const status = booking.status?.toUpperCase?.() || booking.status;
    const customer = booking.customerId || booking.user;
    const appointmentType = booking.appointmentTypeId || booking.appointmentType;
    const guestInfo = booking.guestInfo;
    const isGuest = booking.isGuestBooking;
    
    const matchesFilter = activeFilter === 'all' || status?.toLowerCase() === activeFilter;
    const matchesSearch = 
      (isGuest && guestInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (isGuest && guestInfo?.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointmentType?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointmentType?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Group bookings by date
  const groupedBookings = filteredBookings.reduce((acc, booking) => {
    const startTime = booking.startTime || booking.slot?.date;
    const date = startTime ? new Date(startTime).toISOString().split('T')[0] : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(booking);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedBookings).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Bookings"
        subtitle="Manage all your appointment bookings"
        action={
          !noProvider && (
            <Button variant="secondary" onClick={fetchBookings}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
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
            description="You need to create a provider profile before managing bookings."
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
          {/* Action Modal */}
          <ConfirmModal
        isOpen={!!actionBooking && !!actionType}
        onClose={() => { setActionBooking(null); setActionType(null); }}
        onConfirm={handleStatusChange}
        title={
          actionType === 'confirm' ? 'Confirm Booking' :
          actionType === 'cancel' ? 'Cancel Booking' :
          'Complete Booking'
        }
        message={
          actionType === 'confirm' ? 'Are you sure you want to confirm this booking?' :
          actionType === 'cancel' ? 'Are you sure you want to cancel this booking? The customer will be notified and refunded if applicable.' :
          'Mark this booking as completed?'
        }
        confirmText={
          actionType === 'confirm' ? 'Confirm' :
          actionType === 'cancel' ? 'Cancel Booking' :
          'Mark Complete'
        }
        isLoading={isProcessing}
      />

      {/* Details Modal */}
      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedBooking(null); }}
      />

      {/* Reschedule Modal */}
      <ProviderRescheduleModal
        booking={rescheduleBooking}
        provider={provider}
        isOpen={showRescheduleModal}
        onClose={() => { setShowRescheduleModal(false); setRescheduleBooking(null); }}
        onRescheduleComplete={() => {
          setShowRescheduleModal(false);
          setRescheduleBooking(null);
          fetchBookings();
        }}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by customer or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                activeFilter === filter.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-dark-700 text-gray-400 border border-white/5 hover:border-white/10'
              )}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-white">{bookings.length}</p>
          <p className="text-sm text-gray-400">Total Bookings</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-emerald-400">
            {bookings.filter(b => b.status?.toUpperCase() === 'CONFIRMED').length}
          </p>
          <p className="text-sm text-gray-400">Confirmed</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-400">
            {bookings.filter(b => b.status?.toUpperCase() === 'PENDING').length}
          </p>
          <p className="text-sm text-gray-400">Pending Approval</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-cyan-400">
            {formatCurrency(bookings.reduce((sum, b) => 
              b.paymentStatus?.toUpperCase() === 'PAID' ? sum + ((b.appointmentTypeId?.price || b.appointmentType?.price) || 0) : sum, 0
            ))}
          </p>
          <p className="text-sm text-gray-400">Revenue</p>
        </Card>
      </div>

      {/* Bookings list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-48 h-5" />
                  <Skeleton className="w-32 h-4" />
                </div>
                <Skeleton className="w-20 h-8 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={searchQuery ? 'No bookings match your search' : 'No bookings yet'}
          description={searchQuery ? 'Try a different search term' : 'Bookings will appear here once customers start booking'}
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {groupedBookings[date].map(booking => (
                  <BookingRow
                    key={booking._id}
                    booking={booking}
                    onView={() => { setSelectedBooking(booking); setShowDetailsModal(true); }}
                    onConfirm={() => { setActionBooking(booking); setActionType('confirm'); }}
                    onCancel={() => { setActionBooking(booking); setActionType('cancel'); }}
                    onComplete={() => { setActionBooking(booking); setActionType('complete'); }}
                    onReschedule={() => { setRescheduleBooking(booking); setShowRescheduleModal(true); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function BookingRow({ booking, onView, onConfirm, onCancel, onComplete, onReschedule }) {
  // Handle both old and new data structures
  const customer = booking.customerId || booking.user;
  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
  const status = booking.status?.toUpperCase?.() || booking.status;
  const paymentStatus = booking.paymentStatus?.toUpperCase?.() || booking.paymentStatus;
  const startTime = booking.startTime || booking.slot?.startTime;
  const endTime = booking.endTime || booking.slot?.endTime;
  const totalAmount = appointmentType?.price || booking.totalAmount || 0;
  
  // Handle guest bookings
  const isGuest = booking.isGuestBooking;
  const guestInfo = booking.guestInfo;
  const customerName = isGuest ? guestInfo?.name : (customer?.name || 'Unknown');
  const customerInitial = customerName?.[0] || 'U';
  
  const isPending = status === 'PENDING';
  const isConfirmed = status === 'CONFIRMED';
  const isPast = new Date(startTime) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={classNames(
        "p-4 hover:border-white/10 transition-colors",
        isPending && "border-amber-500/30 bg-amber-500/5"
      )}>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={classNames(
            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
            isGuest ? "bg-purple-500/20" : "bg-cyan-500/20"
          )}>
            <span className={classNames(
              "font-semibold text-lg",
              isGuest ? "text-purple-400" : "text-cyan-400"
            )}>
              {customerInitial}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{customerName}</span>
              {isGuest && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                  Guest
                </span>
              )}
              <span className="text-gray-500">•</span>
              <span className="text-sm text-gray-400">{appointmentType?.title || appointmentType?.name}</span>
              {booking.selectedResource?.name && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-sm text-purple-400">📍 {booking.selectedResource.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{formatDate(startTime)} at {formatTime(startTime)}</span>
              <span>{formatCurrency(totalAmount)}</span>
              {isGuest && guestInfo?.email && (
                <span className="text-gray-400">{guestInfo.email}</span>
              )}
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <PaymentBadge status={paymentStatus} bookingStatus={status} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isPending && (
              <>
                <Button
                  variant="ghost"
                  onClick={onConfirm}
                  className="text-emerald-400 hover:bg-emerald-500/10"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Decline
                </Button>
              </>
            )}
            
            {isConfirmed && !isPast && (
              <>
                <Button
                  variant="ghost"
                  onClick={onReschedule}
                  className="text-amber-400 hover:bg-amber-500/10"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  onClick={onComplete}
                  className="text-blue-400 hover:bg-blue-500/10"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              </>
            )}

            <IconButton icon={Eye} onClick={onView} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function BookingDetailsModal({ booking, isOpen, onClose }) {
  if (!booking) return null;

  // Handle both old and new data structures
  const customer = booking.customerId || booking.user;
  const provider = booking.providerId || booking.provider;
  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
  const status = booking.status;
  const paymentStatus = booking.paymentStatus;
  const startTime = booking.startTime || booking.slot?.startTime;
  const endTime = booking.endTime || booking.slot?.endTime;
  const totalAmount = appointmentType?.price || booking.totalAmount || 0;
  const createdAt = booking.createdAt;
  const answers = booking.answers || [];
  
  // Handle guest bookings
  const isGuest = booking.isGuestBooking;
  const guestInfo = booking.guestInfo;
  const customerName = isGuest ? guestInfo?.name : customer?.name;
  const customerEmail = isGuest ? guestInfo?.email : customer?.email;
  const customerPhone = isGuest ? guestInfo?.phone : customer?.phone;

  // Refund information
  const isCancelled = status === 'CANCELLED';
  const refundAmount = booking.refundAmount || 0;
  const refundStatus = booking.refundStatus || (paymentStatus === 'REFUNDED' ? 'PROCESSED' : null);
  const refundedAt = booking.refundedAt;
  const cancellationReason = booking.cancellationReason;
  const cancelledAt = booking.cancelledAt;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Booking Details">
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={status} />
          <PaymentBadge status={paymentStatus} bookingStatus={status} />
          {isGuest && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              👤 Guest Booking
            </span>
          )}
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

        {/* Customer */}
        <div className="p-4 rounded-xl bg-dark-700/50">
          <p className="text-sm text-gray-400 mb-1">
            {isGuest ? 'Guest' : 'Customer'}
          </p>
          <p className="font-medium text-white">{customerName}</p>
          <p className="text-sm text-gray-400">{customerEmail}</p>
          {customerPhone && <p className="text-sm text-gray-400">{customerPhone}</p>}
        </div>

        {/* Service */}
        <div className="p-4 rounded-xl bg-dark-700/50">
          <p className="text-sm text-gray-400 mb-1">Service</p>
          <p className="font-medium text-white">{appointmentType?.title || appointmentType?.name}</p>
          <p className="text-sm text-gray-400">{provider?.name || provider?.businessName}</p>
        </div>

        {/* Resource - Show if booking has a selected resource */}
        {booking.selectedResource?.name && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-gray-400 mb-1">Resource</p>
            <p className="font-medium text-white">{booking.selectedResource.name}</p>
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-dark-700/50">
            <p className="text-sm text-gray-400 mb-1">Date</p>
            <p className="font-medium text-white">{formatDate(startTime)}</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-700/50">
            <p className="text-sm text-gray-400 mb-1">Time</p>
            <p className="font-medium text-white">
              {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          </div>
        </div>

        {/* Answers */}
        {answers.length > 0 && (
          <div className="p-4 rounded-xl bg-dark-700/50">
            <p className="text-sm text-gray-400 mb-3">Customer Responses</p>
            <div className="space-y-2">
              {answers.map((a, i) => (
                <div key={i}>
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
            <p className="text-gray-300">Total Amount</p>
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Created at */}
        <p className="text-sm text-gray-500 text-center">
          Booked on {formatDate(createdAt)}
        </p>
      </div>
    </Modal>
  );
}

function ProviderRescheduleModal({ booking, provider, isOpen, onClose, onRescheduleComplete }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reason, setReason] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);

  const appointmentType = booking?.appointmentTypeId || booking?.appointmentType;
  const customer = booking?.customerId || booking?.user;
  const guestInfo = booking?.guestInfo;
  const isGuest = booking?.isGuestBooking;
  const customerName = isGuest ? guestInfo?.name : customer?.name;

  // Generate calendar days
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }
    
    // Add days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 60);
      
      const isPast = date < tomorrow;
      const isTooFar = date > maxDate;
      const isSelected = selectedDate === date.toISOString().split('T')[0];
      
      days.push({
        date,
        day,
        isCurrentMonth: true,
        isPast,
        isTooFar,
        isDisabled: isPast || isTooFar,
        isSelected,
        isToday: date.toDateString() === today.toDateString()
      });
    }
    
    setCalendarDays(days);
  }, [currentMonth, selectedDate]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate('');
      setSelectedSlot(null);
      setAvailableSlots([]);
      setReason('');
      setCurrentMonth(new Date());
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
      const response = await publicBookingAPI.getSlots(
        provider.bookingSlug,
        selectedDate,
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

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const handleDateSelect = (day) => {
    if (day.isDisabled || !day.date) return;
    // Format date as YYYY-MM-DD without timezone conversion
    const year = day.date.getFullYear();
    const month = String(day.date.getMonth() + 1).padStart(2, '0');
    const dayNum = String(day.date.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${dayNum}`);
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      toast.error('Please select a new time slot');
      return;
    }

    setIsRescheduling(true);
    try {
      await bookingAPI.reschedule(booking._id, selectedSlot.startTime, reason);
      toast.success('Appointment rescheduled successfully! Customer will be notified.');
      onRescheduleComplete();
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error(error.response?.data?.message || 'Failed to reschedule appointment');
    } finally {
      setIsRescheduling(false);
    }
  };

  // Group slots by time of day
  const groupSlotsByTimeOfDay = (slots) => {
    const morning = [];
    const afternoon = [];
    const evening = [];
    
    slots.forEach(slot => {
      const hour = new Date(slot.startTime).getHours();
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });
    
    return { morning, afternoon, evening };
  };

  if (!booking) return null;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const groupedSlots = groupSlotsByTimeOfDay(availableSlots);

  // Check if we can go to previous month
  const today = new Date();
  const canGoPrevious = currentMonth.getMonth() > today.getMonth() || 
                        currentMonth.getFullYear() > today.getFullYear();
  
  // Check if we can go to next month (60 days limit)
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 60);
  const canGoNext = currentMonth.getMonth() < maxDate.getMonth() || 
                    currentMonth.getFullYear() < maxDate.getFullYear();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Booking">
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="p-4 rounded-xl bg-dark-700/50 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className={classNames(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isGuest ? "bg-purple-500/20" : "bg-cyan-500/20"
            )}>
              <span className={classNames(
                "font-semibold",
                isGuest ? "text-purple-400" : "text-cyan-400"
              )}>
                {customerName?.[0] || 'U'}
              </span>
            </div>
            <div>
              <p className="font-medium text-white">{customerName}</p>
              <p className="text-sm text-gray-400">{appointmentType?.title}</p>
            </div>
            {isGuest && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                Guest
              </span>
            )}
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-gray-400 mb-1">Current Time (will be freed up)</p>
            <p className="text-red-400 font-medium line-through">
              {formatDate(booking.startTime)} at {formatTime(booking.startTime)}
            </p>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-dark-700/50 rounded-xl border border-white/10 p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              disabled={!canGoPrevious}
              className={classNames(
                "p-2 rounded-lg transition-all",
                canGoPrevious 
                  ? "hover:bg-dark-600 text-gray-300" 
                  : "opacity-30 cursor-not-allowed text-gray-600"
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-white">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              onClick={() => navigateMonth(1)}
              disabled={!canGoNext}
              className={classNames(
                "p-2 rounded-lg transition-all",
                canGoNext 
                  ? "hover:bg-dark-600 text-gray-300" 
                  : "opacity-30 cursor-not-allowed text-gray-600"
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => (
              <button
                key={idx}
                onClick={() => handleDateSelect(day)}
                disabled={day.isDisabled || !day.date}
                className={classNames(
                  "aspect-square rounded-lg text-sm font-medium transition-all flex items-center justify-center relative",
                  !day.date && "invisible",
                  day.isSelected && "bg-cyan-500 text-white",
                  day.isToday && !day.isSelected && "ring-2 ring-cyan-500/50",
                  day.isDisabled && "opacity-30 cursor-not-allowed text-gray-600",
                  !day.isDisabled && !day.isSelected && "hover:bg-dark-600 text-gray-300"
                )}
              >
                {day.day}
              </button>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className="bg-dark-700/50 rounded-xl border border-white/10 p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Select New Time</h4>
            
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No available slots on this date</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {/* Morning Slots */}
                {groupedSlots.morning.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-medium text-gray-400">Morning</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedSlots.morning.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={classNames(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-cyan-500 text-white'
                              : 'bg-dark-600 text-gray-300 hover:bg-dark-500 border border-white/10'
                          )}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon Slots */}
                {groupedSlots.afternoon.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sunset className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-medium text-gray-400">Afternoon</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedSlots.afternoon.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={classNames(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-cyan-500 text-white'
                              : 'bg-dark-600 text-gray-300 hover:bg-dark-500 border border-white/10'
                          )}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening Slots */}
                {groupedSlots.evening.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-medium text-gray-400">Evening</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedSlots.evening.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={classNames(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-cyan-500 text-white'
                              : 'bg-dark-600 text-gray-300 hover:bg-dark-500 border border-white/10'
                          )}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Time Comparison */}
        {selectedSlot && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-gray-400 mb-1">Current Time</p>
              <p className="text-red-400 font-medium text-sm line-through">
                {formatDate(booking.startTime)}
              </p>
              <p className="text-red-400 font-medium text-sm line-through">
                {formatTime(booking.startTime)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-gray-400 mb-1">New Time</p>
              <p className="text-emerald-400 font-medium text-sm">
                {formatDate(selectedSlot.startTime)}
              </p>
              <p className="text-emerald-400 font-medium text-sm">
                {formatTime(selectedSlot.startTime)}
              </p>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason for rescheduling
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Conflict with another appointment, personal emergency..."
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
          />
        </div>

        <p className="text-xs text-gray-500">
          The customer will receive an email notification about this reschedule.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedSlot || isRescheduling}
            className="flex-1"
          >
            {isRescheduling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Rescheduling...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reschedule
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default BookingManagement;
