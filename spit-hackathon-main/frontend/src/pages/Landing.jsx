import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Shield, Zap, ChevronRight, Star, Users, Building2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../auth/authStore';

const features = [
  {
    icon: Clock,
    title: 'Real-time Availability',
    description: 'See available slots update live. Never double-book again.',
    color: 'cyan',
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'Stripe-powered payments with instant confirmation.',
    color: 'emerald',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Book appointments in seconds, not minutes.',
    color: 'amber',
  },
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Intelligent calendar management for providers.',
    color: 'blue',
  },
];

const stats = [
  { value: '10K+', label: 'Bookings Made' },
  { value: '500+', label: 'Providers' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9★', label: 'Rating' },
];

export function LandingPage() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Get dashboard link based on user role
  const getDashboardLink = () => {
    if (!user) return '/providers';
    switch (user.role?.toUpperCase()) {
      case 'ADMIN':
        return '/admin';
      case 'ORGANISER':
        return '/organiser';
      default:
        return '/providers';
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl" />
        
        {/* Navigation */}
        <nav className="relative z-10 container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-bold text-white">BookIt</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/providers" className="text-gray-400 hover:text-white transition-colors">
                Browse
              </Link>
              <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                About
              </Link>
              <Link to="/pricing" className="text-gray-400 hover:text-white transition-colors">
                Pricing
              </Link>
            </div>

            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link to={getDashboardLink()}>
                  <Button>Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost">Sign in</Button>
                  </Link>
                  <Link to="/signup">
                    <Button>Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 container mx-auto px-4 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8">
              <Star className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300">Trusted by thousands of businesses</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Book Appointments
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
                Effortlessly
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              The modern appointment booking platform with real-time availability, 
              secure payments, and seamless experience for both customers and providers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button className="text-lg px-8 py-4">
                  Start Booking Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/providers">
                <Button variant="secondary" className="text-lg px-8 py-4">
                  Browse Providers
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Powerful features to streamline your booking experience
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="p-6 rounded-2xl bg-dark-800/50 border border-white/5 hover:border-white/10 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${
                  feature.color === 'cyan' ? 'bg-cyan-500/10' :
                  feature.color === 'emerald' ? 'bg-emerald-500/10' :
                  feature.color === 'amber' ? 'bg-amber-500/10' :
                  'bg-blue-500/10'
                }`}>
                  <feature.icon className={`w-6 h-6 ${
                    feature.color === 'cyan' ? 'text-cyan-400' :
                    feature.color === 'emerald' ? 'text-emerald-400' :
                    feature.color === 'amber' ? 'text-amber-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 p-12 md:p-16 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                Join thousands of businesses and customers who trust BookIt for their appointment scheduling needs.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isAuthenticated ? (
                  <Link to={getDashboardLink()}>
                    <Button className="text-lg px-8 py-4">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup">
                      <Button className="text-lg px-8 py-4">
                        <Users className="w-5 h-5 mr-2" />
                        Sign Up as Customer
                      </Button>
                    </Link>
                    <Link to="/signup">
                      <Button variant="secondary" className="text-lg px-8 py-4">
                        <Building2 className="w-5 h-5 mr-2" />
                        Register as Provider
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold">B</span>
              </div>
              <span className="text-lg font-semibold text-white">BookIt</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-gray-400">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <p className="text-sm text-gray-500">
              © 2024 BookIt. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
