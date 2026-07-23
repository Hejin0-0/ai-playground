import { createRoot } from "react-dom/client";
import { App } from "./hud/App.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element is missing");

createRoot(root).render(<App companyId={__PAPERCLIP_COMPANY_ID__} />);
