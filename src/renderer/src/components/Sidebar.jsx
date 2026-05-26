import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  BarChart2,
  CreditCard,
  Quote,
  Users,
  Building2,
  Layout,
  Settings,
  HelpCircle,
  Package,
  Mail,
  FileMinus
} from 'lucide-react'

// ── Nav structure (mirrors main_app.py _build_sidebar) ───────────────────────

const TOP_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' }
]

const SALES_ITEMS = [
  { icon: FileText,   label: 'Invoices',    to: '/invoices' },
  { icon: FileMinus,  label: 'Credit Note', to: '/credit-notes' },
  { icon: Quote,      label: 'Quotation',   to: '/quotations' },
  { icon: BarChart2,  label: 'Statement',   to: '/statement' },
  { icon: CreditCard, label: 'Receipts',    to: '/receipts' }
]

const MASTER_ITEMS = [
  { icon: Users,     label: 'Customers',  to: '/customers' },
  { icon: Package,   label: 'Products',   to: '/products' },
  { icon: Building2, label: 'Company',    to: '/company' },
  { icon: Layout,    label: 'PDF Layout', to: '/pdf-layout' }
]

const BOTTOM_ITEMS = [
  { icon: Mail,       label: 'Email Settings', to: '/email-settings' },
  { icon: Settings,   label: 'Settings', to: '/settings' },
  { icon: HelpCircle, label: 'Help',     to: null }
]

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, to }) {
  if (!to) {
    return (
      <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-accent-light hover:text-accent transition-colors">
        <Icon size={16} />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-accent-light text-accent font-medium'
            : 'text-ink-2 hover:bg-accent-light hover:text-accent'
        }`
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
      {children}
    </p>
  )
}

function Divider() {
  return <hr className="mx-3 my-2 border-border" />
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {

  return (
    <aside className="w-[200px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[22px]">
        <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-base">$</span>
        </div>
        <span className="font-bold text-ink text-[15px]">YS Unique Trading</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 overflow-y-auto">
        {TOP_ITEMS.map(item => (
          <NavItem key={item.to} {...item} />
        ))}

        <Divider />

        <SectionLabel>Sales</SectionLabel>
        {SALES_ITEMS.map(item => (
          <NavItem key={item.to} {...item} />
        ))}

        <Divider />

        <SectionLabel>Masters</SectionLabel>
        {MASTER_ITEMS.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>


      {/* Bottom: Settings + Help */}
      <div className="px-2 pb-4">
        <Divider />
        {BOTTOM_ITEMS.map(item => (
          <NavItem key={item.label} {...item} />
        ))}
      </div>

    </aside>
  )
}
