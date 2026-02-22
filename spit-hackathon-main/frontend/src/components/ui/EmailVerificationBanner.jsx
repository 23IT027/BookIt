import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/authStore';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export function EmailVerificationBanner() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if user is verified or banner is dismissed
  if (!user || user.isEmailVerified || isDismissed) {
    return null;
  }

  const handleSendOTP = async () => {
    setIsLoading(true);
    try {
      await authAPI.sendOTP(user.email);
      toast.success('Verification code sent to your email');
      navigate('/verify-otp', { 
        state: { 
          email: user.email, 
          fromSignup: false 
        } 
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send verification code';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Mail className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">
                  Verify your email address
                </p>
                <p className="text-amber-200/70 text-xs">
                  Please verify your email to access all features
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSendOTP}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Verify Now
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default EmailVerificationBanner;
