import { Outlet, useLocation } from "react-router-dom";
import { useScreenIntel } from "./hooks/useScreenIntel";

export default function App() {
  const location = useLocation();
  const isOverlayRoute = location.pathname === "/overlay";
  const intel = useScreenIntel();

  return (
    <div className={`app-shell ${isOverlayRoute ? "app-shell--overlay" : ""}`}>
      <main className={isOverlayRoute ? "overlay-shell" : "page-shell"}>
        <Outlet context={intel} />
      </main>
    </div>
  );
}
