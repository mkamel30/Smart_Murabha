export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses} border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin`}
      />
    </div>
  );
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Spinner size="lg" />
      {message && <p className="text-gray-500">{message}</p>}
    </div>
  );
}