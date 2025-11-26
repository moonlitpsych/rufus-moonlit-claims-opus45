/**
 * Date Range Filter Component
 * Quick filter for appointment date ranges
 */

'use client';

interface DateRangeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const options = [
    { value: '7', label: 'Last 7 days' },
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '60', label: 'Last 60 days' },
    { value: '90', label: 'Last 90 days' },
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="dateRange" className="text-sm font-medium text-gray-700">
        Show:
      </label>
      <select
        id="dateRange"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
