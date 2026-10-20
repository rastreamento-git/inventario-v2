import { initializeAppearance } from "./lib/appearance";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/theme.css";
import App from "./App.jsx";
import AuthGate from "./components/AuthGate";

import "./styles/appearance.css";
initializeAppearance();
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
