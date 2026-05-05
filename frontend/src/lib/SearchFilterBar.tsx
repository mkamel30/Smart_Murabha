import type { ReactNode } from 'react';
import { SmartSelect } from './SmartSelect';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    allLabel: string;
  }[];
  actions?: ReactNode;
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  filters,
  actions,
}: SearchFilterBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pr-9 pl-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
        />
      </div>
      {filters?.map((f) => (
        <div key={f.key} className="min-w-[160px]">
          <SmartSelect
            options={f.options.map((opt) => ({ id: opt.value, label: opt.label }))}
            value={f.value}
            onChange={f.onChange}
            placeholder={f.allLabel}
            allowEmpty
            emptyLabel={f.allLabel}
          />
        </div>
      ))}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}