import { createRoot } from "react-dom/client";
import App from "./App";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl } from "./lib/api-base";
import { registerServiceWorker } from "./lib/register-service-worker";
import "./index.css";

setBaseUrl(getApiBaseUrl());
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
