import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Calendar, User, Building2, Clock, Filter,
  Eye, CheckCircle, XCircle, MoreVertical
} from 'lucide-react';
import { adminAPI, bookingAPI, providerAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge, PaymentBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

export function AdminBookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all providers first
      const providersRes = await providerAPI.getAll();
      const providersData = providersRes.data.data?.providers || providersRes.data.providers || [];
      setProviders(providersData);

      // Create a map for quick provider lookup
      const providerMap = {};
      providersData.forEach(p => {
        providerMap[p._id] = p;
      });

      // Try to use admin API for all bookings (more efficient)
      try {
        const bookingsRes = await adminAPI.getAllBookings();
        let allBookings = bookingsRes.data.data?.bookings || bookingsRes.data.bookings || [];
        
        // Enrich bookings with provider data if not populated
        allBookings = allBookings.map(booking => {
          if (typeof booking.providerId === 'string' || !booking.providerId?.name) {
            const providerId = typeof booking.providerId === 'string' ? booking.providerId : booking.providerId?._id;
            const providerData = providerMap[providerId];
            if (providerData) {
              return { ...booking, providerId: providerData };
            }
          }
          return booking;
        });
        
        // Sort by creation date (newest first)
        allBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(allBookings);
      } catch (adminError) {
        console.log('Admin API not available, falling back to provider-based fetching');
        
        // Fallback: Fetch bookings from all providers
        let allBookings = [];
        for (const provider of providersData) {
          try {
            const bookingsRes = await bookingAPI.getProviderBookings(provider._id);
            const providerBookings = bookingsRes.data.data?.bookings || bookingsRes.data.bookings || [];
            // Enrich bookings with provider data if not populated
            const enrichedBookings = providerBookings.map(booking => {
              // If providerId is just an ID string, enrich with full provider data
              if (typeof booking.providerId === 'string' || !booking.providerId?.name) {
                const providerId = typeof booking.providerId === 'string' ? booking.providerId : booking.providerId?._id;
                return {
                  ...booking,
                  providerId: providerMap[providerId] || { _id: providerId, name: provider.name }
                };
              }
              return booking;
            });
            allBookings = [...allBookings, ...enrichedBookings];
          } catch (e) {
            // Provider might not have bookings
          }
        }

        // Remove duplicates by booking ID
        const uniqueBookings = allBookings.reduce((acc, booking) => {
          if (!acc.find(b => b._id === booking._id)) {
            acc.push(booking);
          }
          return acc;
        }, []);

        // Sort by creation date (newest first)
        uniqueBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(uniqueBookings);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const filteredBookings = bookings.filter(booking => {
    const customerName = booking.customerId?.name || booking.guestInfo?.name || booking.customerName || '';
    const providerName = booking.providerId?.name || '';
    const appointmentTitle = booking.appointmentTypeId?.title || booking.appointmentType?.title || '';
    
    const matchesSearch = 
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointmentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.guestInfo?.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const bookingStatus = (booking.status || '').toUpperCase();
    const matchesStatus = statusFilter === 'all' || bookingStatus === statusFilter.toUpperCase();
    
    const bookingProviderId = booking.providerId?._id || booking.providerId;
    const matchesProvider = providerFilter === 'all' || bookingProviderId === providerFilter;
    
    return matchesSearch && matchesStatus && matchesProvider;
  });

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => (b.status || '').toUpperCase() === 'CONFIRMED').length,
    pending: bookings.filter(b => (b.status || '').toUpperCase() === 'PENDING').length,
    cancelled: bookings.filter(b => (b.status || '').toUpperCase() === 'CANCELLED').length,
    completed: bookings.filter(b => (b.status || '').toUpperCase() === 'COMPLETED').length,
  };

  const totalRevenue = bookings
    .filter(b => b.paymentStatus === 'PAID' || b.paymentStatus?.toUpperCase() === 'PAID')
    .reduce((sum, b) => sum + (b.totalAmount || b.appointmentTypeId?.price || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Booking Management"
        subtitle="View and manage all bookings across the platform"
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-400">Total Bookings</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Confirmed</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.confirmed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Cancelled</p>
          <p className="text-2xl font-bold text-red-400">{stats.cancelled}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Total Revenue</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalRevenue)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="md:w-40"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </Select>
          <Select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="md:w-48"
          >
            <option value="all">All Providers</option>
            {providers.map(provider => (
              <option key={provider._id} value={provider._id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Bookings list */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-4 mb-2" />
                  <Skeleton className="w-48 h-3" />
                </div>
                <Skeleton className="w-20 h-6" />
              </div>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No bookings found"
            description={searchQuery || statusFilter !== 'all' ? "Try adjusting your filters" : "No bookings have been made yet"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Booking</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Customer</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Provider</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Date & Time</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredBookings.map((booking) => {
                  const appointmentType = booking.appointmentTypeId || booking.appointmentType;
                  const startTime = booking.startTime || booking.slot?.date;
                  
                  return (
                    <motion.tr
                      key={booking._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-dark-700/30 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-white">
                            {appointmentType?.title || 'Appointment'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {booking._id?.slice(-8) || 'N/A'}
                          </p>
                          {booking.selectedResource?.name && (
                            <p className="text-xs text-purple-400 mt-1">
                              📍 {booking.selectedResource.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-white">
                              {booking.customerId?.name || booking.guestInfo?.name || booking.customerName || 'N/A'}
                              {(booking.isGuestBooking || booking.isPrivateBooking) && (
                                <span className="ml-1.5 text-xs text-cyan-400">(Guest)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{booking.customerId?.email || booking.guestInfo?.email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300">{booking.providerId?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-white">{startTime ? formatDate(startTime) : 'N/A'}</p>
                            <p className="text-xs text-gray-400">{startTime ? formatTime(startTime) : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">
                            {formatCurrency(booking.totalAmount || appointmentType?.price || 0)}
                          </p>
                          <div className="mt-1">
                            <PaymentBadge status={booking.paymentStatus} bookingStatus={booking.status} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end">
                          <IconButton
                            icon={Eye}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(booking)}
                            title="View details"
                          />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Booking Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBooking(null);
        }}
        title="Booking Details"
        size="lg"
      >
        {selectedBooking && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedBooking.appointmentTypeId?.title || selectedBooking.appointmentType?.title || 'Appointment'}
                </h3>
                <p className="text-sm text-gray-400">Booking ID: {selectedBooking._id}</p>
              </div>
              <StatusBadge status={selectedBooking.status} />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Customer</p>
                <p className="text-white">
                  {selectedBooking.customerId?.name || selectedBooking.guestInfo?.name || selectedBooking.customerName || 'N/A'}
                  {(selectedBooking.isGuestBooking || selectedBooking.isPrivateBooking) && (
                    <span className="ml-1.5 text-xs text-cyan-400">(Guest)</span>
                  )}
                </p>
                <p className="text-sm text-gray-400">{selectedBooking.customerId?.email || selectedBooking.guestInfo?.email || ''}</p>
                {selectedBooking.guestInfo?.phone && (
                  <p className="text-sm text-gray-400">{selectedBooking.guestInfo.phone}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-400">Provider</p>
                <p className="text-white">{selectedBooking.providerId?.name || 'N/A'}</p>
              </div>
              {selectedBooking.selectedResource?.name && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-400">Resource</p>
                  <p className="font-medium text-purple-400">{selectedBooking.selectedResource.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-400">Date</p>
                <p className="text-white">
                  {selectedBooking.startTime ? formatDate(selectedBooking.startTime) : 
                   selectedBooking.slot?.date ? formatDate(selectedBooking.slot.date) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Time</p>
                <p className="text-white">
                  {selectedBooking.startTime ? formatTime(selectedBooking.startTime) : 
                   selectedBooking.slot?.startTime || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Amount</p>
                <p className="text-white font-medium">
                  {formatCurrency(selectedBooking.totalAmount || selectedBooking.appointmentTypeId?.price || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Payment Status</p>
                <div className="mt-1">
                  <PaymentBadge status={selectedBooking.paymentStatus} bookingStatus={selectedBooking.status} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">Created At</p>
                <p className="text-white">{formatDate(selectedBooking.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Location</p>
                <p className="text-white">
                  {selectedBooking.appointmentTypeId?.location?.type || 
                   selectedBooking.appointmentType?.location?.type || 'N/A'}
                </p>
              </div>
            </div>

            {/* Notes/Answers */}
            {selectedBooking.answers && selectedBooking.answers.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Customer Responses</p>
                <div className="space-y-2 bg-dark-700/50 rounded-lg p-3">
                  {selectedBooking.answers.map((answer, idx) => (
                    <div key={idx}>
                      <p className="text-xs text-gray-400">{answer.question}</p>
                      <p className="text-white text-sm">{answer.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-dark-600">
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminBookingManagement;
