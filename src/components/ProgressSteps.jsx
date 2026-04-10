/**
 * Horizontal step indicator for the diagnosis flow.
 * Steps: Upload -> Identify -> Interview -> Result
 */

const STEPS = ['Upload', 'Identify', 'Interview', 'Result'];

const STEP_MAP = {
  upload: 0,
  identify: 1,
  'identify-manual': 1,
  interview: 2,
  result: 3,
  verify: 3,
};

export default function ProgressSteps({ phase }) {
  const current = STEP_MAP[phase] ?? 0;

  return (
    <nav aria-label="Diagnosis progress" className="mb-6">
      {/* Progress bar */}
      <div className="relative h-1 bg-gray-200 rounded-full mb-3">
        <div
          className="absolute h-1 bg-teal-600 rounded-full transition-all duration-300"
          style={{ width: `${((current + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step labels */}
      <ol className="flex justify-between text-xs">
        {STEPS.map((label, i) => {
          let className = 'text-gray-400';
          let prefix = '';
          if (i < current) {
            className = 'text-teal-600 font-medium';
            prefix = '\u2713 '; // checkmark
          } else if (i === current) {
            className = 'text-teal-700 font-semibold';
          }
          return (
            <li key={label} className={className}>
              {prefix}{label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
