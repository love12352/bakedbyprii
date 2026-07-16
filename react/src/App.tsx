import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './routes/Home';
import Menu from './routes/Menu';
import Custom from './routes/Custom';
import Reviews from './routes/Reviews';
import Checkout from './routes/Checkout';
import OrderConfirmation from './routes/OrderConfirmation';
import Cancel from './routes/Cancel';
import Admin from './routes/Admin';
import Legal from './routes/Legal';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="custom" element={<Custom />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/:ref" element={<OrderConfirmation />} />
        <Route path="cancel" element={<Cancel />} />
        <Route path="admin" element={<Admin />} />
        <Route path="legal/:doc" element={<Legal />} />
        <Route path="*" element={<h2>Not found</h2>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
