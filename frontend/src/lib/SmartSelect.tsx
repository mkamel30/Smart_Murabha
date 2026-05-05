import { useState, useRef, useEffect } from 'react';

interface SmartSelectProps {
  options: { id: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function SmartSelect({ options, value, onChange, placeholder = 'اختر...', allowEmpty = false, emptyLabel = '-- الكل --' }: SmartSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allOptions = allowEmpty ? [{ id: '', label: emptyLabel }, ...options] : options;
  const selected = allOptions.find(o => o.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = allOptions.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) || 
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472] transition-colors"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
      >
        <span className={(selected && selected.id !== '') ? '' : 'text-gray-400'}>
          {selected ? `${selected.label}${selected.sublabel ? ` (${selected.sublabel})` : ''}` : placeholder}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2472]/20"
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">لا توجد نتائج</div>
            ) : (
              filtered.map(option => (
                <div
                  key={option.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-[#0A2472]/5 text-sm ${
                    option.id === value ? 'bg-[#0A2472]/10 font-medium' : ''
                  }`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <span>{option.label}</span>
                  {option.sublabel && <span className="text-gray-400 mr-2 text-xs">({option.sublabel})</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}