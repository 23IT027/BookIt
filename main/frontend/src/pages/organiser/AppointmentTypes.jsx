import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, MoreVertical, Clock, 
  CreditCard, Image as ImageIcon, Upload, X, Loader2, Copy, Calendar, Building2, Check, Eye, EyeOff
} from 'lucide-react';
import { appointmentTypeAPI, providerAPI, availabilityAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

export function AppointmentTypeManagement() {
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // First get the organiser's provider
      let provider = null;
      try {
        const providerRes = await providerAPI.getByUser();
        provider = providerRes.data?.data?.provider || providerRes.data?.provider || providerRes.data;
      } catch (e) {
        // No provider yet
        console.log('No provider found for user');
      }
      
      if (provider) {
        setProviders([provider]);
        // Then get appointment types for that provider
        const typesRes = await appointmentTypeAPI.getByProvider(provider._id);
        const typesData = typesRes.data?.data?.appointmentTypes || typesRes.data?.appointmentTypes || typesRes.data || [];
        setAppointmentTypes(Array.isArray(typesData) ? typesData : []);
      } else {
        setProviders([]);
        setAppointmentTypes([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load appointment types');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data, hasImages = false) => {
    setIsSubmitting(true);
    try {
      if (hasImages) {
        await appointmentTypeAPI.createWithImages(data);
      } else {
        await appointmentTypeAPI.create(data);
      }
      toast.success('Service created successfully');
      fetchData();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create:', error);
      toast.error(error.response?.data?.message || 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data, hasImages = false) => {
    if (!editingType) return;
    setIsSubmitting(true);
    try {
      if (hasImages && data instanceof FormData) {
        // First upload images
        const imageFormData = new FormData();
        const imageFile = data.get('images');
        if (imageFile) {
          imageFormData.append('images', imageFile);
          await appointmentTypeAPI.uploadImages(editingType._id, imageFormData);
        }
        
        // Then update other fields (extract from FormData)
        const updateData = {
          title: data.get('title'),
          description: data.get('description'),
          durationMinutes: Number(data.get('durationMinutes')) || 30,
          price: Number(data.get('price')) || 0,
          providerId: data.get('providerId'),
          maxSlotsPerDay: data.get('maxSlotsPerDay') ? Number(data.get('maxSlotsPerDay')) : null,
          useCustomAvailability: data.get('useCustomAvailability') === 'true',
          availability: data.get('availability') ? JSON.parse(data.get('availability')) : [],
        };
        await appointmentTypeAPI.update(editingType._id, updateData);
        toast.success('Service updated successfully');
      } else {
        await appointmentTypeAPI.update(editingType._id, data);
        toast.success('Service updated successfully');
      }
      fetchData();
      setEditingType(null);
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error(error.response?.data?.message || 'Failed to update service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setIsSubmitting(true);
    try {
      await appointmentTypeAPI.delete(deletingType._id);
      toast.success('Service deleted successfully');
      fetchData();
      setDeletingType(null);
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(error.response?.data?.message || 'Failed to delete service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (service) => {
    try {
      const newPublishedState = service.published === false ? true : false;
      await appointmentTypeAPI.update(service._id, { published: newPublishedState });
      toast.success(`Service ${newPublishedState ? 'published' : 'unpublished'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Failed to toggle publish:', error);
      toast.error(error.response?.data?.message || 'Failed to update service');
    }
  };

  const filteredTypes = appointmentTypes.filter(type => {
    const typeName = type.title || type.name || '';
    return typeName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Services"
        subtitle="Manage your appointment types and pricing"
        action={
          <Button onClick={() => setShowCreateModal(true)} disabled={providers.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        }
      />

      {/* Modals */}
      <AppointmentTypeFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        providers={providers}
        isLoading={isSubmitting}
      />

      <AppointmentTypeFormModal
        isOpen={!!editingType}
        onClose={() => setEditingType(null)}
        onSubmit={handleUpdate}
        appointmentType={editingType}
        providers={providers}
        isLoading={isSubmitting}
      />

      <ConfirmModal
        isOpen={!!deletingType}
        onClose={() => setDeletingType(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        message={`Are you sure you want to delete "${deletingType?.title || deletingType?.name}"? This action cannot be undone.`}
        confirmText="Delete Service"
        isLoading={isSubmitting}
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
      </div>

      {/* Show empty state if no providers */}
      {!isLoading && providers.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No Provider Profile"
          description="Create a provider profile first before adding services."
          action={{
            label: 'Create Provider',
            onClick: () => {},
            as: Link,
            to: '/organiser/providers',
            icon: Plus,
          }}
        />
      )}

      {/* Services grid */}
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
      ) : filteredTypes.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={searchQuery ? 'No services match your search' : 'No services yet'}
          description={searchQuery ? 'Try a different search term' : 'Create your first service to start accepting bookings'}
          action={!searchQuery && providers.length > 0 ? {
            label: 'Add Service',
            onClick: () => setShowCreateModal(true),
          } : undefined}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTypes.map((type) => (
            <ServiceCard
              key={type._id}
              service={type}
              onEdit={() => setEditingType(type)}
              onDelete={() => setDeletingType(type)}
              onTogglePublish={() => handleTogglePublish(type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service, onEdit, onDelete, onTogglePublish }) {
  const { title, name, description, durationMinutes, duration, price, images, image, providerId, useCustomAvailability, isPrivate, privateAccessToken, published } = service;
  const displayName = title || name;
  const displayDuration = durationMinutes || duration;
  // Handle both image URL string and image object with url property
  const displayImage = images?.[0]?.url || images?.[0] || image?.url || image;
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPublished = published !== false; // default to true if undefined

  const privateLink = isPrivate && privateAccessToken 
    ? `${window.location.origin}/private-booking/${privateAccessToken}` 
    : null;

  const copyPrivateLink = (e) => {
    e.stopPropagation();
    if (privateLink) {
      navigator.clipboard.writeText(privateLink);
      setCopied(true);
      toast.success('Private link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="h-full flex flex-col relative !p-0 overflow-visible">
        {/* Actions - moved outside overflow-hidden container */}
        <div className="absolute top-3 right-3 z-50">
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
                  className="absolute right-0 top-full mt-2 w-40 bg-dark-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {privateLink && (
                    <button
                      onClick={(e) => { copyPrivateLink(e); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-cyan-300 hover:text-cyan-200 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                  )}
                  <button
                    onClick={() => { onTogglePublish(); setShowMenu(false); }}
                    className={classNames(
                      "w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors",
                      isPublished ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                    )}
                  >
                    {isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => { onEdit(); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
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

        <div className="aspect-video bg-dark-700 overflow-hidden relative">
          {/* Private Service Badge */}
          {isPrivate && (
            <div className="absolute top-3 left-3 z-10">
              <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                Private
              </span>
            </div>
          )}
          {/* Custom Availability Badge */}
          {useCustomAvailability && !isPrivate && (
            <div className="absolute top-3 left-3 z-10">
              <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                <Calendar className="w-3 h-3" />
                Custom Hours
              </span>
            </div>
          )}
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

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <span 
              className={classNames(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                isPublished ? "bg-emerald-500" : "bg-red-500"
              )}
              title={isPublished ? "Published" : "Unpublished"}
            />
            <h3 className="font-semibold text-white text-lg">{displayName}</h3>
          </div>
          
          {providerId && (
            <p className="text-sm text-gray-500 mt-1">
              {providerId.name || providerId.businessName || ''}
            </p>
          )}
          
          <p className="text-gray-400 text-sm mt-3 line-clamp-2 flex-1">{description}</p>

          {/* Private Link Copy Button */}
          {privateLink && (
            <button
              onClick={copyPrivateLink}
              className="flex items-center gap-2 mt-3 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Private Link'}
            </button>
          )}

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              {displayDuration} min
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-cyan-400">
              <CreditCard className="w-4 h-4" />
              {formatCurrency(price)}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:${minute}`);
  }
}

function AppointmentTypeFormModal({ isOpen, onClose, onSubmit, appointmentType, providers, isLoading }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [providerAvailability, setProviderAvailability] = useState([]);
  const [isLoadingProviderAvailability, setIsLoadingProviderAvailability] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    capacity: 1,
    pricingMode: 'FLAT',
    tagsInput: '',
    durationMinutes: 30,
    price: 0,
    providerId: '',
    maxSlotsPerDay: '',
    useCustomAvailability: false,
    availability: [],
    requiresApproval: false,
    isPrivate: false,
    hasResources: false,
    resources: [],
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (appointmentType) {
      setFormData({
        title: appointmentType.title || appointmentType.name || '',
        description: appointmentType.description || '',
        category: appointmentType.category || '',
        capacity: appointmentType.capacity || 1,
        pricingMode: appointmentType.pricingMode || 'FLAT',
        tagsInput: Array.isArray(appointmentType.tags) ? appointmentType.tags.join(', ') : '',
        durationMinutes: appointmentType.durationMinutes || appointmentType.duration || 30,
        price: appointmentType.price || 0,
        providerId: appointmentType.providerId?._id || appointmentType.providerId || appointmentType.provider?._id || '',
        maxSlotsPerDay: appointmentType.maxSlotsPerDay || '',
        useCustomAvailability: appointmentType.useCustomAvailability || false,
        availability: appointmentType.availability || [],
        requiresApproval: appointmentType.requiresApproval || false,
        isPrivate: appointmentType.isPrivate || false,
        hasResources: appointmentType.hasResources || false,
        resources: appointmentType.resources || [],
      });
      const imageUrl = appointmentType.images?.[0]?.url || appointmentType.images?.[0] || appointmentType.image || null;
      setImagePreview(imageUrl);
    } else {
      setFormData({
        title: '',
        description: '',
        category: '',
        capacity: 1,
        pricingMode: 'FLAT',
        tagsInput: '',
        durationMinutes: 30,
        price: 0,
        providerId: providers[0]?._id || '',
        maxSlotsPerDay: '',
        useCustomAvailability: false,
        availability: [],
        requiresApproval: false,
        isPrivate: false,
        hasResources: false,
        resources: [],
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setActiveTab('basic');
    setProviderAvailability([]);
  }, [appointmentType, isOpen, providers]);

  // Fetch provider availability when provider changes
  const fetchProviderAvailability = async (providerId) => {
    if (!providerId) return;
    setIsLoadingProviderAvailability(true);
    try {
      const response = await availabilityAPI.getByProvider(providerId);
      const rules = response.data?.data?.availabilityRules || response.data?.availabilityRules || [];
      setProviderAvailability(rules);
    } catch (error) {
      console.error('Failed to fetch provider availability:', error);
      setProviderAvailability([]);
    } finally {
      setIsLoadingProviderAvailability(false);
    }
  };

  // Copy provider availability to service
  const copyFromProvider = () => {
    if (providerAvailability.length === 0) {
      toast.error('No provider availability to copy');
      return;
    }
    const copied = providerAvailability.map(rule => ({
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      isActive: true
    }));
    setFormData(prev => ({ ...prev, availability: copied }));
    toast.success('Copied provider availability');
  };

  // Quick setup presets
  const applyPreset = (preset) => {
    let availability = [];
    switch (preset) {
      case 'weekdays-9-5':
        availability = [1, 2, 3, 4, 5].map(day => ({
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true
        }));
        break;
      case 'weekdays-9-6':
        availability = [1, 2, 3, 4, 5].map(day => ({
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true
        }));
        break;
      case 'weekdays-morning':
        availability = [1, 2, 3, 4, 5].map(day => ({
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '12:00',
          isActive: true
        }));
        break;
      case 'weekdays-afternoon':
        availability = [1, 2, 3, 4, 5].map(day => ({
          dayOfWeek: day,
          startTime: '13:00',
          endTime: '17:00',
          isActive: true
        }));
        break;
      case 'everyday':
        availability = [0, 1, 2, 3, 4, 5, 6].map(day => ({
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true
        }));
        break;
      case 'clear':
        availability = [];
        break;
    }
    setFormData(prev => ({ ...prev, availability }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAvailabilitySlot = (dayOfWeek) => {
    setFormData(prev => ({
      ...prev,
      availability: [...prev.availability, { dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true }]
    }));
  };

  const updateAvailabilitySlot = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removeAvailabilitySlot = (index) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.providerId) {
      toast.error('Please select a provider');
      return;
    }
    
    if (!formData.title?.trim()) {
      toast.error('Please enter a service name');
      return;
    }
    
    // Prepare tags from input
    const tags = formData.tagsInput
      ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // Build submit data
    const submitData = { 
      title: formData.title,
      description: formData.description || '',
      durationMinutes: Number(formData.durationMinutes) || 30,
      price: Number(formData.price) || 0,
      category: formData.category || undefined,
      capacity: Number(formData.capacity) || 1,
      pricingMode: formData.pricingMode || 'FLAT',
      tags,
      providerId: formData.providerId,
      maxSlotsPerDay: formData.maxSlotsPerDay ? Number(formData.maxSlotsPerDay) : null,
      useCustomAvailability: formData.useCustomAvailability,
      availability: formData.useCustomAvailability ? formData.availability : [],
      requiresApproval: formData.requiresApproval,
      isPrivate: formData.isPrivate,
      hasResources: formData.hasResources,
      resources: formData.hasResources ? formData.resources.filter(r => r.name?.trim()) : [],
    };
    
    // Handle image upload via FormData if there's a new file
    if (imageFile) {
      const formDataWithImage = new FormData();
      formDataWithImage.append('images', imageFile);
      Object.keys(submitData).forEach(key => {
        if (key === 'availability' || key === 'resources') {
          formDataWithImage.append(key, JSON.stringify(submitData[key]));
        } else if (submitData[key] !== null && submitData[key] !== undefined) {
          formDataWithImage.append(key, submitData[key].toString());
        }
      });
      onSubmit(formDataWithImage, true); // true indicates it has images
    } else {
      onSubmit(submitData, false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointmentType ? 'Edit Service' : 'Create Service'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'basic' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
            )}
          >
            Basic Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('availability')}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'availability' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
            )}
          >
            Availability
          </button>
        </div>

        {activeTab === 'basic' && (
          <>
            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Image
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-video rounded-xl bg-dark-700 border-2 border-dashed border-white/10 hover:border-cyan-500/50 cursor-pointer transition-colors overflow-hidden group"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-white text-sm">Click to change</p>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500">Click to upload image</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <Select
              label="Provider"
              value={formData.providerId}
              onChange={(e) => setFormData(prev => ({ ...prev, providerId: e.target.value }))}
              options={providers.map(p => ({ value: p._id, label: p.name || p.businessName }))}
              required
            />

            <Input
              label="Service Name"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />

            <TextArea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                options={[
                  { value: '', label: 'Select category' },
                  { value: 'HALL', label: 'Hall' },
                  { value: 'TURF', label: 'Turf' },
                  { value: 'APPOINTMENT', label: 'Appointment' },
                  { value: 'PARTY_PLACE', label: 'Party Place' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <Input
                label="Capacity"
                type="number"
                min={1}
                max={100}
                value={formData.capacity}
                onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <Input
              label="Amenities / Tags (comma separated)"
              placeholder="e.g. AC, Parking, Catering"
              value={formData.tagsInput}
              onChange={(e) => setFormData(prev => ({ ...prev, tagsInput: e.target.value }))}
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Duration (min)"
                type="number"
                min={5}
                step={5}
                value={formData.durationMinutes}
                onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 30 }))}
                required
              />
              <Input
                label="Price"
                type="number"
                min={0}
                step={0.01}
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                required
              />
              <Select
                label="Pricing Mode"
                value={formData.pricingMode}
                onChange={(e) => setFormData(prev => ({ ...prev, pricingMode: e.target.value }))}
                options={[
                  { value: 'FLAT', label: 'Flat rate' },
                  { value: 'PER_HOUR', label: 'Per hour' },
                  { value: 'PER_SLOT', label: 'Per slot' },
                ]}
              />
            </div>
            <Input
              label="Max Slots/Day"
              type="number"
              min={1}
              max={50}
              placeholder="Unlimited"
              value={formData.maxSlotsPerDay}
              onChange={(e) => setFormData(prev => ({ ...prev, maxSlotsPerDay: e.target.value }))}
            />
            <p className="text-xs text-gray-500 -mt-2">Leave Max Slots empty for unlimited bookings per day</p>

            {/* Requires Approval Toggle */}
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-xl mt-4">
              <div>
                <p className="text-white font-medium">Require Approval</p>
                <p className="text-sm text-gray-400">Manually approve each booking before confirmation</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, requiresApproval: !prev.requiresApproval }))}
                className={classNames(
                  'relative w-12 h-6 rounded-full transition-colors',
                  formData.requiresApproval ? 'bg-cyan-500' : 'bg-gray-600'
                )}
              >
                <span className={classNames(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  formData.requiresApproval ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>

            {/* Private Service Toggle */}
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-xl mt-4">
              <div>
                <p className="text-white font-medium">Private Service</p>
                <p className="text-sm text-gray-400">Only accessible via a unique private link</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
                className={classNames(
                  'relative w-12 h-6 rounded-full transition-colors',
                  formData.isPrivate ? 'bg-cyan-500' : 'bg-gray-600'
                )}
              >
                <span className={classNames(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  formData.isPrivate ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>
            {formData.isPrivate && (
              <p className="text-xs text-cyan-300 ml-1">
                🔒 This service won't appear on your public booking page. You'll receive a private link after saving.
              </p>
            )}

            {/* Resources Toggle and Management */}
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-xl mt-4">
              <div>
                <p className="text-white font-medium">Has Resources</p>
                <p className="text-sm text-gray-400">e.g., Cricket Ground 1, Court A, Room 101</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  hasResources: !prev.hasResources,
                  resources: !prev.hasResources ? [{ name: '', isActive: true }] : []
                }))}
                className={classNames(
                  'relative w-12 h-6 rounded-full transition-colors',
                  formData.hasResources ? 'bg-cyan-500' : 'bg-gray-600'
                )}
              >
                <span className={classNames(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  formData.hasResources ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>

            {formData.hasResources && (
              <div className="space-y-3 p-4 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">Resource Names</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      resources: [...prev.resources, { name: '', isActive: true }]
                    }))}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Resource
                  </button>
                </div>
                {formData.resources.map((resource, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Resource ${index + 1} (e.g., Ground ${index + 1})`}
                      value={resource.name}
                      onChange={(e) => {
                        const newResources = [...formData.resources];
                        newResources[index] = { ...newResources[index], name: e.target.value };
                        setFormData(prev => ({ ...prev, resources: newResources }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-dark-600 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    {formData.resources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newResources = formData.resources.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, resources: newResources }));
                        }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Customers will choose a specific resource when booking (e.g., "Ground 1" or "Court A")
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'availability' && (
          <div className="space-y-4">
            {/* Toggle for custom availability */}
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-xl">
              <div>
                <p className="text-white font-medium">Custom Availability</p>
                <p className="text-sm text-gray-400">Set specific hours for this service (overrides provider schedule)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newValue = !formData.useCustomAvailability;
                  setFormData(prev => ({ ...prev, useCustomAvailability: newValue }));
                  if (newValue && formData.providerId) {
                    fetchProviderAvailability(formData.providerId);
                  }
                }}
                className={classNames(
                  'relative w-12 h-6 rounded-full transition-colors',
                  formData.useCustomAvailability ? 'bg-cyan-500' : 'bg-gray-600'
                )}
              >
                <span className={classNames(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  formData.useCustomAvailability ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>

            {formData.useCustomAvailability && (
              <>
                {/* Quick Setup Options */}
                <div className="p-4 bg-dark-700/50 rounded-xl border border-white/5">
                  <p className="text-sm text-gray-400 mb-3">Quick Setup</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.providerId) {
                          toast.error('Select a provider first');
                          return;
                        }
                        fetchProviderAvailability(formData.providerId);
                        setTimeout(() => copyFromProvider(), 500);
                      }}
                      disabled={isLoadingProviderAvailability}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy from Provider
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('weekdays-9-5')}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      Mon-Fri 9-5
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('weekdays-morning')}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      Mornings Only
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('weekdays-afternoon')}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      Afternoons Only
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('everyday')}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      Every Day
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('clear')}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Day-by-day availability */}
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {DAYS.map((day, dayIndex) => {
                    const daySlots = formData.availability.filter(s => s.dayOfWeek === dayIndex);
                    return (
                      <div key={day} className="p-4 bg-dark-700 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white font-medium">{day}</span>
                          <button
                            type="button"
                            onClick={() => addAvailabilitySlot(dayIndex)}
                            className="text-cyan-400 text-sm hover:text-cyan-300"
                          >
                            + Add Time Slot
                          </button>
                        </div>
                        {daySlots.length === 0 ? (
                          <p className="text-gray-500 text-sm">No availability (closed)</p>
                        ) : (
                          <div className="space-y-2">
                            {formData.availability.map((slot, index) => {
                              if (slot.dayOfWeek !== dayIndex) return null;
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <select
                                  value={slot.startTime}
                                  onChange={(e) => updateAvailabilitySlot(index, 'startTime', e.target.value)}
                                  className="px-3 py-2 rounded-lg bg-dark-600 border border-white/10 text-white text-sm"
                                >
                                  {TIME_SLOTS.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <span className="text-gray-500">to</span>
                                <select
                                  value={slot.endTime}
                                  onChange={(e) => updateAvailabilitySlot(index, 'endTime', e.target.value)}
                                  className="px-3 py-2 rounded-lg bg-dark-600 border border-white/10 text-white text-sm"
                                >
                                  {TIME_SLOTS.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeAvailabilitySlot(index)}
                                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}

            {!formData.useCustomAvailability && (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>This service uses the provider's default availability schedule</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : appointmentType ? 'Update Service' : 'Create Service'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AppointmentTypeManagement;
