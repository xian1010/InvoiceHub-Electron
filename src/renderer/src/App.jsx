import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard      from './pages/Dashboard'
import Invoices       from './pages/Invoices'
import InvoiceEditor  from './pages/InvoiceEditor'
import Quotations     from './pages/Quotations'
import QuotationEditor from './pages/QuotationEditor'
import Statement      from './pages/Statement'
import Receipts       from './pages/Receipts'
import Customers      from './pages/Customers'
import CompanyProfile from './pages/CompanyProfile'
import PdfLayout      from './pages/PdfLayout'
import Settings       from './pages/Settings'
import Products       from './pages/Products'
import EmailSettings  from './pages/EmailSettings'
import UpdateModal    from './components/UpdateModal'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-bg font-sans overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"                     element={<Navigate to="/invoices" replace />} />
            <Route path="/invoices"             element={<Invoices />} />
            <Route path="/invoices/new"         element={<InvoiceEditor />} />
            <Route path="/invoices/:id"         element={<InvoiceEditor />} />
            <Route path="/quotations"           element={<Quotations />} />
            <Route path="/quotations/new"       element={<QuotationEditor />} />
            <Route path="/quotations/:id"       element={<QuotationEditor />} />
            <Route path="/statement"            element={<Statement />} />
            <Route path="/receipts"             element={<Receipts />} />
            <Route path="/customers"            element={<Customers />} />
            <Route path="/products"             element={<Products />} />
            <Route path="/company"              element={<CompanyProfile />} />
            <Route path="/pdf-layout"           element={<PdfLayout />} />
            <Route path="/settings"             element={<Settings />} />
            <Route path="/email-settings"       element={<EmailSettings />} />
            <Route path="*"                     element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <UpdateModal />
      </div>
    </HashRouter>
  )
}
