export default function ConfidenceBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  let color = 'bg-teal-500';
  if (pct < 40) color = 'bg-amber-400';
  if (pct < 20) color = 'bg-red-400';

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-500 font-medium">{pct}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}
