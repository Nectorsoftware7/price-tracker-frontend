import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import { AuthProvider } from "./features/auth/AuthContext.jsx";
import "./index.css";

// One shared cache for the whole app — revisiting a page that already fetched its data
// shows that cached data instantly (no loading spinner) instead of re-fetching from
// scratch every time a route mounts, while still quietly refetching in the background
// to keep it current. staleTime is deliberately generous (2 min): this data only
// changes on an hourly cron or a manual "Check now"/"Check all" click, not constantly,
// so there's no need to treat every revisit as stale.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
