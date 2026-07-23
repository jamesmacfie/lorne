import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { BarChart3, BookOpenText, LogOut, MessageCircleQuestion, Settings, Shapes } from "lucide-react";
import { authClient } from "#/features/auth/auth-client";
import { clearPrivateOfflineData, syncReviewOutbox } from "#/pwa/review-outbox";

export type Viewer = { id: string; name: string; email: string; image: string | null; onboardingRequired: boolean };

export function AppShell({ viewer, children, updateReady }: { viewer: Viewer; children: React.ReactNode; updateReady: boolean }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const activeUserKey = "lorne-active-user";
    const previousUserId = window.localStorage.getItem(activeUserKey);
    if (previousUserId && previousUserId !== viewer.id) void clearPrivateOfflineData();
    window.localStorage.setItem(activeUserKey, viewer.id);
    setOnline(navigator.onLine);
    const sync = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncReviewOutbox(viewer.id);
    };
    const visible = () => {
      if (document.visibilityState === "visible") void syncReviewOutbox(viewer.id);
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", visible);
    navigator.serviceWorker?.addEventListener("message", visible);
    void syncReviewOutbox(viewer.id);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", visible);
      navigator.serviceWorker?.removeEventListener("message", visible);
    };
  }, [viewer.id]);

  const signOut = async () => {
    await clearPrivateOfflineData();
    window.localStorage.removeItem("lorne-active-user");
    await authClient.signOut();
    await router.invalidate();
  };

  return (
    <div className="app-frame">
      <aside className="app-rail">
        <Link to="/" className="brand" aria-label="Lorne study">
          <span className="brand-mark">L</span>
          <span>Lorne</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }}>
            <BookOpenText aria-hidden />
            <span>Study</span>
          </Link>
          <Link to="/topics" activeProps={{ "aria-current": "page" }}>
            <Shapes aria-hidden />
            <span>Topics</span>
          </Link>
          <Link to="/progress" activeProps={{ "aria-current": "page" }}>
            <BarChart3 aria-hidden />
            <span>Progress</span>
          </Link>
          <Link to="/chats" activeProps={{ "aria-current": "page" }}>
            <MessageCircleQuestion aria-hidden />
            <span>Chats</span>
          </Link>
          <Link to="/settings" activeProps={{ "aria-current": "page" }}>
            <Settings aria-hidden />
            <span>Settings</span>
          </Link>
        </nav>
        <div className="rail-footer">
          <span className={`connection ${online ? "" : "connection--offline"}`}>{online ? "Online" : "Offline"}</span>
          <button type="button" className="icon-button" onClick={signOut} aria-label={`Sign out ${viewer.name}`} title="Sign out">
            <LogOut aria-hidden />
          </button>
        </div>
      </aside>
      <div className="app-stage">
        {!online && <div className="offline-banner">Offline — ratings are safe on this device and will sync later.</div>}
        {updateReady && (
          <button type="button" className="update-banner" onClick={() => window.location.reload()}>
            A fresh Lorne is ready. Reload
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
