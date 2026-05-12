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

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <UnitsProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </UnitsProvider>
  </QueryClientProvider>,
);
