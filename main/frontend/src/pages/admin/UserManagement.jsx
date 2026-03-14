import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, User, Mail, Calendar, Shield, MoreVertical,
  Ban, CheckCircle, Edit2, Trash2, UserPlus
} from 'lucide-react';
import { adminAPI } from '../../api';
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

const roleColors = {
  ADMIN: 'amber',
  ORGANISER: 'emerald',
  CUSTOMER: 'cyan',
  admin: 'amber',
  organiser: 'emerald',
  customer: 'cyan',
};

const roleLabels = {
  ADMIN: 'Admin',
  ORGANISER: 'Organiser',
  CUSTOMER: 'Customer',
  admin: 'Admin',
  organiser: 'Organiser',
  customer: 'Customer',
};

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await adminAPI.getUsers();
      const usersData = response.data.data?.users || response.data.users || response.data || [];
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (userId, role) => {
    setIsProcessing(true);
    try {
      await adminAPI.updateUserRole(userId, role);
      toast.success('User role updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
      toast.error(error.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateUser = async (data) => {
    if (!selectedUser) return;
    setIsProcessing(true);
    try {
      // Use combined update endpoint
      await adminAPI.updateUser(selectedUser._id, {
        name: data.name,
        role: data.role?.toUpperCase(),
        isActive: data.isActive,
      });
      
      toast.success('User updated successfully');
      fetchUsers();
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);
    try {
      // Note: Delete might not be available, using status toggle instead
      await adminAPI.updateUserStatus(selectedUser._id, false);
      toast.success('User deactivated successfully');
      fetchUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await adminAPI.updateUserStatus(user._id, !user.isActive);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'ADMIN' || u.role === 'admin').length,
    organisers: users.filter(u => u.role === 'ORGANISER' || u.role === 'organiser').length,
    customers: users.filter(u => u.role === 'CUSTOMER' || u.role === 'customer').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management"
        subtitle="Manage all platform users"
      />

      {/* Edit Modal */}
      <UserEditModal
        user={selectedUser}
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
        onSubmit={handleUpdateUser}
        isLoading={isProcessing}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete "${selectedUser?.name}"? This action cannot be undone.`}
        confirmText="Delete User"
        isLoading={isProcessing}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Users</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-400">{stats.admins}</p>
          <p className="text-sm text-gray-400">Admins</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-emerald-400">{stats.organisers}</p>
          <p className="text-sm text-gray-400">Organisers</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-cyan-400">{stats.customers}</p>
          <p className="text-sm text-gray-400">Customers</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="organiser">Organisers</option>
          <option value="customer">Customers</option>
        </select>
      </div>

      {/* Users table */}
      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-48 h-4" />
                  <Skeleton className="w-32 h-3" />
                </div>
                <Skeleton className="w-20 h-6 rounded-lg" />
              </div>
            ))}
          </div>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={User}
          title="No users found"
          description={searchQuery ? 'Try a different search term' : 'No users registered yet'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Joined</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    onEdit={() => { setSelectedUser(user); setShowEditModal(true); }}
                    onDelete={() => { setSelectedUser(user); setShowDeleteModal(true); }}
                    onToggleStatus={() => handleToggleStatus(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function UserRow({ user, onEdit, onDelete, onToggleStatus }) {
  const { name, email, role, isActive, createdAt } = user;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <span className="text-cyan-400 font-medium">{name?.[0]}</span>
          </div>
          <div>
            <p className="font-medium text-white">{name}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-6">
        <Badge variant={roleColors[role]}>
          {roleLabels[role]}
        </Badge>
      </td>
      <td className="py-4 px-6">
        <button
          onClick={onToggleStatus}
          className={classNames(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
            isActive 
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          )}
        >
          {isActive ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Active
            </>
          ) : (
            <>
              <Ban className="w-3.5 h-3.5" />
              Inactive
            </>
          )}
        </button>
      </td>
      <td className="py-4 px-6">
        <span className="text-sm text-gray-400">{formatDate(createdAt)}</span>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-2">
          <IconButton 
            icon={Edit2}
            onClick={onEdit} 
            title="Edit"
          />
          <IconButton 
            icon={Trash2}
            onClick={onDelete} 
            className="text-red-400 hover:bg-red-500/10"
            title="Delete"
          />
        </div>
      </td>
    </motion.tr>
  );
}

function UserEditModal({ user, isOpen, onClose, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'customer',
    isActive: true,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'customer',
        isActive: user.isActive ?? true,
      });
    }
  }, [user, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />

        <Select
          label="Role"
          value={formData.role}
          onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
          options={[
            { value: 'customer', label: 'Customer' },
            { value: 'organiser', label: 'Organiser' },
            { value: 'admin', label: 'Admin' },
          ]}
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded border-gray-600 bg-dark-700 text-cyan-500 focus:ring-cyan-500/20"
          />
          <label htmlFor="isActive" className="text-sm text-gray-300">
            User is active
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default UserManagement;
