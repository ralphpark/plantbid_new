import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import FeaturesPage from "@/pages/features";
import HowToUsePage from "@/pages/how-to-use";
import AuthPage from "@/pages/auth-page";
import AIConsultationPage from "@/pages/ai-consultation";
import RecommendationWizard from "@/pages/recommendation-wizard";
import VendorDashboard from "@/pages/vendor-dashboard";
import PaymentTestPage from "@/pages/payment-test";
import PaymentProcessPage from "@/pages/payment-process";
import OrderHistoryPage from "@/pages/order-history";
import OrderDetailPage from "@/pages/order-detail";
import CustomerServicePage from "@/pages/customer-service";
import TermsOfServicePage from "@/pages/terms-of-service";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import ChatTest from "@/pages/chat-test";
import AdminDashboard from "@/pages/admin/dashboard";
import ChangePassword from "@/pages/change-password";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import PlantInfoPage from "@/pages/plant-info";
import VendorProfilePage from "@/pages/vendor-profile";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import PopularPlantsPage from "@/pages/popular-plants";
import PopularVendorsPage from "@/pages/popular-vendors";
import AvailableProductsPage from "@/pages/available-products";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute } from "./lib/admin-route";
import { AuthProvider } from "@/hooks/use-auth";
import { MapProvider } from "@/components/map/map-provider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/how-to-use" component={HowToUsePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/payment-test" component={PaymentTestPage} />
      <Route path="/customer-service" component={CustomerServicePage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/chat-test" component={ChatTest} />
      <Route path="/plants/:id" component={PlantInfoPage} />
      <Route path="/vendors/:id" component={VendorProfilePage} />
      <Route path="/products/:id" component={ProductDetailPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/popular-plants" component={PopularPlantsPage} />
      <Route path="/popular-vendors" component={PopularVendorsPage} />
      <Route path="/available-products" component={AvailableProductsPage} />
      <ProtectedRoute path="/payment-process" component={PaymentProcessPage} />
      <ProtectedRoute path="/ai-consultation" component={AIConsultationPage} />
      <ProtectedRoute path="/recommendation" component={RecommendationWizard} />
      <ProtectedRoute path="/vendor-dashboard" component={VendorDashboard} />
      <ProtectedRoute path="/order-history" component={OrderHistoryPage} />
      <ProtectedRoute path="/order-detail/:orderId" component={OrderDetailPage} />
      <ProtectedRoute path="/order-details/:orderId" component={OrderDetailPage} />
      <ProtectedRoute path="/change-password" component={ChangePassword} />
      <AdminRoute path="/admin" component={AdminDashboard} />
      <AdminRoute path="/admin/*" component={AdminDashboard} />
      <Route path="*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <MapProvider>
            <Toaster />
            <Router />
          </MapProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
