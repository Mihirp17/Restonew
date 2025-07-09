import { ReactNode, memo } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor: string;
  iconBgClass: string;
  trend?: {
    value: string | number;
    label: string;
    isPositive: boolean;
  };
}

export const StatsCard = memo(function StatsCard({ 
  title, 
  value, 
  icon, 
  iconColor, 
  iconBgClass,
  trend 
}: StatsCardProps) {
  return (
    <div className="bg-[#ffffff] rounded-lg shadow-sm border border-[#373643]/10 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center">
        <div className={`flex-shrink-0 rounded-lg ${iconBgClass} p-3`}>
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
        <div className="ml-5">
          <p className="text-sm font-medium text-[#373643]/60 truncate">{title}</p>
          <p className="text-xl font-semibold text-[#373643] mt-1">{value}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-4">
          <div className="flex items-center text-sm">
            <span className={`${trend.isPositive ? 'text-green-600' : 'text-[#ba1d1d]'} flex items-center`}>
              <span className="material-icons text-xs mr-1">
                {trend.isPositive ? 'arrow_upward' : 'arrow_downward'}
              </span>
              {trend.value}
            </span>
            <span className="ml-2 text-[#373643]/60">{trend.label}</span>
          </div>
        </div>
      )}
    </div>
  );
});
