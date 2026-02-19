import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply saved theme before first render ONLY as a cache hint.
// If user is authenticated the DB value will override this in useTheme.
const savedTheme = localStorage.getItem('app-theme');
if (savedTheme && savedTheme !== 'slate') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

createRoot(document.getElementById("root")!).render(<App />);
