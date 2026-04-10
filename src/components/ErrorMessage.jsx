export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center" role="alert">
      <p className="text-red-700 font-medium mb-1">Something went wrong</p>
      <p className="text-red-600 text-sm mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
