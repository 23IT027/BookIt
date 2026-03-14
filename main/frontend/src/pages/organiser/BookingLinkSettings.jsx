import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Link2, Copy, Check, ExternalLink, Globe, Eye, EyeOff, 
  RefreshCw, AlertCircle, Loader2, Settings, Share2, Building2, Plus 
} from 'lucide-react';
import { providerAPI, publicBookingAPI } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export function BookingLinkSettings() {
  const [provider, setProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Form state
  const [bookingSlug, setBookingSlug] = useState('');
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);

  useEffect(() => {
    fetchProvider();
  }, []);

  const fetchProvider = async () => {
    setIsLoading(true);
    try {
      const response = await providerAPI.getByUser();
      const providerData = response.data?.data?.provider || response.data?.provider;
      setProvider(providerData);
      setBookingSlug(providerData?.bookingSlug || '');
      setPublicBookingEnabled(providerData?.publicBookingEnabled || false);
    } catch (error) {
      // 404 means no provider yet - not an error, just show empty state
      if (error.response?.status === 404) {
        setProvider(null);
      } else {
        console.error('Failed to fetch provider:', error);
        toast.error('Failed to load provider settings');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateSlug = (slug) => {
    if (!slug) return '';
    if (slug.length < 3) return 'Slug must be at least 3 characters';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (slug.startsWith('-') || slug.endsWith('-')) return 'Cannot start or end with a hyphen';
    return '';
  };

  const handleSlugChange = async (value) => {
    const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setBookingSlug(cleanSlug);
    setSlugAvailable(null);
    
    const error = validateSlug(cleanSlug);
    setSlugError(error);
    
    if (!error && cleanSlug.length >= 3 && cleanSlug !== provider?.bookingSlug) {
      // Check availability
      setIsCheckingSlug(true);
      try {
        const response = await publicBookingAPI.checkSlug(cleanSlug);
        const isAvailable = response.data?.data?.available ?? response.data?.available;
        setSlugAvailable(isAvailable);
        if (!isAvailable) {
          setSlugError('This link is already taken');
        }
      } catch (error) {
        console.error('Failed to check slug:', error);
      } finally {
        setIsCheckingSlug(false);
      }
    }
  };

  const generateRandomSlug = () => {
    const adjectives = ['quick', 'bright', 'smart', 'cool', 'swift', 'pro', 'prime'];
    const nouns = ['booking', 'schedule', 'meet', 'call', 'session', 'consult'];
    const random = Math.random().toString(36).substring(2, 6);
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const newSlug = `${adjective}-${noun}-${random}`;
    handleSlugChange(newSlug);
  };

  const handleSave = async () => {
    if (slugError) {
      toast.error('Please fix the errors before saving');
      return;
    }
    
    setIsSaving(true);
    try {
      await providerAPI.update(provider._id, {
        bookingSlug: bookingSlug || null,
        publicBookingEnabled
      });
      toast.success('Booking link settings saved!');
      fetchProvider(); // Refresh data
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/book/${bookingSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const bookingLink = bookingSlug ? `${window.location.origin}/book/${bookingSlug}` : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Link</h1>
          <p className="text-gray-400 mt-1">
            Create a shareable booking page for your clients - just like Cal.com!
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title="No Provider Profile"
          description="Create a provider profile first to set up your booking link."
          action={{
            label: 'Create Provider',
            onClick: () => {},
            as: Link,
            to: '/organiser/providers',
            icon: Plus,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Booking Link</h1>
        <p className="text-gray-400 mt-1">
          Create a shareable booking page for your clients - just like Cal.com!
        </p>
      </div>

      {/* Preview Card */}
      {bookingSlug && publicBookingEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Your booking link</p>
                  <p className="text-lg font-medium text-white break-all">{bookingLink}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={copyLink}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <a 
                  href={bookingLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          Link Settings
        </h2>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                publicBookingEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'
              }`}>
                {publicBookingEnabled ? (
                  <Eye className="w-5 h-5 text-green-400" />
                ) : (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-white">Public Booking Page</p>
                <p className="text-sm text-gray-400">
                  {publicBookingEnabled 
                    ? 'Anyone with your link can book appointments' 
                    : 'Only logged-in users can book'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPublicBookingEnabled(!publicBookingEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                publicBookingEnabled ? 'bg-cyan-500' : 'bg-dark-600'
              }`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                publicBookingEnabled ? 'left-8' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Booking Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Booking Link
            </label>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-0 rounded-xl overflow-hidden border border-white/10 bg-dark-700">
                <span className="px-4 py-3 bg-dark-600 text-gray-400 text-sm whitespace-nowrap border-r border-white/10">
                  {window.location.origin}/book/
                </span>
                <input
                  type="text"
                  value={bookingSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="your-name"
                  className="flex-1 px-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none"
                />
                {isCheckingSlug && (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-3" />
                )}
                {slugAvailable === true && !isCheckingSlug && (
                  <Check className="w-5 h-5 text-green-400 mr-3" />
                )}
              </div>
              <Button 
                variant="secondary" 
                onClick={generateRandomSlug}
                title="Generate random slug"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {slugError && (
              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {slugError}
              </p>
            )}
            {slugAvailable === true && !slugError && (
              <p className="mt-2 text-sm text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                This link is available!
              </p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !!slugError}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </Card>

      {/* Tips */}
      <Card className="p-6">
        <h3 className="font-semibold text-white mb-4">💡 Tips for your booking page</h3>
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            Share your booking link on your website, social media, or email signature
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            Guests can book without creating an account - they just need their email
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            Make sure you have set up your availability before enabling public bookings
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            Only published services will appear on your booking page
          </li>
        </ul>
      </Card>
    </div>
  );
}

export default BookingLinkSettings;
