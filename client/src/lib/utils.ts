import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
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

export function calculateTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
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
