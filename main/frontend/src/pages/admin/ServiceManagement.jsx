import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, Package, Eye, EyeOff, Clock, 
  User, Building2, MoreVertical, Link, Lock
} from 'lucide-react';
import { adminAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, classNames } from '../../utils/helpers';
import toast from 'react-hot-toast';

export function ServiceManagement() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [processingIds, setProcessingIds] = useState(new Set());

  useEffect(() => {
    fetchServices();
  }, [currentPage, statusFilter]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (statusFilter === 'published') params.published = true;
      if (statusFilter === 'unpublished') params.published = false;
      
      const response = await adminAPI.getAllServices(params);
      const data = response.data.data || response.data;
      setServices(data.appointmentTypes || data.services || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePublish = async (service) => {
    const newProcessing = new Set(processingIds);
    newProcessing.add(service._id);
    setProcessingIds(newProcessing);

    try {
      await adminAPI.toggleServicePublish(service._id);
      toast.success(`Service ${service.published ? 'unpublished' : 'published'} successfully`);
      fetchServices();
    } catch (error) {
      console.error('Failed to toggle service status:', error);
      toast.error(error.response?.data?.message || 'Failed to update service');
    } finally {
      const updated = new Set(processingIds);
      updated.delete(service._id);
      setProcessingIds(updated);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = 
      service.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.providerId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.providerId?.userId?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: pagination.total || services.length,
    published: services.filter(s => s.published !== false).length,
    unpublished: services.filter(s => s.published === false).length,
    private: services.filter(s => s.isPrivate).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Service Management"
        subtitle="Manage all provider services and their visibility"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-400">Total Services</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-400">Published</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.published}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-400">Unpublished</p>
          <p className="text-2xl font-bold text-amber-400">{stats.unpublished}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-400">Private</p>
          <p className="text-2xl font-bold text-cyan-400">{stats.private}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search services, providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="md:w-48"
          >
            <option value="all">All Services</option>
            <option value="published">Published Only</option>
            <option value="unpublished">Unpublished Only</option>
          </Select>
        </div>
      </Card>

      {/* Services Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No services found"
            description={searchQuery ? "Try adjusting your search" : "No services have been created yet"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Service</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Provider</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Price</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Duration</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredServices.map((service, index) => (
                  <motion.tr
                    key={service._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {service.images?.[0]?.url ? (
                          <img
                            src={service.images[0].url}
                            alt={service.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{service.title}</p>
                            {service.isPrivate && (
                              <Badge variant="secondary" size="sm" className="bg-cyan-500/20 text-cyan-400">
                                <Lock className="w-3 h-3 mr-1" />
                                Private
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1 max-w-xs">
                            {service.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-dark-700 rounded-full">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">
                            {service.providerId?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {service.providerId?.userId?.name || service.organiserId?.name || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-medium">₹</span>
                        <span className="text-white font-medium">
                          {service.price?.toLocaleString('en-IN') || '0'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-gray-300">
                          {service.durationMinutes || 0} min
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge 
                        variant={service.published !== false ? 'success' : 'warning'}
                        className={classNames(
                          service.published !== false 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        )}
                      >
                        {service.published !== false ? 'Published' : 'Unpublished'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant={service.published !== false ? 'ghost' : 'primary'}
                          onClick={() => handleTogglePublish(service)}
                          disabled={processingIds.has(service._id)}
                          className={classNames(
                            "min-w-[100px]",
                            service.published !== false 
                              ? "text-amber-400 hover:bg-amber-500/10" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          {processingIds.has(service._id) ? (
                            <span className="flex items-center gap-2">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                              />
                              Updating...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              {service.published !== false ? (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  Publish
                                </>
                              )}
                            </span>
                          )}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {currentPage} of {pagination.pages} ({pagination.total} total services)
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default ServiceManagement;
