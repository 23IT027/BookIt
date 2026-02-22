import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, User, CreditCard, MoreVertical, Check, X, RefreshCcw } from 'lucide-react';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import { StatusBadge, PaymentBadge } from '../ui/Badge';
import { Card } from '../ui/Card';

export function BookingCard({ 
  booking, 
  onCancel, 
  onReschedule,
  onViewDetails,
  variant = 'default',
  showActions = true 
}) {
  // Handle both old and new data structures
  const _id = booking._id;
  const provider = booking.providerId || booking.provider;
  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
  const startTime = booking.startTime || booking.slot?.startTime;
  const endTime = booking.endTime || booking.slot?.endTime;
  const status = booking.status?.toUpperCase?.() || booking.status;
  const paymentStatus = booking.paymentStatus?.toUpperCase?.() || booking.paymentStatus;
  const totalAmount = appointmentType?.price || booking.totalAmount || 0;
  const createdAt = booking.createdAt;

  const isPast = new Date(startTime) < new Date();
  const canCancel = (status === 'CONFIRMED' || status === 'PENDING') && !isPast && paymentStatus !== 'REFUNDED';
  const canReschedule = status === 'CONFIRMED' && !isPast;

  if (variant === 'compact') {
    return (
      <CompactBookingCard 
        booking={booking}
        onViewDetails={onViewDetails}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="group"
    >
      <Card className="overflow-hidden">
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            {appointmentType?.images?.[0]?.url || appointmentType?.image ? (
              <img 
                src={appointmentType?.images?.[0]?.url || appointmentType.image}
                alt={appointmentType?.title || appointmentType?.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-cyan-400" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">
                {appointmentType?.title || appointmentType?.name || 'Appointment'}
              </h3>
              <p className="text-sm text-gray-400 truncate">
                with {provider?.name || provider?.businessName || 'Provider'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={status} />
                <PaymentBadge status={paymentStatus} bookingStatus={status} />
              </div>
            </div>

            {showActions && (canReschedule || canCancel) && (
              <div className="flex items-center gap-1">
                {canReschedule && onReschedule && (
                  <button
                    onClick={() => onReschedule(_id)}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    title="Reschedule"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                )}
                {canCancel && onCancel && (
                  <button
                    onClick={() => onCancel(_id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Booking details - Clean layout */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-300 mb-3 pl-15">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>{formatDate(startTime)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{formatTime(startTime)} - {formatTime(endTime)}</span>
            </div>

            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* View Details button */}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(_id)}
              className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition-colors"
            >
              View Details
            </button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function CompactBookingCard({ booking, onViewDetails }) {
  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
  const provider = booking.providerId || booking.provider;
  const startTime = booking.startTime || booking.slot?.startTime;
  const status = booking.status?.toUpperCase?.() || booking.status;

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => onViewDetails?.(booking._id)}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
        <Calendar className="w-5 h-5 text-cyan-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate text-sm">
          {appointmentType?.title || appointmentType?.name}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {formatDate(startTime)} • {formatTime(startTime)}
        </p>
      </div>

      <StatusBadge status={status} />
    </motion.div>
  );
}

export function BookingList({ bookings = [], onCancel, onReschedule, onViewDetails, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!bookings.length) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <BookingCard
          key={booking._id}
          booking={booking}
          onCancel={onCancel}
          onReschedule={onReschedule}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}

export function UpcomingBookings({ bookings = [], onViewDetails }) {
  const upcoming = bookings
    .filter(b => {
      const startTime = b.startTime || b.slot?.date;
      const status = b.status?.toUpperCase?.() || b.status;
      return new Date(startTime) >= new Date() && status === 'CONFIRMED';
    })
    .slice(0, 5);

  if (!upcoming.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No upcoming appointments</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {upcoming.map((booking) => (
        <CompactBookingCard
          key={booking._id}
          booking={booking}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
