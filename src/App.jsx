import { Outlet, useLocation } from "react-router-dom";
import { useGSIListener } from "./hooks/useGSIListener";

export default function App() {
  const location = useLocation();
  const isOverlayRoute = location.pathname === "/overlay";
  const gsi = useGSIListener({ autoStart: true });

  return (
    <div className={`app-shell ${isOverlayRoute ? "app-shell--overlay" : ""}`}>
      <main className={isOverlayRoute ? "overlay-shell" : "page-shell"}>
        <Outlet context={gsi} />
      </main>
    </div>
  );
}
