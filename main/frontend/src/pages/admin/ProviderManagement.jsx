import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Building2, MapPin, Mail, Phone, MoreVertical,
  Ban, CheckCircle, Eye, Trash2
} from 'lucide-react';
import { adminAPI, providerAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

export function AdminProviderManagement() {
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      // Include inactive providers for admin view
      const response = await providerAPI.getAll({ includeInactive: true });
      const providersData = response.data.data?.providers || response.data.providers || response.data || [];
      setProviders(providersData);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (provider) => {
    try {
      // Get the user ID - could be an object or a string
      const userId = provider.userId?._id || provider.userId;
      
      if (!userId) {
        toast.error('Unable to find provider user account');
        return;
      }
      
      // Get current status - default to true if not set
      const currentStatus = provider.userId?.isActive !== false;
      
      await adminAPI.updateUserStatus(userId, !currentStatus);
      toast.success(`Provider ${currentStatus ? 'deactivated' : 'activated'}`);
      fetchProviders();
    } catch (error) {
      console.error('Failed to toggle provider status:', error);
      toast.error(error.response?.data?.message || 'Failed to update provider status');
    }
  };

  const handleViewDetails = (provider) => {
    setSelectedProvider(provider);
    setShowDetailsModal(true);
  };

  const filteredProviders = providers.filter(provider => {
    const matchesSearch = 
      provider.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: providers.length,
    active: providers.filter(p => p.userId?.isActive !== false).length,
    inactive: providers.filter(p => p.userId?.isActive === false).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Provider Management"
        subtitle="Manage all service providers on the platform"
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-sm text-gray-400">Total Providers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
              <p className="text-sm text-gray-400">Active Providers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Ban className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.inactive}</p>
              <p className="text-sm text-gray-400">Inactive Providers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Providers list */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-4 mb-2" />
                  <Skeleton className="w-48 h-3" />
                </div>
                <Skeleton className="w-20 h-6" />
              </div>
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No providers found"
            description={searchQuery ? "Try adjusting your search" : "No providers registered yet"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Provider</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Specialization</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Contact</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Created</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredProviders.map((provider) => (
                  <motion.tr
                    key={provider._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-dark-700/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{provider.name}</p>
                          <p className="text-sm text-gray-400">{provider.userId?.name || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">{provider.specialization || 'General'}</span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Mail className="w-3 h-3" />
                          {provider.contactEmail || provider.userId?.email || 'N/A'}
                        </div>
                        {provider.contactPhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Phone className="w-3 h-3" />
                            {provider.contactPhone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={provider.userId?.isActive !== false ? 'emerald' : 'red'}>
                        {provider.userId?.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-400">
                        {formatDate(provider.createdAt)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          icon={Eye}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(provider)}
                          title="View details"
                        />
                        <IconButton
                          icon={provider.userId?.isActive !== false ? Ban : CheckCircle}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(provider)}
                          title={provider.userId?.isActive !== false ? 'Deactivate' : 'Activate'}
                          className={provider.userId?.isActive !== false ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Provider Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedProvider(null);
        }}
        title="Provider Details"
        size="lg"
      >
        {selectedProvider && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedProvider.name}</h3>
                <p className="text-gray-400">{selectedProvider.specialization || 'General'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Owner</p>
                <p className="text-white">{selectedProvider.userId?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-white">{selectedProvider.contactEmail || selectedProvider.userId?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Phone</p>
                <p className="text-white">{selectedProvider.contactPhone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Timezone</p>
                <p className="text-white">{selectedProvider.timezone || 'N/A'}</p>
              </div>
            </div>

            {selectedProvider.address && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Address</p>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <p className="text-white">
                    {selectedProvider.address.street}, {selectedProvider.address.city}, {selectedProvider.address.state} {selectedProvider.address.zipCode}
                  </p>
                </div>
              </div>
            )}

            {selectedProvider.description && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Description</p>
                <p className="text-gray-300">{selectedProvider.description}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-dark-600">
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              <Button
                variant={selectedProvider.userId?.isActive !== false ? 'danger' : 'primary'}
                onClick={() => {
                  handleToggleStatus(selectedProvider);
                  setShowDetailsModal(false);
                }}
              >
                {selectedProvider.userId?.isActive !== false ? 'Deactivate Provider' : 'Activate Provider'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminProviderManagement;
