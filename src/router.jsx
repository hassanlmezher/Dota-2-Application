import { createHashRouter } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import ItemAssistant from "./pages/ItemAssistant";
import MatchOverlay from "./pages/MatchOverlay";
import PickAssistant from "./pages/PickAssistant";
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
        path: "pick-assistant",
        element: <PickAssistant />,
      },
      {
        path: "item-assistant",
        element: <ItemAssistant />,
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
