// Logo do ChefCalc em SVG: chapéu de chef, "Chef" + "Calc" e calculadora.
// O detalhe (antes laranja) agora é azul-claro.
interface Props { tone?: 'light' | 'dark'; height?: number; className?: string; showIcon?: boolean }

export const LOGO_ACCENT = '#38bdf8';

export function Logo({ tone = 'dark', height = 32, className = '', showIcon = true }: Props) {
  const ink = tone === 'light' ? '#ffffff' : '#0b1f4b';
  // Texto com largura fixa (textLength) para não depender da fonte do aparelho:
  // sem isso, fontes mais largas cortavam o último "c" de "ChefCalc".
  const w = showIcon ? 178 : 146;
  return (
    <svg viewBox={`0 0 ${w} 40`} height={height} width={(height * w) / 40} className={className} role="img" aria-label="ChefCalc">
      {/* chapéu */}
      <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M9 24c-4 0-6.5-3-6.5-6.4S5.4 11 9 11.3C10 7 13.8 4.4 18 4.8c2-1.9 5-1.9 7 0 4.2-.4 8 2.2 9 6.5 3.6-.3 6.5 2.6 6.5 6.3S38 24 34 24" />
        <path d="M10 24h24v8.5a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 10 32.5z" />
        <path d="M15 28.5h14" />
      </g>
      <text x="46" y="29" fontFamily="Inter, system-ui, -apple-system, sans-serif" fontSize="22" fontWeight="800" textLength="96" lengthAdjust="spacingAndGlyphs">
        <tspan fill={ink}>Chef</tspan><tspan fill={LOGO_ACCENT}>Calc</tspan>
      </text>
      {showIcon && (
        <g transform="translate(148 7)" fill="none" stroke={LOGO_ACCENT} strokeWidth="2.4">
          <rect x="1.2" y="1.2" width="24" height="27" rx="4" />
          <rect x="5.5" y="5.5" width="15.5" height="5" rx="1" fill={LOGO_ACCENT} stroke="none" />
          {[0, 1, 2].map(c => [0, 1].map(r => <rect key={`${c}${r}`} x={5.5 + c * 5.6} y={14 + r * 6} width="3.8" height="3.8" rx=".8" fill={LOGO_ACCENT} stroke="none" />))}
        </g>
      )}
    </svg>
  );
}
