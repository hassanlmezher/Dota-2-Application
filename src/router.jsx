import { createHashRouter } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import MatchOverlay from "./pages/MatchOverlay";
import Settings from "./pages/Settings";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "overlay",
        element: <MatchOverlay />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);

export default router;
