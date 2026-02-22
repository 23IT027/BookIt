import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Star, Clock, Calendar, CreditCard, ChevronLeft, 
  Image as ImageIcon, Check, AlertCircle, Phone, Mail, Globe
} from 'lucide-react';
import { providerAPI, appointmentTypeAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { BookingFlow } from '../../components/booking/BookingFlow';
import { formatCurrency, classNames } from '../../utils/helpers';
import { useAuthStore } from '../../auth/authStore';

export function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [provider, setProvider] = useState(null);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingFlow, setShowBookingFlow] = useState(false);

  useEffect(() => {
    fetchProviderData();
  }, [id]);

  const fetchProviderData = async () => {
    setIsLoading(true);
    try {
      const [providerRes, typesRes] = await Promise.all([
        providerAPI.getById(id),
        appointmentTypeAPI.getByProvider(id),
      ]);
      // Handle nested response structure: { data: { provider: {...} } }
      const providerData = providerRes.data?.data?.provider || providerRes.data?.provider || providerRes.data;
      setProvider(providerData);
      
      // Handle nested response structure: { data: { appointmentTypes: [...] } }
      const typesData = typesRes.data?.data?.appointmentTypes || typesRes.data?.appointmentTypes || typesRes.data;
      setAppointmentTypes(Array.isArray(typesData) ? typesData : []);
    } catch (error) {
      console.error('Failed to fetch provider:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (appointmentType) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/providers/${id}` } });
      return;
    }
    setSelectedAppointmentType(appointmentType);
    setShowBookingFlow(true);
  };

  const handleBookingCancel = () => {
    setShowBookingFlow(false);
    setSelectedAppointmentType(null);
  };

  if (isLoading) {
    return <ProviderDetailSkeleton />;
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Provider not found</h2>
          <p className="text-gray-400 mb-6">The provider you're looking for doesn't exist.</p>
          <Link to="/providers">
            <Button>Browse Providers</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 pb-12">
      {/* Back button */}
      <div className="container mx-auto px-4 py-4">
        <Link 
          to="/providers"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to providers
        </Link>
      </div>

      {/* Booking Flow Modal */}
      <AnimatePresence>
        {showBookingFlow && selectedAppointmentType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-dark-800 rounded-2xl border border-white/10 p-6"
            >
              <BookingFlow 
                provider={provider}
                appointmentType={selectedAppointmentType}
                onCancel={handleBookingCancel}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero section */}
      <div className="relative">
        {/* Cover image */}
        <div className="h-64 bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          {provider.coverImage && (
            <img 
              src={provider.coverImage} 
              alt={provider.name || provider.businessName}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Provider info */}
        <div className="container mx-auto px-4">
          <div className="relative -mt-20">
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Profile image */}
                <div className="w-32 h-32 rounded-2xl bg-dark-700 overflow-hidden flex-shrink-0 border-4 border-dark-800">
                  {provider.image ? (
                    <img 
                      src={provider.image} 
                      alt={provider.name || provider.businessName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <span className="text-4xl font-bold text-cyan-400">
                        {(provider.name || provider.businessName)?.[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-white">
                        {provider.name || provider.businessName}
                      </h1>
                      <p className="text-gray-400 mt-1">{provider.description}</p>
                    </div>

                    {provider.rating && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 flex-shrink-0">
                        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                        <span className="font-semibold text-amber-400">{provider.rating}</span>
                        <span className="text-gray-400">({provider.reviewCount || 0} reviews)</span>
                      </div>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-wrap gap-4 mt-4">
                    {provider.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        {typeof provider.address === 'string' 
                          ? provider.address 
                          : [provider.address.street, provider.address.city, provider.address.state, provider.address.zipCode, provider.address.country]
                              .filter(Boolean)
                              .join(', ')}
                      </div>
                    )}
                    {(provider.phone || provider.contactPhone) && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Phone className="w-4 h-4 text-cyan-400" />
                        {provider.phone || provider.contactPhone}
                      </div>
                    )}
                    {(provider.email || provider.contactEmail) && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Mail className="w-4 h-4 text-cyan-400" />
                        {provider.email || provider.contactEmail}
                      </div>
                    )}
                    {provider.website && (
                      <a 
                        href={provider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        <Globe className="w-4 h-4" />
                        Visit website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Services section */}
      <div className="container mx-auto px-4 mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Available Services</h2>

        {appointmentTypes.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No services available at this time</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appointmentTypes.map((type) => (
              <ServiceCard 
                key={type._id} 
                service={type}
                onSelect={() => handleSelectService(type)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service, onSelect }) {
  // API returns: title, durationMinutes, price, images (array of objects with url)
  const { title, name, description, durationMinutes, duration, price, images, image } = service;
  const displayName = title || name;
  const displayDuration = durationMinutes || duration;
  // Handle both image URL string and image object with url property
  const displayImage = images?.[0]?.url || images?.[0] || image?.url || image;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="overflow-hidden h-full flex flex-col">
        {/* Image */}
        <div className="aspect-video bg-dark-700 overflow-hidden">
          {displayImage ? (
            <img 
              src={displayImage}
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-gray-600" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="font-semibold text-white text-lg">{displayName}</h3>
          <p className="text-gray-400 text-sm mt-2 flex-1">{description}</p>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              {displayDuration} min
            </div>
            <div className="flex items-center gap-1.5 text-sm text-cyan-400 font-medium">
              <CreditCard className="w-4 h-4" />
              {formatCurrency(price)}
            </div>
          </div>

          <Button onClick={onSelect} className="w-full mt-4">
            Book Now
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function ProviderDetailSkeleton() {
  return (
    <div className="min-h-screen bg-dark-900 pb-12">
      <div className="container mx-auto px-4 py-4">
        <Skeleton className="w-32 h-6" />
      </div>

      <div className="h-64 bg-dark-800" />

      <div className="container mx-auto px-4">
        <div className="relative -mt-20">
          <Card className="p-6">
            <div className="flex gap-6">
              <Skeleton className="w-32 h-32 rounded-2xl" />
              <div className="flex-1 space-y-4">
                <Skeleton className="w-64 h-8" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-3/4 h-4" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8">
        <Skeleton className="w-48 h-6 mb-6" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-5 space-y-4">
                <Skeleton className="w-3/4 h-5" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-1/2 h-4" />
                <Skeleton className="w-full h-10 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProviderDetail;
