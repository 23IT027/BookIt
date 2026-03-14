import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, MoreVertical, MapPin, 
  Phone, Mail, Globe, Calendar, Users, Eye, Image as ImageIcon
} from 'lucide-react';
import { providerAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Input, TextArea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export function ProviderManagement() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [deletingProvider, setDeletingProvider] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const response = await providerAPI.getByUser();
      // getByUser returns a single provider, wrap in array for consistency
      const providerData = response.data?.data?.provider || response.data?.provider || response.data;
      setProviders(providerData ? [providerData] : []);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      // If 404, user has no provider yet - that's okay
      if (error.response?.status !== 404) {
        toast.error('Failed to load providers');
      }
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data) => {
    setIsSubmitting(true);
    try {
      await providerAPI.create(data);
      toast.success('Provider created successfully');
      fetchProviders();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create provider:', error);
      toast.error(error.response?.data?.message || 'Failed to create provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data) => {
    if (!editingProvider) return;
    setIsSubmitting(true);
    try {
      await providerAPI.update(editingProvider._id, data);
      toast.success('Provider updated successfully');
      fetchProviders();
      setEditingProvider(null);
    } catch (error) {
      console.error('Failed to update provider:', error);
      toast.error(error.response?.data?.message || 'Failed to update provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProvider) return;
    setIsSubmitting(true);
    try {
      await providerAPI.delete(deletingProvider._id);
      toast.success('Provider deleted successfully');
      fetchProviders();
      setDeletingProvider(null);
    } catch (error) {
      console.error('Failed to delete provider:', error);
      toast.error(error.response?.data?.message || 'Failed to delete provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProviders = providers.filter(provider => {
    const providerName = provider.name || provider.businessName || '';
    return providerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Organiser can only have one provider
  const hasProvider = providers.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Provider"
        subtitle="Manage your business listing"
        action={!hasProvider ? (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        ) : null}
      />

      {/* Create Modal */}
      <ProviderFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        isLoading={isSubmitting}
      />

      {/* Edit Modal */}
      <ProviderFormModal
        isOpen={!!editingProvider}
        onClose={() => setEditingProvider(null)}
        onSubmit={handleUpdate}
        provider={editingProvider}
        isLoading={isSubmitting}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deletingProvider}
        onClose={() => setDeletingProvider(null)}
        onConfirm={handleDelete}
        title="Delete Provider"
        message={`Are you sure you want to delete "${deletingProvider?.name || deletingProvider?.businessName}"? This action cannot be undone and all associated data will be lost.`}
        confirmText="Delete Provider"
        isLoading={isSubmitting}
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
      </div>

      {/* Providers grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-5 space-y-3">
                <Skeleton className="w-3/4 h-5" />
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredProviders.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No providers match your search' : 'No providers yet'}
          description={searchQuery ? 'Try a different search term' : 'Create your first provider to start accepting bookings'}
          action={!searchQuery ? {
            label: 'Add Provider',
            onClick: () => setShowCreateModal(true),
          } : undefined}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider._id}
              provider={provider}
              onEdit={() => setEditingProvider(provider)}
              onDelete={() => setDeletingProvider(provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider, onEdit, onDelete }) {
  const { _id, name, businessName, description, image, address, appointmentTypes, specialization } = provider;
  const displayName = name || businessName;
  const displayAddress = typeof address === 'object' 
    ? [address.street, address.city, address.state].filter(Boolean).join(', ')
    : address;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="overflow-hidden h-full flex flex-col">
        {/* Image */}
        <div className="aspect-video bg-dark-700 overflow-hidden relative">
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

          {/* Actions menu */}
          <div className="absolute top-3 right-3">
            <div className="relative">
              <IconButton
                icon={MoreVertical}
                onClick={() => setShowMenu(!showMenu)}
                className="bg-dark-800/80 backdrop-blur-sm"
              />

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-10"
                    onMouseLeave={() => setShowMenu(false)}
                  >
                    <Link
                      to={`/providers/${_id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Public Page
                    </Link>
                    <button
                      onClick={() => { onEdit(); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Provider
                    </button>
                    <button
                      onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="font-semibold text-white text-lg">{displayName}</h3>
          
          {specialization && (
            <p className="text-sm text-cyan-400 mt-0.5">{specialization}</p>
          )}
          
          {displayAddress && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {displayAddress}
            </p>
          )}
          
          <p className="text-gray-400 text-sm mt-3 line-clamp-2 flex-1">{description}</p>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Calendar className="w-4 h-4" />
              {appointmentTypes?.length || 0} services
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ProviderFormModal({ isOpen, onClose, onSubmit, provider, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    specialization: '',
    timezone: 'UTC',
    contactEmail: '',
    contactPhone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
  });

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name || provider.businessName || '',
        description: provider.description || '',
        specialization: provider.specialization || '',
        timezone: provider.timezone || 'UTC',
        contactEmail: provider.contactEmail || provider.email || '',
        contactPhone: provider.contactPhone || provider.phone || '',
        address: typeof provider.address === 'object' ? provider.address : {
          street: provider.address || '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
      });
    } else {
      setFormData({
        name: '',
        description: '',
        specialization: '',
        timezone: 'UTC',
        contactEmail: '',
        contactPhone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
      });
    }
  }, [provider, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={provider ? 'Edit Provider' : 'Create Provider'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Business Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />

        <TextArea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
        />

        <Input
          label="Specialization"
          value={formData.specialization}
          onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
          placeholder="e.g., General Medicine, Dentistry"
        />

        <Input
          label="Street Address"
          value={formData.address.street}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            address: { ...prev.address, street: e.target.value } 
          }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            value={formData.address.city}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, city: e.target.value } 
            }))}
          />
          <Input
            label="State"
            value={formData.address.state}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, state: e.target.value } 
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Zip Code"
            value={formData.address.zipCode}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, zipCode: e.target.value } 
            }))}
          />
          <Input
            label="Country"
            value={formData.address.country}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, country: e.target.value } 
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : provider ? 'Update Provider' : 'Create Provider'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ProviderManagement;
