import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { authAPI } from '../../api';
import { useAuthStore } from '../../auth/authStore';
import toast from 'react-hot-toast';

export function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setToken } = useAuthStore();
  
  const email = location.state?.email || '';
  const fromSignup = location.state?.fromSignup || false;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  // Send OTP on mount if coming from signup
  useEffect(() => {
    if (fromSignup && email) {
      handleSendOTP();
    }
  }, []);

  const handleSendOTP = async () => {
    if (!email) {
      toast.error('No email provided');
      navigate('/signup');
      return;
    }

    setIsResending(true);
    try {
      await authAPI.sendOTP(email);
      toast.success('Verification code sent to your email');
      setCountdown(30);
      setCanResend(false);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send OTP';
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 5 && newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (otpCode) => {
    if (!email) {
      toast.error('No email provided');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyOTP(email, otpCode);
      const { user, token } = response.data.data;
      
      // Update auth store
      setUser(user);
      setToken(token);
      
      setIsVerified(true);
      toast.success('Email verified successfully!');
      
      // Redirect after animation
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid verification code';
      toast.error(message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }
    handleVerify(otpCode);
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
        <div className="text-center">
          <p className="text-dark-400 mb-4">No email provided for verification</p>
          <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">
            Go to Signup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <span className="text-2xl font-bold text-white">BookIt</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-dark-800/50 backdrop-blur-xl rounded-2xl border border-dark-700 p-8">
          {isVerified ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
              <p className="text-dark-400">Redirecting to dashboard...</p>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
                <p className="text-dark-400 text-sm">
                  We've sent a 6-digit code to<br />
                  <span className="text-cyan-400 font-medium">{email}</span>
                </p>
              </div>

              {/* OTP Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      disabled={isLoading}
                      className="w-12 h-14 text-center text-2xl font-bold text-white bg-dark-700 border border-dark-600 rounded-xl 
                               focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || otp.some(d => !d)}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Email'
                  )}
                </Button>
              </form>

              {/* Resend */}
              <div className="mt-6 text-center">
                <p className="text-dark-400 text-sm mb-2">Didn't receive the code?</p>
                {canResend ? (
                  <button
                    onClick={handleSendOTP}
                    disabled={isResending}
                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium transition-colors disabled:opacity-50"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Resend Code
                      </>
                    )}
                  </button>
                ) : (
                  <p className="text-dark-500 text-sm">
                    Resend in <span className="text-cyan-400 font-medium">{countdown}s</span>
                  </p>
                )}
              </div>

              {/* Back link */}
              <div className="mt-6 pt-6 border-t border-dark-700 text-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Signup
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default VerifyOTPPage;
