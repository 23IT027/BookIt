import { motion } from 'framer-motion';
import { Package, AlertCircle, Plus, Search, Calendar } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({ 
  icon: Icon = Package, 
  title, 
  description, 
  action,
  actionLabel,
  onAction 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="p-4 rounded-2xl bg-dark-700 border border-white/5 mb-6">
        <Icon className="w-12 h-12 text-gray-500" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-md mb-6">{description}</p>
      {action && (
        <Button onClick={onAction} icon={Plus}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export function NoResults({ query }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any results for "${query}". Try adjusting your search or filters.`}
    />
  );
}

export function NoBookings() {
  return (
    <EmptyState
      icon={Calendar}
      title="No bookings yet"
      description="You haven't made any bookings yet. Browse our providers to get started."
      action
      actionLabel="Browse Providers"
      onAction={() => window.location.href = '/browse'}
    />
  );
}

export function ErrorState({ 
  title = 'Something went wrong', 
  message,
  onRetry 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
        <AlertCircle className="w-12 h-12 text-red-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-md mb-6">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </motion.div>
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-dark-600" />
        <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-gray-400">{message}</p>
    </div>
  );
}
