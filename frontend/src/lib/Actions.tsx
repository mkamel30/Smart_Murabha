import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

interface ActionButtonProps extends ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
}

export function ActionButton({ 
  children, 
  onClick, 
  type = 'button', 
  disabled,
  variant = 'primary',
  size = 'sm',
  className = ''
}: ActionButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  const sizeStyles = size === 'sm' 
    ? 'px-3 py-1.5 text-xs' 
    : 'px-4 py-2 text-sm';
  
  const variantStyles = {
    primary: 'bg-[#0A2472] text-white hover:bg-[#0d2d6a] focus:ring-[#0A2472] border border-[#0A2472]',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400 border border-gray-300',
    danger: 'bg-white text-red-600 hover:bg-red-50 focus:ring-red-400 border border-red-300'
  };
  
  const disabledStyles = disabled 
    ? 'opacity-50 cursor-not-allowed pointer-events-none' 
    : '';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles} ${variantStyles[variant]} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, type, disabled, className, size }: ButtonProps) {
  return (
    <ActionButton 
      variant="primary" 
      onClick={onClick} 
      type={type} 
      disabled={disabled} 
      className={className}
      size={size}
    >
      {children}
    </ActionButton>
  );
}

export function SecondaryButton({ children, onClick, type, disabled, className, size }: ButtonProps) {
  return (
    <ActionButton 
      variant="secondary" 
      onClick={onClick} 
      type={type} 
      disabled={disabled} 
      className={className}
      size={size}
    >
      {children}
    </ActionButton>
  );
}

export function DangerButton({ children, onClick, type, disabled, className, size }: ButtonProps) {
  return (
    <ActionButton 
      variant="danger" 
      onClick={onClick} 
      type={type} 
      disabled={disabled} 
      className={className}
      size={size}
    >
      {children}
    </ActionButton>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
      {children}
    </div>
  );
}

export function PageHeader({ 
  title, 
  actions,
  children
}: { 
  title: string; 
  actions?: ReactNode;
  children?: ReactNode 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 className="text-xl font-bold text-[#0A2472]">{title}</h1>
      <div className="flex items-center gap-2">
        {children}
        {actions}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4.586a1 1 0 00-.707.293l-4.414 4.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-4.414-4.414A1 1 0 004.586 15H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

export function TableActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      {children}
    </div>
  );
}