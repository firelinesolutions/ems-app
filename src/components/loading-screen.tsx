export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="brand-mark" aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
      <div className="text-center">
        <div className="loading-spinner mx-auto" role="status" aria-label="Loading" />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading EMS OpsQA…</p>
      </div>
    </div>
  );
}
