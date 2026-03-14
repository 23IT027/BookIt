import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  CreditCard,
  Package,
  FileText,
  Ban,
  RefreshCw,
  Banknote
} from 'lucide-react';
import { classNames } from '../../utils/helpers';

export function Badge({ children, variant = 'default', size = 'md', icon: Icon }) {
  const variants = {
    default: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    error: 'bg-red-500/20 text-red-400 border-red-500/40',
    info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };

  return (
    <span className={classNames(
      'inline-flex items-center gap-1.5 rounded-full font-semibold border backdrop-blur-sm',
      variants[variant],
      sizes[size]
    )}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, showIcon = true }) {
  const config = {
    PENDING: { variant: 'warning', icon: Clock, label: 'Pending Approval' },
    CONFIRMED: { variant: 'success', icon: CheckCircle, label: 'Confirmed' },
    COMPLETED: { variant: 'info', icon: CheckCircle, label: 'Completed' },
    CANCELLED: { variant: 'error', icon: XCircle, label: 'Cancelled' },
    NO_SHOW: { variant: 'purple', icon: AlertCircle, label: 'No Show' },
  };

  const { variant, icon, label } = config[status?.toUpperCase?.()] || { 
    variant: 'default', 
    icon: FileText, 
    label: status 
  };

  return <Badge variant={variant} icon={showIcon ? icon : null}>{label}</Badge>;
}

export function RoleBadge({ role }) {
  const config = {
    CUSTOMER: { variant: 'info', label: 'Customer' },
    ORGANISER: { variant: 'blue', label: 'Organiser' },
    ADMIN: { variant: 'success', label: 'Admin' },
  };

  const { variant, label } = config[role] || { variant: 'default', label: role };

  return <Badge variant={variant}>{label}</Badge>;
}

export function PaymentBadge({ status, bookingStatus }) {
  // If booking is cancelled, show appropriate payment status
  if (bookingStatus?.toUpperCase?.() === 'CANCELLED') {
    if (status?.toUpperCase?.() === 'REFUNDED') {
      return <Badge variant="info" icon={RefreshCw}>Refunded</Badge>;
    } else if (status?.toUpperCase?.() === 'PAID') {
      return <Badge variant="warning" icon={RefreshCw}>Refund Pending</Badge>;
    } else {
      return <Badge variant="default" icon={Ban}>No Payment</Badge>;
    }
  }

  const config = {
    PENDING: { variant: 'warning', icon: Clock, label: 'Payment Pending' },
    PAID: { variant: 'success', icon: Banknote, label: 'Paid' },
    REFUNDED: { variant: 'info', icon: RefreshCw, label: 'Refunded' },
    FAILED: { variant: 'error', icon: XCircle, label: 'Payment Failed' },
    FREE: { variant: 'default', icon: Package, label: 'Free' },
  };

  const { variant, icon, label } = config[status?.toUpperCase?.()] || { 
    variant: 'default', 
    icon: CreditCard, 
    label: status 
  };

  return <Badge variant={variant} icon={icon}>{label}</Badge>;
}

export function CountBadge({ count, max = 99 }) {
  const displayCount = count > max ? `${max}+` : count;
  
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500 text-white text-xs font-bold"
    >
      {displayCount}
    </motion.span>
  );
}
