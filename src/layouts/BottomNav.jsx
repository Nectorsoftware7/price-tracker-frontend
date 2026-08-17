import { NavLink } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// Minimal stroke icons, inline — matches the rest of the app (no icon library
// dependency), and keeps each one a single small component instead of pulling in a
// whole icon set for five glyphs.
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function DashboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function ProductsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}
function PriceStockIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 12l-8 8-9-9V3h8l9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 21h18" />
      <path d="M4 17l5-6 4 3 7-9" />
    </svg>
  );
}
function ContactIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17.5" cy="8.5" r="2.6" />
      <path d="M15.5 14.3c2.9.4 5 2.6 5 5.7" />
    </svg>
  );
}

export default function BottomNav() {
  const { role } = useAuth();

  const items = [
    role === "superadmin" && { to: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    role !== "superadmin" && { to: "/", end: true, label: "Products", Icon: ProductsIcon },
    { to: "/price-stock", label: "Price & Stock", Icon: PriceStockIcon },
    { to: "/price-analytics", label: "Analytics", Icon: AnalyticsIcon },
    { to: "/reviews", label: "Contact", Icon: ContactIcon },
    role === "superadmin" && { to: "/users", label: "Users", Icon: UsersIcon },
  ].filter(Boolean);

  return (
    <nav className="bottom-nav">
      {items.map(({ to, end, label, Icon }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
