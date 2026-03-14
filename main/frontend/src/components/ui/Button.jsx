import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { classNames } from '../../utils/helpers';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20',
    secondary: 'bg-dark-600 hover:bg-dark-500 text-gray-100 border border-white/10',
    ghost: 'hover:bg-white/5 text-gray-300 hover:text-white',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
    outline: 'border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900 focus:ring-cyan-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4" />}
        </>
      )}
    </motion.button>
  );
}

export function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
    secondary: 'bg-dark-600 text-gray-300 border border-white/10',
    ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
    danger: 'text-red-400 hover:bg-red-500/10',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={classNames(
        'inline-flex items-center justify-center rounded-xl transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
    </motion.button>
  );
}
