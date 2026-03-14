import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Clock, Filter, ChevronRight, Grid, List } from 'lucide-react';
import { providerAPI } from '../../api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { classNames } from '../../utils/helpers';

export function ProviderList() {
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    category: '',
    sortBy: 'rating',
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const response = await providerAPI.getAll();
      // Handle different response structures
      const data = response.data;
      let providersList = [];
      
      if (Array.isArray(data)) {
        providersList = data;
      } else if (data?.data?.providers) {
        providersList = data.data.providers;
      } else if (data?.providers) {
        providersList = data.providers;
      } else if (data?.data && Array.isArray(data.data)) {
        providersList = data.data;
      }
      
      setProviders(providersList);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProviders = Array.isArray(providers) ? providers.filter(provider => 
    provider.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="min-h-screen bg-dark-900 pb-12">
      {/* Header */}
      <div className="bg-dark-800/50 border-b border-white/5">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">Find a Provider</h1>
            <p className="text-gray-400">Discover and book appointments with top-rated providers</p>
          </motion.div>

          {/* Search and filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 flex flex-col sm:flex-row gap-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3">

              <div className="flex items-center bg-dark-700 rounded-xl border border-white/10 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={classNames(
                    'p-2 rounded-lg transition-colors',
                    viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={classNames(
                    'p-2 rounded-lg transition-colors',
                    viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Providers grid */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className={classNames(
            'grid gap-6',
            viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
          )}>
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No providers found"
            description="Try adjusting your search or filters"
            action={{
              label: 'Clear search',
              onClick: () => setSearchQuery(''),
            }}
          />
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
            className={classNames(
              'grid gap-6',
              viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
            )}
          >
            {filteredProviders.map((provider) => (
              <ProviderCard key={provider._id} provider={provider} viewMode={viewMode} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider, viewMode }) {
  const { _id, name, businessName, description, image, address, rating, reviewCount, appointmentTypes } = provider;
  const displayName = businessName || name || 'Unnamed Provider';

  if (viewMode === 'list') {
    return (
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 },
        }}
      >
        <Link to={`/providers/${_id}`}>
          <Card className="flex items-center gap-6 p-4 hover:border-cyan-500/50 transition-colors">
            <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-dark-700">
              {image ? (
                <img src={image} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-cyan-400">{displayName?.[0]}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-lg truncate">{displayName}</h3>
              <p className="text-gray-400 text-sm mt-1 line-clamp-2">{description}</p>
              
              <div className="flex items-center gap-4 mt-3">
                {address && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">
                      {typeof address === 'object' 
                        ? `${address.city || ''}${address.city && address.state ? ', ' : ''}${address.state || ''}` 
                        : address}
                    </span>
                  </div>
                )}
                {rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium text-white">{rating}</span>
                    <span className="text-sm text-gray-500">({reviewCount || 0})</span>
                  </div>
                )}
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-500" />
          </Card>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      <Link to={`/providers/${_id}`}>
        <Card className="overflow-hidden group hover:border-cyan-500/50 transition-colors">
          {/* Image */}
          <div className="aspect-video bg-dark-700 overflow-hidden">
            {image ? (
              <img 
                src={image} 
                alt={displayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <span className="text-4xl font-bold text-cyan-400">{displayName?.[0]}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-lg truncate group-hover:text-cyan-400 transition-colors">
                  {displayName}
                </h3>
                {address && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5" />
                    {typeof address === 'object' 
                      ? `${address.city || ''}${address.city && address.state ? ', ' : ''}${address.state || ''}` 
                      : address}
                  </p>
                )}
              </div>

              {rating && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 flex-shrink-0">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-medium text-amber-400">{rating}</span>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-3 line-clamp-2">{description}</p>

            {appointmentTypes?.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">
                  {appointmentTypes.length} service{appointmentTypes.length > 1 ? 's' : ''} available
                </span>
              </div>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default ProviderList;
