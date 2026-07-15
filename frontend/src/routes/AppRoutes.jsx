import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';

import LoginPage from '../pages/auth/Login';
import DashboardPage from '../pages/dashboard';
import CustomersPage from '../pages/customers';
import ProductsPage from '../pages/products';
import ProductionOrdersPage from '../pages/production-orders';
import PosPage from '../pages/pos';
import InventoryPage from '../pages/inventory';
import ProductionPage from '../pages/production';
import QcDeliveryPage from '../pages/qc-delivery';
import FinancePage from '../pages/finance';
import MarketingPage from '../pages/marketing';
import HrdPage from '../pages/hrd';
import UsersPage from '../pages/users';
import PricingPage from '../pages/pricing';
import SettingsPage from '../pages/settings';
import PromoPage from '../pages/promo';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/production-orders" element={<ProductionOrdersPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/qc-delivery" element={<QcDeliveryPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/hrd" element={<HrdPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/promo" element={<PromoPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
