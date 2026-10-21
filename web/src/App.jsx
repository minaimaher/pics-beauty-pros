import { useLocation, matchRoute, useT } from './lib.jsx';
import { Header, Footer, Toast, RequireRole, Empty } from './components.jsx';
import { Home, Search } from './pages/Discover.jsx';
import { VendorProfile, Checkout } from './pages/Vendor.jsx';
import { Login, Register, JoinVendor, CustomerBookings, BookingDetail, Messages } from './pages/Account.jsx';
import { VendorApply, VendorDashboard } from './pages/VendorDashboard.jsx';
import { Admin } from './pages/Admin.jsx';

const ROUTES = [
  ['/', () => <Home />],
  ['/search', () => <Search />],
  ['/vendors/:id', (p) => <VendorProfile id={p.id} />],
  ['/book/:vendorId/:packageId', (p) => <Checkout {...p} />],
  ['/login', () => <Login />],
  ['/register', () => <Register />],
  ['/join-vendor', () => <JoinVendor />],
  ['/bookings', () => <RequireRole role="customer"><CustomerBookings /></RequireRole>],
  ['/bookings/:id', (p) => <RequireRole role="customer"><BookingDetail id={p.id} /></RequireRole>],
  ['/messages', () => <RequireRole><Messages /></RequireRole>],
  ['/messages/:threadId', (p) => <RequireRole><Messages threadId={p.threadId} /></RequireRole>],
  ['/vendor/apply', () => <RequireRole role="vendor"><VendorApply /></RequireRole>],
  ['/vendor', () => <RequireRole role="vendor"><VendorDashboard /></RequireRole>],
  ['/vendor/:section', (p) => <RequireRole role="vendor"><VendorDashboard section={p.section} /></RequireRole>],
  ['/vendor/:section/:sub', (p) => <RequireRole role="vendor"><VendorDashboard section={p.section} sub={p.sub} /></RequireRole>],
  ['/admin', () => <RequireRole role="admin"><Admin /></RequireRole>],
  ['/admin/:section', (p) => <RequireRole role="admin"><Admin section={p.section} /></RequireRole>]
];

function NotFound() {
  const t = useT();
  return <div className="container section"><Empty>{t('Page not found.')}</Empty></div>;
}

export default function App() {
  const { path } = useLocation();
  let page = <NotFound />;
  for (const [pattern, render] of ROUTES) {
    const params = matchRoute(pattern, path);
    if (params) { page = render(params); break; }
  }
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <Header />
      <main id="main" key={path.split('/').slice(0, 3).join('/')}>{page}</main>
      <Footer />
      <Toast />
    </>
  );
}
