type StatusBannerProps = {
  type: "success" | "error";
  message: string;
  onDismiss?: () => void;
};

export function StatusBanner({ type, message, onDismiss }: StatusBannerProps) {
  return (
    <div
      className={`status-banner ${type === "success" ? "status-banner-success" : "status-banner-error"}`}
      role="alert"
    >
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
