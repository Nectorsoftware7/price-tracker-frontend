import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import HomeRedirect from "./routes/HomeRedirect.jsx";
import RequireSuperadmin from "./routes/RequireSuperadmin.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import Products from "./pages/Products.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Reviews from "./pages/Reviews.jsx";
import PriceStockVariation from "./pages/PriceStockVariation.jsx";
import PriceAnalytics from "./pages/PriceAnalytics.jsx";
import Users from "./pages/Users.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="products" element={<Products />} />
        <Route path="price-stock" element={<PriceStockVariation />} />
        <Route path="price-analytics" element={<PriceAnalytics />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="reviews" element={<Reviews />} />
        <Route
          path="dashboard"
          element={
            <RequireSuperadmin>
              <Dashboard />
            </RequireSuperadmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireSuperadmin>
              <Users />
            </RequireSuperadmin>
          }
        />
      </Route>
    </Routes>
  );
}
