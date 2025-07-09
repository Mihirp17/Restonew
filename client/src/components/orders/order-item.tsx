import { getStatusColor } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: string;
}

function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const statusColors = getStatusColor(status);
  
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bgClass} ${statusColors.textClass} ${statusColors.darkBgClass} ${statusColors.darkTextClass}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Export components
export const OrderItem = {
  StatusBadge: OrderStatusBadge
};
