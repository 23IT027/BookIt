import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, Building2, Users, Shield } from 'lucide-react';
import { useAuthStore } from '../../auth/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { classNames } from '../../utils/helpers';

const roles = [
  {
    id: 'customer',
    title: 'Customer',
    description: 'Book appointments with providers',
    icon: Users,
    color: 'cyan',
  },
  {
    id: 'provider',
    title: 'Provider',
    description: 'Manage your services & bookings',
    icon: Building2,
    color: 'emerald',
  },
];

export function SignupPage() {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuthStore();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    if (!formData.role) {
      toast.error('Please select a role');
      return false;
    }
    return true;
  };

  // Password validation helper
  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password);
    
    return {
      isValid: minLength && hasUppercase && hasLowercase && hasSymbol,
      minLength,
      hasUppercase,
      hasLowercase,
      hasSymbol,
    };
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordCheck = validatePassword(formData.password);
      if (!passwordCheck.isValid) {
        const missing = [];
        if (!passwordCheck.minLength) missing.push('8+ characters');
        if (!passwordCheck.hasUppercase) missing.push('uppercase letter');
        if (!passwordCheck.hasLowercase) missing.push('lowercase letter');
        if (!passwordCheck.hasSymbol) missing.push('symbol');
        newErrors.password = `Password must contain: ${missing.join(', ')}`;
      }
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    const result = await signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role.toUpperCase(), // Backend expects CUSTOMER, PROVIDER
    });
    
    if (result.success) {
      toast.success('Account created! Please verify your email.');
      // Redirect to OTP verification page
      navigate('/verify-otp', { 
        state: { 
          email: formData.email, 
          fromSignup: true 
        } 
      });
    } else {
      toast.error(result.error || 'Signup failed. Please try again.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

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

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={classNames(
            'w-3 h-3 rounded-full transition-colors',
            step >= 1 ? 'bg-cyan-500' : 'bg-dark-700'
          )} />
          <div className="w-8 h-0.5 bg-dark-700">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: step >= 2 ? '100%' : 0 }}
              className="h-full bg-cyan-500"
            />
          </div>
          <div className={classNames(
            'w-3 h-3 rounded-full transition-colors',
            step >= 2 ? 'bg-cyan-500' : 'bg-dark-700'
          )} />
        </div>

        {/* Form card */}
        <div className="bg-dark-800/80 backdrop-blur-xl rounded-2xl border border-white/5 p-8 shadow-2xl">
          {step === 1 ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Create account</h1>
                <p className="text-gray-400">Choose how you'll use BookIt</p>
              </div>

              <div className="space-y-4">
                {roles.map((role) => (
                  <motion.button
                    key={role.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFormData(prev => ({ ...prev, role: role.id }))}
                    className={classNames(
                      'w-full p-4 rounded-xl border-2 text-left transition-all',
                      formData.role === role.id
                        ? role.color === 'cyan'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-emerald-500 bg-emerald-500/10'
                        : 'border-white/10 bg-dark-700/50 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={classNames(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        role.color === 'cyan' ? 'bg-cyan-500/20' : 'bg-emerald-500/20'
                      )}>
                        <role.icon className={classNames(
                          'w-6 h-6',
                          role.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'
                        )} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{role.title}</p>
                        <p className="text-sm text-gray-400">{role.description}</p>
                      </div>
                      {formData.role === role.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={classNames(
                            'ml-auto w-6 h-6 rounded-full flex items-center justify-center',
                            role.color === 'cyan' ? 'bg-cyan-500' : 'bg-emerald-500'
                          )}
                        >
                          <Shield className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              <Button onClick={handleNext} disabled={!formData.role} className="w-full mt-6">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Your details</h1>
                <p className="text-gray-400">Fill in your information to get started</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  <Input
                    type="text"
                    name="name"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleChange}
                    error={errors.name}
                    className="pl-11"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    className="pl-11"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    className="pl-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password strength indicator */}
                {formData.password && (
                  <div className="space-y-2 -mt-2">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => {
                        const check = validatePassword(formData.password);
                        const strength = [check.minLength, check.hasLowercase, check.hasUppercase, check.hasSymbol].filter(Boolean).length;
                        return (
                          <div
                            key={i}
                            className={classNames(
                              'h-1 flex-1 rounded-full transition-colors',
                              i < strength
                                ? strength <= 1 ? 'bg-red-500' : strength <= 2 ? 'bg-amber-500' : strength <= 3 ? 'bg-yellow-500' : 'bg-emerald-500'
                                : 'bg-dark-600'
                            )}
                          />
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className={validatePassword(formData.password).minLength ? 'text-emerald-400' : 'text-gray-500'}>
                        ✓ 8+ characters
                      </span>
                      <span className={validatePassword(formData.password).hasUppercase ? 'text-emerald-400' : 'text-gray-500'}>
                        ✓ Uppercase letter
                      </span>
                      <span className={validatePassword(formData.password).hasLowercase ? 'text-emerald-400' : 'text-gray-500'}>
                        ✓ Lowercase letter
                      </span>
                      <span className={validatePassword(formData.password).hasSymbol ? 'text-emerald-400' : 'text-gray-500'}>
                        ✓ Symbol (!@#$...)
                      </span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    className="pl-11"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default SignupPage;
