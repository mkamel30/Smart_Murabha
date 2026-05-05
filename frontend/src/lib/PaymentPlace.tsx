import { ar } from '../i18n/ar';

interface PaymentPlaceSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const paymentOptions = [
  { value: 'dhamen', labelKey: 'dhamen' as const, icon: '👤' },
  { value: 'post', labelKey: 'post' as const, icon: '📬' },
  { value: 'bank', labelKey: 'bank' as const, icon: '🏦' },
];

export function PaymentPlaceSelect({ value, onChange }: PaymentPlaceSelectProps) {
  return (
    <div className="flex gap-2">
      {paymentOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-all
            ${value === option.value 
              ? 'bg-[#0A2472] text-white border-[#0A2472]' 
              : 'bg-white text-gray-600 border-gray-200 hover:border-[#0A2472] hover:text-[#0A2472]'
            }
          `}
        >
          <span>{option.icon}</span>
          <span>{ar.payments[option.labelKey]}</span>
        </button>
      ))}
    </div>
  );
}