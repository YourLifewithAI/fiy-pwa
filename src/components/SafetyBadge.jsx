/**
 * Safety badge component — visually prominent, impossible to miss.
 *
 * Three tiers:
 *   SAFE             — green, proceed
 *   CAUTION          — amber, warnings
 *   PROFESSIONAL_ONLY — red, DO NOT show fix steps
 */

const LEVELS = {
  SAFE: {
    bg: 'bg-green-50',
    border: 'border-safe',
    text: 'text-green-800',
    icon: (
      <svg className="w-5 h-5 text-safe flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    label: 'Safe to DIY',
    description: 'This repair is appropriate for a careful DIYer.',
  },
  CAUTION: {
    bg: 'bg-amber-50',
    border: 'border-caution',
    text: 'text-amber-800',
    icon: (
      <svg className="w-5 h-5 text-caution flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    label: 'Proceed with caution',
    description: 'This repair carries some risk. Read all warnings before starting.',
  },
  PROFESSIONAL_ONLY: {
    bg: 'bg-red-50',
    border: 'border-danger',
    text: 'text-red-800',
    icon: (
      <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    label: 'Professional repair recommended',
    description: 'This repair requires specialized tools or training. Do not attempt at home.',
  },
};

export default function SafetyBadge({ level, warnings = [] }) {
  const config = LEVELS[level] || LEVELS.SAFE;

  return (
    <div
      className={`rounded-lg border-l-4 ${config.border} ${config.bg} p-4`}
      role="alert"
      aria-label={`Safety level: ${config.label}`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="min-w-0">
          <p className={`font-semibold ${config.text}`}>{config.label}</p>
          <p className={`text-sm mt-0.5 ${config.text} opacity-80`}>{config.description}</p>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className={`mt-3 space-y-1 text-sm ${config.text}`} role="list">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
