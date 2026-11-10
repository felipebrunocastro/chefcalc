import type { Restaurant } from '../types';

// Percentual de preenchimento do perfil (seções principais).
export function profileCompletion(r: Pick<Restaurant, 'name' | 'logo' | 'profile'>): number {
  const p = r.profile ?? {};
  const checks = [
    !!r.name?.trim(),
    !!r.logo,
    !!p.shortDescription?.trim(),
    !!p.establishmentType,
    (p.cuisines ?? []).length > 0,
    (p.serviceModes ?? []).length > 0 && !!p.serviceSegment,
    !!(p.address?.trim() && p.city?.trim()),
    !!p.hours && Object.keys(p.hours).length > 0,
    !!(p.businessPhone || p.businessEmail || p.whatsapp),
    !!(p.website || p.menuUrl || p.instagram || p.facebook || p.tiktok),
    !!(p.googleMapsUrl || p.googleReviewUrl),
    (p.delivery ?? []).some(d => d.active),
    !!(p.openDaysPerMonth && (p.avgTicket || Object.values(p.ticketByChannel ?? {}).some(Boolean))),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
