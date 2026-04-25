import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useGSIListener } from "./hooks/useGSIListener";

export default function App() {
  const location = useLocation();
  const isOverlayRoute = location.pathname === "/overlay";
  const gsi = useGSIListener({ autoStart: true });

  return (
    <div className="app-shell">
      {!isOverlayRoute ? (
        <Navbar
          serverStatus={gsi.serverStatus}
          onToggleOverlay={() => gsi.toggleOverlay()}
        />
      ) : null}

      <main className={isOverlayRoute ? "" : "page-shell"}>
        <Outlet context={gsi} />
      </main>
    </div>
  );
}
