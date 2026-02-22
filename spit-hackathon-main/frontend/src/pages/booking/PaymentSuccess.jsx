import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { paymentAPI, bookingAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatDate, formatTime, formatCurrency } from '../../utils/helpers';
import confetti from 'canvas-confetti';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // Celebration confetti
    if (booking) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [booking]);

  const verifyPayment = async () => {
    try {
      // The webhook should have already processed the payment
      // Just fetch the booking to show confirmation
      const response = await bookingAPI.getCustomerBookings();
      const bookings = response.data?.data?.bookings || response.data?.bookings || [];
      
      // Get the most recent confirmed booking
      const recentBooking = bookings.find(b => b.paymentStatus === 'PAID') || bookings[0];
      setBooking(recentBooking);
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setError('Failed to verify payment status');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
          >
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-400 mb-6">
            Your booking has been confirmed. We've sent a confirmation email with all the details.
          </p>

          {booking && (
            <div className="bg-dark-700/50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-medium text-white mb-3">Booking Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Service</span>
                  <span className="text-white">{booking.appointmentTypeId?.title || booking.appointmentType?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span className="text-white">{formatDate(booking.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time</span>
                  <span className="text-white">{formatTime(booking.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount Paid</span>
                  <span className="text-emerald-400 font-medium">
                    {formatCurrency(booking.appointmentTypeId?.price || booking.appointmentType?.price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Link to="/my-bookings" className="block">
              <Button className="w-full">
                <Calendar className="w-4 h-4 mr-2" />
                View My Bookings
              </Button>
            </Link>
            <Link to="/" className="block">
              <Button variant="ghost" className="w-full">
                Back to Home
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default PaymentSuccess;
