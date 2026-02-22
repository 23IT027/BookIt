import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 text-center">
          {/* Cancel Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center"
          >
            <XCircle className="w-10 h-10 text-red-400" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
          <p className="text-gray-400 mb-6">
            Your payment was not completed. Don't worry - your booking is still saved. 
            You can try again or come back later.
          </p>

          <div className="bg-dark-700/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400">
              Your booking will be held for 30 minutes. After that, the slot may become available for others.
            </p>
          </div>

          <div className="space-y-3">
            {bookingId && (
              <Link to={`/my-bookings`} className="block">
                <Button className="w-full">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Payment Again
                </Button>
              </Link>
            )}
            <Link to="/providers" className="block">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Providers
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default PaymentCancel;
