import type { Restaurant } from '../../types';

// Logo com proporção preservada; sem logo, mostra as iniciais do nome.
export function RestaurantLogo({ restaurant, size = 48, className = '' }: { restaurant: Pick<Restaurant, 'name' | 'logo'>; size?: number; className?: string }) {
  if (restaurant.logo) {
    return (
      <span className={`inline-flex items-center justify-center bg-white rounded-xl border border-blue-100 overflow-hidden shrink-0 p-1 ${className}`} style={{ width: size, height: size }}>
        <img src={restaurant.logo} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
      </span>
    );
  }
  const initials = restaurant.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-xl bg-blue-600 text-white font-bold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}
