import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useEmailSync } from "@/hooks/useEmailSync";
import { useEmailSoundNotification } from "@/hooks/useEmailSoundNotification";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Configure QueryClient with optimized caching for Keep-Alive tabs
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes - no refetch on tab switch
      staleTime: 5 * 60 * 1000,
      // Keep cached data for 30 minutes even if unused
      gcTime: 30 * 60 * 1000,
      // Don't refetch on window focus (prevents loading on tab switch)
      refetchOnWindowFocus: false,
      // Don't refetch when reconnecting
      refetchOnReconnect: false,
      // Retry failed requests once
      retry: 1,
    },
  },
});

function EmailSyncInit() {
  useEmailSync();
  useEmailSoundNotification();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <EmailSyncInit />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* All protected routes use the same MainLayout with Keep-Alive tabs */}
            <Route path="/" element={<ProtectedRoute />} />
            <Route path="/clients" element={<ProtectedRoute />} />
            <Route path="/sales" element={<ProtectedRoute />} />
            <Route path="/sales-history" element={<ProtectedRoute />} />
            <Route path="/catalog" element={<ProtectedRoute />} />
            <Route path="/policies" element={<ProtectedRoute />} />
            <Route path="/finances" element={<ProtectedRoute />} />
            <Route path="/notifications" element={<ProtectedRoute />} />
            <Route path="/settings" element={<ProtectedRoute />} />
            <Route path="/messenger-settings" element={<ProtectedRoute />} />
            <Route path="/reports" element={<ProtectedRoute />} />
            <Route path="/shift-reports" element={<ProtectedRoute />} />
            <Route path="/prolongation-report" element={<ProtectedRoute />} />
            <Route path="/communication" element={<ProtectedRoute />} />
            <Route path="/europrotocol" element={<ProtectedRoute />} />
            <Route path="/analytics" element={<ProtectedRoute />} />
            <Route path="/team" element={<ProtectedRoute />} />
            <Route path="/event-log" element={<ProtectedRoute />} />
            <Route path="/settings/permissions" element={<ProtectedRoute />} />
            <Route path="/access-logs" element={<ProtectedRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
