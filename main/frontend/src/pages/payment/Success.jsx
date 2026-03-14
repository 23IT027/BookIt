import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { paymentAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import confetti from 'canvas-confetti';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Verify payment first
    if (sessionId) {
      verifyPayment();
    } else {
      setIsLoading(false);
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      // Call backend to verify payment with Stripe
      const response = await paymentAPI.verifyPayment(sessionId);
      
      if (response.data.data) {
        setBooking(response.data.data.booking);
        setPayment(response.data.data.payment);
        
        // Trigger confetti on successful verification
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22d3ee', '#10b981', '#3b82f6'],
        });
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to verify payment:', error);
      setError(error.response?.data?.message || 'Failed to verify payment');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="p-8 text-center">
          {isLoading ? (
            <div className="py-12">
              <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
              <p className="text-gray-400 mt-4">Verifying your payment...</p>
            </div>
          ) : error ? (
            <>
              {/* Error state */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6"
              >
                <AlertCircle className="w-10 h-10 text-red-400" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white mb-2">Verification Issue</h1>
              <p className="text-gray-400 mb-4">{error}</p>
              <p className="text-sm text-gray-500 mb-8">
                Don't worry! If you completed the payment, your booking should still be confirmed. 
                Check your email or bookings page.
              </p>
              <Link to="/my-bookings">
                <Button className="w-full">View My Bookings</Button>
              </Link>
            </>
          ) : (
            <>
              {/* Success icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white mb-2"
              >
                Booking Confirmed!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-gray-400 mb-8"
              >
                Your appointment has been successfully booked. You'll receive a confirmation email shortly.
              </motion.p>

              {booking && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 rounded-xl bg-dark-700/50 mb-8 text-left space-y-3"
                >
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Appointment</p>
                    <p className="text-white font-medium">{booking.appointmentTypeId?.title || 'Appointment'}</p>
                  </div>
                  {payment && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Amount Paid</p>
                      <p className="text-emerald-400 font-bold text-lg">₹{payment.amount}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Booking Reference</p>
                    <p className="font-mono text-cyan-400 text-sm">{booking._id}</p>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Link to="/my-bookings">
                  <Button className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    View My Bookings
                  </Button>
                </Link>

                <Link to="/providers">
                  <Button variant="ghost" className="w-full">
                    Book Another Appointment
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default PaymentSuccess;
