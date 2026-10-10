import { createRoot } from "react-dom/client";
import "../design-system/tokens.css";
import "../design-system/base.css";
import "../design-system/components.css";
import "./site.css";
import App from "./App";

// No <StrictMode>: its double mount of the lazily loaded <Canvas> makes React Three Fiber
// 9.8 lose its container size (see the note in scene/Scene.tsx).
createRoot(document.getElementById("root")!).render(<App />);
