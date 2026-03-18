import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, MoreVertical, Clock, 
  CreditCard, Image as ImageIcon, Upload, X, Loader2, Copy, Calendar,
  Building2, Check, Eye, EyeOff, MapPin, Tag, Users, Zap,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp
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
import { useAuthStore } from '../../auth/authStore';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: '', label: 'Select category' },
  { value: 'HALL', label: '🏛️ Hall' },
  { value: 'TURF', label: '⚽ Turf' },
  { value: 'APPOINTMENT', label: '📅 Appointment' },
  { value: 'PARTY_PLACE', label: '🎉 Party Place' },
  { value: 'SALON', label: '💇 Salon' },
  { value: 'CLINIC', label: '🏥 Clinic' },
  { value: 'GYM', label: '🏋️ Gym' },
  { value: 'SPA', label: '🧖 Spa' },
  { value: 'OTHER', label: '📦 Other' },
];

const COMMON_AMENITIES = [
  'AC', 'Parking', 'WiFi', 'Catering', 'Projector', 'Sound System',
  'Restroom', 'Changing Room', 'First Aid', 'Security', 'CCTV',
  'Power Backup', 'Lift', 'Wheelchair Access', 'Stage', 'Kitchen'
];

export function AppointmentTypeManagement() {
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();

  // derive whether we're in /provider or /organiser context
  const isProviderRoute = location.pathname.startsWith('/provider');

  // Smart handler: if no provider profile yet → show setup modal, else open service form
  const handleAddServiceClick = () => {
    if (providers.length === 0) {
      setShowSetupModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleProviderCreated = async (newProvider) => {
    setProviders([newProvider]);
    setShowSetupModal(false);
    // Small delay so the state update propagates, then open the service modal
    setTimeout(() => setShowCreateModal(true), 150);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let provider = null;
      try {
        const providerRes = await providerAPI.getByUser();
        provider = providerRes.data?.data?.provider || providerRes.data?.provider || providerRes.data;
      } catch (e) {
        console.log('No provider found for user');
      }
      
      if (provider) {
        setProviders([provider]);
        const typesRes = await appointmentTypeAPI.getByProvider(provider._id);
        const typesData = typesRes.data?.data?.appointmentTypes || typesRes.data?.appointmentTypes || typesRes.data || [];
        setAppointmentTypes(Array.isArray(typesData) ? typesData : []);
      } else {
        setProviders([]);
        setAppointmentTypes([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load services');
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
        const imageFormData = new FormData();
        const imageFiles = data.getAll('images');
        imageFiles.forEach(f => imageFormData.append('images', f));
        if (imageFiles.length > 0) {
          await appointmentTypeAPI.uploadImages(editingType._id, imageFormData);
        }
        const updateData = {
          title: data.get('title'),
          description: data.get('description'),
          durationMinutes: Number(data.get('durationMinutes')) || 30,
          price: Number(data.get('price')) || 0,
          providerId: data.get('providerId'),
          maxSlotsPerDay: data.get('maxSlotsPerDay') ? Number(data.get('maxSlotsPerDay')) : null,
          useCustomAvailability: data.get('useCustomAvailability') === 'true',
          availability: data.get('availability') ? JSON.parse(data.get('availability')) : [],
          isActive: data.get('isActive') === 'true',
          location: data.get('location') ? JSON.parse(data.get('location')) : undefined,
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
      toast.error(error.response?.data?.message || 'Failed to update service');
    }
  };

  const handleToggleActive = async (service) => {
    try {
      const newActiveState = !(service.isActive !== false);
      await appointmentTypeAPI.update(service._id, { isActive: newActiveState });
      toast.success(`Service ${newActiveState ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update service');
    }
  };

  const filteredTypes = appointmentTypes.filter(type => {
    const typeName = type.title || type.name || '';
    return typeName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Profile route based on user role
  const profileCreateRoute = isProviderRoute ? '/provider/profile' : '/organiser/providers';

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Services"
        subtitle="Manage your services and pricing"
        action={
          <Button onClick={handleAddServiceClick}>
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        }
      />

      {/* Setup Profile modal — shown when PROVIDER has no profile yet */}
      <SetupProviderModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onCreated={handleProviderCreated}
      />

      {/* Modals */}
      <ServiceFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        providers={providers}
        isLoading={isSubmitting}
      />

      <ServiceFormModal
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

      {/* Show empty state if no provider profile */}
      {!isLoading && providers.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No Provider Profile"
          description="You need to set up your provider profile before adding services."
          action={{
            label: 'Set Up Profile & Add Service',
            onClick: () => setShowSetupModal(true),
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
      ) : filteredTypes.length === 0 && providers.length > 0 ? (
        <EmptyState
          icon={Clock}
          title={searchQuery ? 'No services match your search' : 'No services yet'}
          description={searchQuery ? 'Try a different search term' : 'Create your first service to start accepting bookings'}
          action={!searchQuery ? {
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
              onToggleActive={() => handleToggleActive(type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({ service, onEdit, onDelete, onTogglePublish, onToggleActive }) {
  const {
    title, name, description, durationMinutes, duration, price, pricingMode,
    images, image, providerId, useCustomAvailability, isPrivate,
    privateAccessToken, published, isActive, category, tags, location, capacity
  } = service;

  const displayName = title || name;
  const displayDuration = durationMinutes || duration;
  const displayImage = images?.[0]?.url || images?.[0] || image?.url || image;
  const isPublished = published !== false;
  const isServiceActive = isActive !== false;

  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const privateLink = isPrivate && privateAccessToken
    ? `${window.location.origin}/private-booking/${privateAccessToken}`
    : null;

  const copyPrivateLink = (e) => {
    e.stopPropagation();
    if (privateLink) {
      navigator.clipboard.writeText(privateLink);
      setCopied(true);
      toast.success('Private link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label?.replace(/^.\s/, '') || category;
  const pricingLabel = pricingMode === 'PER_HOUR' ? '/hr' : pricingMode === 'PER_SLOT' ? '/slot' : '';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group">
      <Card className="h-full flex flex-col relative !p-0 overflow-visible">
        {/* Status badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {!isServiceActive && (
            <span className="px-2 py-0.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
              Inactive
            </span>
          )}
          {isPrivate && (
            <span className="px-2 py-0.5 bg-cyan-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              Private
            </span>
          )}
          {categoryLabel && (
            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm text-gray-200 text-xs rounded-full">
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Actions menu */}
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
                  className="absolute right-0 top-full mt-2 w-44 bg-dark-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {privateLink && (
                    <button
                      onClick={(e) => { copyPrivateLink(e); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-cyan-300 hover:text-cyan-200 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Private Link
                    </button>
                  )}
                  <button
                    onClick={() => { onToggleActive(); setShowMenu(false); }}
                    className={classNames(
                      "w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors",
                      isServiceActive ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"
                    )}
                  >
                    {isServiceActive ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                    {isServiceActive ? 'Deactivate' : 'Activate'}
                  </button>
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

        {/* Image */}
        <div className={classNames(
          "aspect-video bg-dark-700 overflow-hidden relative",
          !isServiceActive && "opacity-60"
        )}>
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex flex-col items-center justify-center gap-2">
              <ImageIcon className="w-10 h-10 text-gray-600" />
              {images?.length > 1 && (
                <span className="text-xs text-gray-500">{images.length} images</span>
              )}
            </div>
          )}
          {images?.length > 1 && displayImage && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full">
              +{images.length - 1} more
            </div>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col">
          {/* Title & Status dot */}
          <div className="flex items-start gap-2">
            <span
              className={classNames(
                "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5",
                !isServiceActive ? "bg-red-500" : isPublished ? "bg-emerald-500" : "bg-amber-500"
              )}
              title={!isServiceActive ? "Inactive" : isPublished ? "Published" : "Unpublished"}
            />
            <h3 className="font-semibold text-white text-base leading-snug">{displayName}</h3>
          </div>

          {location?.address && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{location.address}</span>
            </div>
          )}

          <p className="text-gray-400 text-sm mt-2 line-clamp-2 flex-1">{description}</p>

          {/* Amenity tags */}
          {tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-white/5 text-gray-400 rounded-full">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs px-2 py-0.5 bg-white/5 text-gray-500 rounded-full">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

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
            {capacity > 1 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                {capacity}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 text-sm font-semibold text-cyan-400">
              {formatCurrency(price)}
              {pricingLabel && <span className="text-gray-500 font-normal text-xs">{pricingLabel}</span>}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Availability helpers ──────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_SLOTS.push(`${hour}:${minute}`);
  }
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, description, color = 'cyan' }) {
  const colors = {
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div className="flex items-center justify-between p-4 bg-dark-700 rounded-xl">
      <div>
        <p className="text-white font-medium">{label}</p>
        {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={classNames(
          'relative w-12 h-6 rounded-full transition-all duration-200',
          value ? colors[color] : 'bg-gray-600'
        )}
      >
        <span className={classNames(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          value ? 'left-7' : 'left-1'
        )} />
      </button>
    </div>
  );
}

// ─── ServiceFormModal ─────────────────────────────────────────────────────────

function ServiceFormModal({ isOpen, onClose, onSubmit, appointmentType, providers, isLoading }) {
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
    isActive: true,
    hasResources: false,
    resources: [],
    locationType: 'IN_PERSON',
    locationAddress: '',
    meetingLink: '',
  });

  // Multiple images
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [tag, setTag] = useState('');

  const [autoGenDay, setAutoGenDay] = useState(null);
  const [autoGenConfig, setAutoGenConfig] = useState({
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 60,
    gapDuration: 0
  });

  const updateFormData = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (appointmentType) {
      setFormData({
        title: appointmentType.title || appointmentType.name || '',
        description: appointmentType.description || '',
        category: appointmentType.category || '',
        capacity: appointmentType.capacity || 1,
        pricingMode: appointmentType.pricingMode || 'FLAT',
        tagsInput: '',
        durationMinutes: appointmentType.durationMinutes || appointmentType.duration || 30,
        price: appointmentType.price || 0,
        providerId: appointmentType.providerId?._id || appointmentType.providerId || appointmentType.provider?._id || '',
        maxSlotsPerDay: appointmentType.maxSlotsPerDay || '',
        useCustomAvailability: appointmentType.useCustomAvailability || false,
        availability: appointmentType.availability || [],
        requiresApproval: appointmentType.requiresApproval || false,
        isPrivate: appointmentType.isPrivate || false,
        isActive: appointmentType.isActive !== false,
        hasResources: appointmentType.hasResources || false,
        resources: appointmentType.resources || [],
        locationType: appointmentType.location?.type || 'IN_PERSON',
        locationAddress: appointmentType.location?.address || '',
        meetingLink: appointmentType.location?.meetingLink || '',
      });
      // Load existing images as previews
      const existingImages = (appointmentType.images || []).map(img => img?.url || img).filter(Boolean);
      setImagePreviews(existingImages);
      setImageFiles([]);
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
        isActive: true,
        hasResources: false,
        resources: [],
        locationType: 'IN_PERSON',
        locationAddress: '',
        meetingLink: '',
      });
      setImagePreviews([]);
      setImageFiles([]);
    }
    setTag('');
    setActiveTab('basic');
    setProviderAvailability([]);
  }, [appointmentType, isOpen, providers]);

  // Derived tags list from the comma-separated tagsInput
  const tagsList = formData.tagsInput
    ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const addTag = (t) => {
    const trimmed = t.trim();
    if (!trimmed) return;
    const existing = tagsList;
    if (!existing.includes(trimmed)) {
      updateFormData('tagsInput', [...existing, trimmed].join(', '));
    }
    setTag('');
  };

  const removeTag = (t) => {
    updateFormData('tagsInput', tagsList.filter(x => x !== t).join(', '));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newFiles = [...imageFiles, ...files].slice(0, 8); // max 8 images
    setImageFiles(newFiles);
    // Generate previews for new files
    newFiles.forEach((file, idx) => {
      if (idx < imageFiles.length) return; // already have preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => {
          const updated = [...prev];
          updated[idx] = reader.result;
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // Provider availability helpers
  const fetchProviderAvailability = async (providerId) => {
    if (!providerId) return;
    setIsLoadingProviderAvailability(true);
    try {
      const response = await availabilityAPI.getByProvider(providerId);
      const rules = response.data?.data?.availabilityRules || response.data?.availabilityRules || [];
      setProviderAvailability(rules);
    } catch {
      setProviderAvailability([]);
    } finally {
      setIsLoadingProviderAvailability(false);
    }
  };

  const copyFromProvider = () => {
    if (providerAvailability.length === 0) { toast.error('No provider availability to copy'); return; }
    const copied = providerAvailability.map(rule => ({
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      isActive: true,
    }));
    updateFormData('availability', copied);
    toast.success('Copied provider availability');
  };

  const applyPreset = (preset) => {
    const presets = {
      'weekdays-9-5': [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', isActive: true })),
      'weekdays-9-6': [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isActive: true })),
      'weekdays-morning': [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '12:00', isActive: true })),
      'weekdays-afternoon': [1,2,3,4,5].map(d => ({ dayOfWeek: d, startTime: '13:00', endTime: '17:00', isActive: true })),
      'everyday': [0,1,2,3,4,5,6].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', isActive: true })),
      'clear': [],
    };
    updateFormData('availability', presets[preset] || []);
  };

  const addAvailabilitySlot = (dayOfWeek) => {
    updateFormData('availability', [...formData.availability, { dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true }]);
  };

  const updateAvailabilitySlot = (index, field, value) => {
    updateFormData('availability', formData.availability.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  const removeAvailabilitySlot = (index) => {
    updateFormData('availability', formData.availability.filter((_, i) => i !== index));
  };

  const handleOpenAutoGen = (dayIndex) => {
    setAutoGenDay(dayIndex === autoGenDay ? null : dayIndex);
    setAutoGenConfig({
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: formData.durationMinutes || 60,
      gapDuration: 0
    });
  };

  const executeAutoGen = (dayIndex) => {
    const { startTime, endTime, slotDuration, gapDuration } = autoGenConfig;
    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const formatTime = (totalMins) => {
      const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
      const m = (totalMins % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    let current = parseTime(startTime);
    const end = parseTime(endTime);
    const newSlots = [];
    const sd = parseInt(slotDuration) || 60;
    const gd = parseInt(gapDuration) || 0;

    while (current + sd <= end) {
      newSlots.push({ dayOfWeek: dayIndex, startTime: formatTime(current), endTime: formatTime(current + sd), isActive: true });
      current += sd + gd;
    }

    if (newSlots.length > 0) {
      const otherDays = formData.availability.filter(s => s.dayOfWeek !== dayIndex);
      updateFormData('availability', [...otherDays, ...newSlots]);
      toast.success(`Generated ${newSlots.length} slots for ${DAYS[dayIndex]}`);
    } else {
      toast.error('Could not fit any slots in the given timeframe');
    }
    setAutoGenDay(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.providerId) { toast.error('Please select a provider'); return; }
    if (!formData.title?.trim()) { toast.error('Please enter a service name'); return; }

    const tags = tagsList;
    const location = {
      type: formData.locationType,
      address: formData.locationAddress || undefined,
      meetingLink: formData.meetingLink || undefined,
    };

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
      isActive: formData.isActive,
      hasResources: formData.hasResources,
      resources: formData.hasResources ? formData.resources.filter(r => r.name?.trim()) : [],
      location,
    };

    if (imageFiles.length > 0) {
      const fd = new FormData();
      imageFiles.forEach(f => fd.append('images', f));
      Object.keys(submitData).forEach(key => {
        const val = submitData[key];
        if (val === null || val === undefined) return;
        if (typeof val === 'object' && !Array.isArray(val)) {
          fd.append(key, JSON.stringify(val));
        } else if (Array.isArray(val)) {
          fd.append(key, JSON.stringify(val));
        } else {
          fd.append(key, val.toString());
        }
      });
      onSubmit(fd, true);
    } else {
      onSubmit(submitData, false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'pricing', label: 'Pricing & Capacity' },
    { id: 'location', label: 'Location' },
    { id: 'images', label: `Images${imagePreviews.length > 0 ? ` (${imagePreviews.length})` : ''}` },
    { id: 'availability', label: 'Availability' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointmentType ? 'Edit Service' : 'Add New Service'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/10 pb-0 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'px-3 py-2.5 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Basic Info ── */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <Select
              label="Provider"
              value={formData.providerId}
              onChange={(e) => updateFormData('providerId', e.target.value)}
              options={providers.map(p => ({ value: p._id, label: p.name || p.businessName }))}
              required
            />

            <Input
              label="Service Name"
              placeholder="e.g. Turf Ground Booking, Party Hall, Haircut"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              required
            />

            <TextArea
              label="Description"
              placeholder="Describe your service — what's included, rules, what to bring, etc."
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              rows={4}
            />

            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => updateFormData('category', e.target.value)}
              options={CATEGORIES}
            />

            {/* Amenities / Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amenities / Tags
              </label>
              {/* Tag chips */}
              {tagsList.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tagsList.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs rounded-full">
                      {t}
                      <button type="button" onClick={() => removeTag(t)} className="hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Custom tag input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tag); } }}
                  placeholder="Type a tag and press Enter"
                  className="flex-1 px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                >
                  Add
                </button>
              </div>
              {/* Quick add common amenities */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1.5">Quick add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_AMENITIES.filter(a => !tagsList.includes(a)).slice(0, 10).map(amenity => (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => addTag(amenity)}
                      className="px-2 py-0.5 bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-cyan-500/40 text-xs rounded-full transition-colors"
                    >
                      + {amenity}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pricing & Capacity ── */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Price (₹)"
                type="number"
                min={0}
                step={0.01}
                value={formData.price}
                onChange={(e) => updateFormData('price', parseFloat(e.target.value) || 0)}
                required
              />
              <Select
                label="Pricing Mode"
                value={formData.pricingMode}
                onChange={(e) => {
                  const val = e.target.value;
                  updateFormData('pricingMode', val);
                  if (val === 'PER_HOUR') {
                    updateFormData('durationMinutes', 60);
                  }
                }}
                options={[
                  { value: 'FLAT', label: 'Flat Rate' },
                  { value: 'PER_HOUR', label: 'Per Hour' },
                  { value: 'PER_SLOT', label: 'Per Slot' },
                ]}
              />
              <Input
                label="Duration (min)"
                type="number"
                min={5}
                step={5}
                value={formData.durationMinutes}
                onChange={(e) => updateFormData('durationMinutes', parseInt(e.target.value) || 30)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Capacity (max guests)"
                type="number"
                min={1}
                max={10000}
                value={formData.capacity}
                onChange={(e) => updateFormData('capacity', parseInt(e.target.value) || 1)}
              />
              <div>
                <Input
                  label="Max Bookings / Day"
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Unlimited"
                  value={formData.maxSlotsPerDay}
                  onChange={(e) => updateFormData('maxSlotsPerDay', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
              </div>
            </div>

            {/* Resources */}
            <Toggle
              value={formData.hasResources}
              onChange={(v) => setFormData(prev => ({ ...prev, hasResources: v, resources: v ? (prev.resources.length ? prev.resources : [{ name: '', isActive: true }]) : [] }))}
              label="Has Resources / Sub-units"
              description="e.g. Ground 1, Court A, Room 101 — customers pick one"
            />

            {formData.hasResources && (
              <div className="space-y-2 p-4 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-300">Resource Names</p>
                  <button
                    type="button"
                    onClick={() => updateFormData('resources', [...formData.resources, { name: '', isActive: true }])}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {formData.resources.map((resource, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Resource ${index + 1} (e.g. Ground ${index + 1})`}
                      value={resource.name}
                      onChange={(e) => {
                        const r = [...formData.resources];
                        r[index] = { ...r[index], name: e.target.value };
                        updateFormData('resources', r);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-dark-600 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    {formData.resources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => updateFormData('resources', formData.resources.filter((_, i) => i !== index))}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Location ── */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            <Select
              label="Location Type"
              value={formData.locationType}
              onChange={(e) => updateFormData('locationType', e.target.value)}
              options={[
                { value: 'IN_PERSON', label: '📍 In-Person' },
                { value: 'ONLINE', label: '💻 Online / Virtual' },
                { value: 'HYBRID', label: '🔀 Hybrid (Both)' },
              ]}
            />

            {(formData.locationType === 'IN_PERSON' || formData.locationType === 'HYBRID') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address / Venue
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <textarea
                    placeholder="e.g. 123 MG Road, Ahmedabad, Gujarat 380001"
                    value={formData.locationAddress}
                    onChange={(e) => updateFormData('locationAddress', e.target.value)}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  />
                </div>
              </div>
            )}

            {(formData.locationType === 'ONLINE' || formData.locationType === 'HYBRID') && (
              <Input
                label="Meeting Link"
                placeholder="https://meet.google.com/... or https://zoom.us/..."
                value={formData.meetingLink}
                onChange={(e) => updateFormData('meetingLink', e.target.value)}
              />
            )}

            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-sm text-gray-400">
              💡 The location will be shown to customers after they complete their booking.
            </div>
          </div>
        )}

        {/* ── Images ── */}
        {activeTab === 'images' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-300">
                  Service Images <span className="text-gray-500 font-normal">(up to 8)</span>
                </label>
                {imagePreviews.length < 8 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload photos
                  </button>
                )}
              </div>

              {/* Image grid */}
              {imagePreviews.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {imagePreviews.map((src, idx) => (
                    <div key={idx} className="relative group aspect-video rounded-xl overflow-hidden bg-dark-700">
                      <img src={src} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-cyan-500/80 text-white text-xs rounded-md font-medium">
                          Cover
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.length < 8 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 flex flex-col items-center justify-center gap-1 transition-colors text-gray-500 hover:text-gray-400"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xs">Add more</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-video rounded-xl bg-dark-700 border-2 border-dashed border-white/10 hover:border-cyan-500/50 cursor-pointer transition-colors flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                    <Upload className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Click to upload images</p>
                    <p className="text-sm text-gray-500 mt-1">JPG, PNG, WEBP — up to 8 photos</p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <div className="p-4 bg-dark-700/50 rounded-xl text-sm text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">Tips for great photos:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-500 text-xs">
                <li>First photo is used as the cover / thumbnail</li>
                <li>Use landscape orientation (16:9) for best display</li>
                <li>Show the actual venue, equipment, and amenities</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Availability ── */}
        {activeTab === 'availability' && (
          <div className="space-y-4">
            <Toggle
              value={formData.useCustomAvailability}
              onChange={(v) => {
                updateFormData('useCustomAvailability', v);
                if (v && formData.providerId) fetchProviderAvailability(formData.providerId);
              }}
              label="Custom Availability"
              description="Set specific hours for this service (overrides provider schedule)"
            />

            {formData.useCustomAvailability && (
              <>
                {/* Quick setup presets */}
                <div className="p-4 bg-dark-700/50 rounded-xl border border-white/5">
                  <p className="text-sm text-gray-400 mb-3">Quick Setup</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { fetchProviderAvailability(formData.providerId); setTimeout(() => copyFromProvider(), 500); }}
                      disabled={isLoadingProviderAvailability}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy from Provider
                    </button>
                    {['weekdays-9-5', 'weekdays-morning', 'weekdays-afternoon', 'everyday'].map(p => (
                      <button key={p} type="button" onClick={() => applyPreset(p)}
                        className="px-3 py-1.5 bg-dark-700 text-gray-400 hover:text-white rounded-lg text-sm hover:bg-dark-600 transition-colors border border-white/10">
                        {p === 'weekdays-9-5' ? 'Mon–Fri 9–5' : p === 'weekdays-morning' ? 'Mornings' : p === 'weekdays-afternoon' ? 'Afternoons' : 'Every Day'}
                      </button>
                    ))}
                    <button type="button" onClick={() => applyPreset('clear')}
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors">
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Day-by-day availability */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {DAYS.map((day, dayIndex) => {
                    const daySlots = formData.availability.filter(s => s.dayOfWeek === dayIndex);
                    return (
                      <div key={day} className="p-4 bg-dark-700 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{day}</span>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => handleOpenAutoGen(dayIndex)}
                              className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> Auto-Generate
                            </button>
                            <button type="button" onClick={() => addAvailabilitySlot(dayIndex)}
                              className="text-cyan-400 text-xs hover:text-cyan-300 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Add Slot
                            </button>
                          </div>
                        </div>

                        {/* Auto-Generate Panel */}
                        {autoGenDay === dayIndex && (
                          <div className="mb-4 p-3 bg-dark-600 rounded-lg border border-emerald-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-emerald-400">⚡ Auto-Generate Slots</span>
                              <button type="button" onClick={() => setAutoGenDay(null)} className="text-gray-400 hover:text-white">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Start Time</label>
                                <select value={autoGenConfig.startTime} onChange={e => setAutoGenConfig(p => ({ ...p, startTime: e.target.value }))}
                                  className="w-full px-2 py-1.5 rounded bg-dark-700 border border-white/10 text-white text-xs">
                                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">End Time</label>
                                <select value={autoGenConfig.endTime} onChange={e => setAutoGenConfig(p => ({ ...p, endTime: e.target.value }))}
                                  className="w-full px-2 py-1.5 rounded bg-dark-700 border border-white/10 text-white text-xs">
                                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Duration (m)</label>
                                <input type="number" min="5" step="5" value={autoGenConfig.slotDuration} onChange={e => setAutoGenConfig(p => ({ ...p, slotDuration: e.target.value }))}
                                  className="w-full px-2 py-1.5 rounded bg-dark-700 border border-white/10 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-500/50" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Gap (m)</label>
                                <input type="number" min="0" step="5" value={autoGenConfig.gapDuration} onChange={e => setAutoGenConfig(p => ({ ...p, gapDuration: e.target.value }))}
                                  className="w-full px-2 py-1.5 rounded bg-dark-700 border border-white/10 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-500/50" />
                              </div>
                            </div>
                            <button type="button" onClick={() => executeAutoGen(dayIndex)}
                              className="w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded transition-colors border border-emerald-500/30">
                              Generate & Replace Slots
                            </button>
                          </div>
                        )}
                        {daySlots.length === 0 ? (
                          <p className="text-gray-500 text-xs">Closed / Not available</p>
                        ) : (
                          <div className="space-y-2">
                            {formData.availability.map((slot, index) => {
                              if (slot.dayOfWeek !== dayIndex) return null;
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <select value={slot.startTime} onChange={(e) => updateAvailabilitySlot(index, 'startTime', e.target.value)}
                                    className="px-3 py-1.5 rounded-lg bg-dark-600 border border-white/10 text-white text-sm">
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <span className="text-gray-500 text-sm">to</span>
                                  <select value={slot.endTime} onChange={(e) => updateAvailabilitySlot(index, 'endTime', e.target.value)}
                                    className="px-3 py-1.5 rounded-lg bg-dark-600 border border-white/10 text-white text-sm">
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <button type="button" onClick={() => removeAvailabilitySlot(index)}
                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg">
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
              <div className="text-center py-10 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Using Provider's Schedule</p>
                <p className="text-sm text-gray-500 mt-1">This service inherits the provider's default availability</p>
              </div>
            )}
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            <Toggle
              value={formData.isActive}
              onChange={(v) => updateFormData('isActive', v)}
              label="Active"
              description="Enable or disable this service. Inactive services cannot be booked."
              color={formData.isActive ? 'emerald' : 'red'}
            />

            <Toggle
              value={formData.requiresApproval}
              onChange={(v) => updateFormData('requiresApproval', v)}
              label="Require Approval"
              description="Manually approve each booking before it is confirmed"
            />

            <Toggle
              value={formData.isPrivate}
              onChange={(v) => updateFormData('isPrivate', v)}
              label="Private Service"
              description="Only accessible via a unique private link; hidden from public listing"
            />

            {formData.isPrivate && (
              <div className="px-4 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-sm text-cyan-300">
                🔒 A unique private link will be generated after saving. Share it only with intended customers.
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : appointmentType ? 'Update Service' : 'Create Service'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── SetupProviderModal ───────────────────────────────────────────────────────
// Shown when a PROVIDER role user hasn't created their provider profile yet.
// Creates the profile then signals the parent so the service form can open.

function SetupProviderModal({ isOpen, onClose, onCreated }) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    description: '',
    city: '',
    state: '',
    contactPhone: '',
    contactEmail: '',
    timezone: 'Asia/Kolkata',
  });

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Business name is required'); return; }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        specialization: formData.specialization.trim() || undefined,
        description: formData.description.trim() || undefined,
        timezone: formData.timezone,
        contactPhone: formData.contactPhone.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        address: (formData.city || formData.state)
          ? { city: formData.city, state: formData.state }
          : undefined,
      };
      const res = await providerAPI.create(payload);
      const newProvider = res.data?.data?.provider || res.data?.provider || res.data;
      toast.success('Profile created! Now add your first service.');
      onCreated(newProvider);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create provider profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '', specialization: '', description: '',
        city: '', state: '', contactPhone: '', contactEmail: '',
        timezone: 'Asia/Kolkata',
      });
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Up Your Provider Profile" size="md">
      <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-sm text-cyan-300">
        ✨ Quick setup — you can always update these details later in your Profile.
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Business / Venue Name"
          placeholder="e.g. Green Turf Arena, Shree Hall, Dr. Patel's Clinic"
          value={formData.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />

        <Input
          label="Specialization / Type"
          placeholder="e.g. Turf Booking, Event Hall, Dental Clinic"
          value={formData.specialization}
          onChange={(e) => update('specialization', e.target.value)}
        />

        <TextArea
          label="Short Description"
          placeholder="Tell customers about your business..."
          value={formData.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            placeholder="Ahmedabad"
            value={formData.city}
            onChange={(e) => update('city', e.target.value)}
          />
          <Input
            label="State"
            placeholder="Gujarat"
            value={formData.state}
            onChange={(e) => update('state', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="+91 98765 43210"
            value={formData.contactPhone}
            onChange={(e) => update('contactPhone', e.target.value)}
          />
          <Input
            label="Contact Email (optional)"
            type="email"
            placeholder="business@email.com"
            value={formData.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
            ) : (
              <>Create Profile & Continue →</>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AppointmentTypeManagement;
