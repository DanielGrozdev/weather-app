import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n/config";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UnitsProvider } from "./context/UnitsContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// React StrictMode is intentionally NOT used here. Leaflet (via react-leaflet
// and @maptiler/leaflet-maptilersdk) attaches imperatively to a DOM node and
// tags it with `_leaflet_id`. StrictMode's intentional double-mount in dev
// causes Leaflet to throw "Map container is being reused", with cascading
// `_leaflet_pos` / `appendChild` errors as the half-torn-down map is reused.
// This is a documented react-leaflet limitation. Production builds are
// unaffected because StrictMode does not double-mount in production.
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <UnitsProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </UnitsProvider>
  </QueryClientProvider>,
);
