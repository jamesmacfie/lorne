import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Gathering your next little thing…" }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle aria-hidden className="spin" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <p>{message}</p>
      <button type="button" className="button button--secondary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
