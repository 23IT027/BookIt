import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { classNames } from '../../utils/helpers';

export function Card({ children, className = '', hover = false, ...props }) {
  const Component = hover ? motion.div : 'div';
  
  return (
    <Component
      className={classNames(
        'bg-dark-800 border border-white/5 rounded-2xl p-6',
        hover && 'cursor-pointer',
        className
      )}
      {...(hover && {
        whileHover: { y: -4, borderColor: 'rgba(6, 182, 212, 0.3)' },
        transition: { duration: 0.2 }
      })}
      {...props}
    >
      {children}
    </Component>
  );
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon: Icon, 
  iconColor = 'cyan',
  loading = false 
}) {
  const iconColors = {
    cyan: 'from-cyan-500 to-blue-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-pink-600',
  };

  const isPositive = change > 0;
  const isNeutral = change === 0;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl skeleton" />
          <div className="w-16 h-6 rounded skeleton" />
        </div>
        <div className="w-24 h-8 rounded skeleton mb-1" />
        <div className="w-32 h-4 rounded skeleton" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div className={classNames(
          'p-3 rounded-xl bg-gradient-to-br',
          iconColors[iconColor]
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        
        {change !== undefined && (
          <div className={classNames(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
            isPositive && 'bg-emerald-500/10 text-emerald-400',
            !isPositive && !isNeutral && 'bg-red-500/10 text-red-400',
            isNeutral && 'bg-gray-500/10 text-gray-400'
          )}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : 
             isNeutral ? <Minus className="w-4 h-4" /> : 
             <TrendingDown className="w-4 h-4" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      
      <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
      <p className="text-sm text-gray-400">{title}</p>
      {changeLabel && (
        <p className="text-xs text-gray-500 mt-1">{changeLabel}</p>
      )}
    </Card>
  );
}

export function GlassCard({ children, className = '' }) {
  return (
    <div className={classNames(
      'glass rounded-2xl p-6',
      className
    )}>
      {children}
    </div>
  );
}

export function FeatureCard({ icon: Icon, title, description, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card cursor-pointer group"
    >
      <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 w-fit mb-4 group-hover:from-cyan-500/30 group-hover:to-blue-600/30 transition-colors">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </motion.div>
  );
}
