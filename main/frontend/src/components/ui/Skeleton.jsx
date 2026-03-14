import { motion } from 'framer-motion';

export function Skeleton({ className = '', variant = 'text' }) {
  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-48 w-full rounded-2xl',
    button: 'h-10 w-24 rounded-xl',
    image: 'h-32 w-full rounded-xl',
  };

  return (
    <div className={`skeleton rounded ${variants[variant]} ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start gap-4">
        <Skeleton variant="avatar" />
        <div className="flex-1 space-y-3">
          <Skeleton variant="title" />
          <Skeleton variant="text" />
          <Skeleton variant="text" className="w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function SlotSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-dark-700 rounded-xl">
          <Skeleton variant="avatar" className="shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
          <Skeleton variant="button" className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function ProviderCardSkeleton() {
  return (
    <motion.div 
      className="card animate-pulse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Skeleton variant="image" className="mb-4" />
      <Skeleton variant="title" className="mb-2" />
      <Skeleton variant="text" className="mb-4" />
      <div className="flex gap-2">
        <Skeleton variant="button" />
        <Skeleton variant="button" />
      </div>
    </motion.div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="avatar" className="h-10 w-10" />
            <Skeleton variant="button" className="w-16" />
          </div>
          <Skeleton variant="title" className="mb-2" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card animate-pulse">
      <Skeleton variant="title" className="mb-6" />
      <div className="h-64 flex items-end gap-2">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className="skeleton flex-1 rounded-t"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}
