import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function calculateTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return formatDate(past);
}

/**
 * Generates a hash code from a string
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;
  
  return function(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    // Store the latest arguments
    lastArgs = args;
    
    // If this is the first call or if enough time has passed
    if (timeSinceLastCall >= wait) {
      lastCallTime = now;
      func(...args);
    } else {
      // Otherwise, set a timeout for the remaining time
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        lastCallTime = Date.now();
        func(...(lastArgs as Parameters<T>));
        lastArgs = null;
        timeout = null;
      }, wait - timeSinceLastCall);
    }
  };
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): {
  bgClass: string;
  textClass: string;
  darkBgClass: string;
  darkTextClass: string;
} {
  switch (status.toLowerCase()) {
    case 'active':
    case 'completed':
    case 'served':
      return {
        bgClass: 'bg-green-100',
        textClass: 'text-green-800',
        darkBgClass: 'dark:bg-green-900/30',
        darkTextClass: 'dark:text-green-300'
      };
    case 'pending':
    case 'confirmed':
      return {
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-800',
        darkBgClass: 'dark:bg-blue-900/30',
        darkTextClass: 'dark:text-blue-300'
      };
    case 'preparing':
      return {
        bgClass: 'bg-yellow-100',
        textClass: 'text-yellow-800',
        darkBgClass: 'dark:bg-yellow-900/30',
        darkTextClass: 'dark:text-yellow-300'
      };
    case 'cancelled':
    case 'past_due':
      return {
        bgClass: 'bg-red-100',
        textClass: 'text-red-800',
        darkBgClass: 'dark:bg-red-900/30',
        darkTextClass: 'dark:text-red-300'
      };
    default:
      return {
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-800',
        darkBgClass: 'dark:bg-gray-700',
        darkTextClass: 'dark:text-gray-300'
      };
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

export function generateOrderId(): string {
  return '#ORD-' + Math.floor(1000 + Math.random() * 9000);
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function getRelativeDateRange(period: 'today' | 'week' | 'month' | 'year'): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0));
  }
  
  return { startDate, endDate };
}
