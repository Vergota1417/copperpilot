import { createRoot } from "react-dom/client";
import Workbench from "../components/workbench";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("CopperPilot could not find its application root.");
createRoot(root).render(
  <Workbench assetBase={import.meta.env.BASE_URL} aiEndpoint={null} />,
);
