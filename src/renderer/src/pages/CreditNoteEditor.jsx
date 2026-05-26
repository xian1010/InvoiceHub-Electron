import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, Plus, Trash2, FileText, FolderOpen, X, ChevronDown, GripVertical, BookOpen } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

function Field({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold tracking-widest text-ink-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

let _idCounter = 0
const genId = () => `item-${Date.now()}-${++_idCounter}`
const EMPTY_ITEM = () => ({ id: genId(), description: '', po_no: '', qty: '', uom: 'PCS', uprice: '', subtotal: '' })
const TERMS_OPTS = ['7 days', '14 days', '30 days', '60 days', 'C.O.D', 'Upon Receipt']
const STATUS_OPTS = ['Pending', 'Issued', 'Void', 'Draft']
const UOM_OPTS = ['PCS', 'SETS', 'BOOKS', 'UNIT', 'LOT', 'BOX', 'PKT', 'KG', 'ROLL', 'LTR', 'MTR']

// ── Theme colors (deep red for Credit Notes) ──────────────────────────────────
const CN_BTN    = 'bg-red-700 hover:bg-red-800'
const CN_RING   = 'focus:ring-red-700/30 focus:border-red-700'
const CN_ACCENT = 'text-red-700'

// ── Description templates (Credit Note specific) ──────────────────────────────
const DESCRIPTION_TEMPLATES = [
  'Being credit for return of goods as per [INV_NO]',
  'Being price adjustment (Overcharged) as per [INV_NO]',
  'Special allowance for damaged items as per [INV_NO]',
  'Special discount / rebate as per [INV_NO]',
]

// ── Sortable Row ──────────────────────────────────────────────────────────────

function SortableRow({ item, idx, items, productList, focusedRow, setFocusedRow, autoFocusRow, setAutoFocusRow, updateItem, removeItem, setItems, linkedInvoice }) {
  const [showTemplates, setShowTemplates] = useState(false)
  const templateRef = useRef(null)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id })

  // Close template dropdown on outside click
  useEffect(() => {
    if (!showTemplates) return
    const handler = (e) => {
      if (templateRef.current && !templateRef.current.contains(e.target)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

  const applyTemplate = (tpl) => {
    const invNo = linkedInvoice || '[INV_NO]'
    const text = tpl.replace('[INV_NO]', invNo)
    updateItem(idx, 'description', text)
    setShowTemplates(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)' : undefined,
    borderRadius: isDragging ? '12px' : undefined,
    background: isDragging ? '#fff5f5' : undefined
  }

  const matches = productList.filter(p => !item.description || p.description.toLowerCase().includes(item.description.toLowerCase()))
  const showDropdown = focusedRow === idx && matches.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[28px_1fr_120px_80px_70px_110px_110px_36px] items-start px-4 py-2 border-b border-border/60 last:border-b-0 gap-x-2"
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="flex items-center justify-center w-7 h-8 rounded-md cursor-grab active:cursor-grabbing text-ink-muted/50 hover:text-red-700 hover:bg-red-50 transition-colors mt-0.5"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        title="Drag to reorder"
      >
        <GripVertical size={15} />
      </button>

      <div className="relative w-full">
        <div className="flex items-start gap-1">
          <textarea
            autoFocus={autoFocusRow === idx}
            className="text-sm text-ink bg-transparent focus:outline-none focus:ring-1 focus:ring-red-700/30 focus:bg-white px-2 py-1.5 rounded-md w-full resize-none overflow-hidden leading-relaxed"
            placeholder="Description"
            rows={1}
            value={item.description}
            onChange={(e) => updateItem(idx, 'description', e.target.value)}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onFocus={(e) => {
              setFocusedRow(idx)
              setAutoFocusRow(null)
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onBlur={() => setTimeout(() => setFocusedRow(null), 200)}
          />
          {/* Template quick-pick button */}
          <div className="relative shrink-0 mt-1" ref={templateRef}>
            <button
              type="button"
              title="Insert template"
              onClick={() => setShowTemplates(v => !v)}
              className={`p-1 rounded-md transition-colors ${
                showTemplates
                  ? 'bg-red-100 text-red-700'
                  : 'text-ink-muted/40 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              <BookOpen size={13} />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full z-50 w-[360px] mt-1 bg-white border border-border shadow-xl rounded-xl overflow-hidden py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-widest border-b border-border/60">Quick Templates</div>
                {DESCRIPTION_TEMPLATES.map((tpl, i) => {
                  const preview = linkedInvoice ? tpl.replace('[INV_NO]', linkedInvoice) : tpl
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full text-left px-3 py-2.5 text-[13px] text-ink hover:bg-red-50 hover:text-red-700 transition-colors leading-snug"
                    >
                      {preview}
                    </button>
                  )
                })}
                {!linkedInvoice && (
                  <div className="px-3 py-1.5 text-[10px] text-amber-600 bg-amber-50/50 border-t border-border/40">
                    💡 Select a Linked Invoice to auto-replace [INV_NO]
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {showDropdown && (
          <div className="absolute top-full left-0 z-50 w-[400px] mt-1 bg-white border border-border shadow-xl rounded-xl max-h-64 overflow-auto py-1">
            {matches.map(p => (
              <div
                key={p.id}
                className="px-4 py-2.5 hover:bg-red-50 cursor-pointer flex flex-col gap-0.5"
                onClick={() => {
                  setItems(prev => {
                    const next = [...prev]
                    const curr = { ...next[idx], description: p.description }
                    if (p.uom) curr.uom = p.uom
                    if (p.default_qty !== null && p.default_qty !== undefined && p.default_qty !== '') {
                      curr.qty = p.default_qty.toString()
                    } else if (!curr.qty) {
                      curr.qty = '1'
                    }
                    if (p.unit_price !== null && p.unit_price !== undefined) {
                      let upStr = p.unit_price.toString()
                      curr.uprice = (upStr === '0' || upStr === '0.00' || upStr === '') ? '-' : upStr
                    }
                    if (p.default_total !== null && p.default_total !== undefined && p.default_total !== '') {
                      curr.subtotal = p.default_total.toString()
                    } else if (curr.uprice && curr.uprice !== '-') {
                      const q = parseFloat(curr.qty) || 1
                      const pr = parseFloat(curr.uprice) || 0
                      curr.subtotal = (q * pr).toFixed(2)
                    }
                    next[idx] = curr
                    return next
                  })
                  setFocusedRow(null)
                }}
              >
                <div className="text-[13px] font-semibold text-ink">{p.description}</div>
                <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2">
                  {p.item_code && <span>{p.item_code} • </span>}
                  <span>{p.uom || '-'}</span>
                  <span className="font-semibold text-red-700 ml-auto">
                    {p.unit_price === '-'
                      ? 'LUMP SUM'
                      : `RM ${Number(p.unit_price || 0).toFixed(2)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        className="text-sm text-ink bg-transparent focus:outline-none focus:ring-1 focus:ring-red-700/30 focus:bg-white px-2 py-1.5 rounded-md"
        placeholder="—"
        value={item.po_no}
        onChange={(e) => updateItem(idx, 'po_no', e.target.value)}
      />
      <input
        type="number"
        min="0"
        className="text-sm text-ink bg-transparent focus:outline-none focus:ring-1 focus:ring-red-700/30 focus:bg-white px-2 py-1.5 rounded-md"
        placeholder="0"
        value={item.qty}
        onChange={(e) => updateItem(idx, 'qty', e.target.value)}
      />
      <div className="relative">
        <input
          className="peer w-full text-[13px] text-ink font-bold bg-[#f5f5f7] hover:bg-[#ebebef] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700/30 rounded-md px-2 py-1.5 text-center uppercase pr-5 transition-all border-0"
          placeholder="PCS"
          value={item.uom}
          onChange={(e) => updateItem(idx, 'uom', e.target.value)}
        />
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none transition-transform peer-focus:rotate-180" />

        <div className="absolute top-full left-1/2 -translate-x-1/2 w-28 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden hidden peer-focus:block">
          <div className="max-h-48 overflow-y-auto py-1">
            {UOM_OPTS.map(u => (
              <div
                key={u}
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateItem(idx, 'uom', u);
                  document.activeElement?.blur();
                }}
                className="px-3 py-2 text-[12px] font-bold text-ink hover:bg-red-50 hover:text-red-700 cursor-pointer transition-colors text-center"
              >
                {u}
              </div>
            ))}
          </div>
        </div>
      </div>
      <input
        type="text"
        className="text-sm text-ink bg-transparent focus:outline-none focus:ring-1 focus:ring-red-700/30 focus:bg-white px-2 py-1.5 rounded-md"
        placeholder="-"
        value={item.uprice}
        onChange={(e) => updateItem(idx, 'uprice', e.target.value)}
      />
      <input
        type="number"
        step="any"
        className="text-sm font-medium text-ink bg-transparent focus:outline-none focus:ring-1 focus:ring-red-700/30 focus:bg-white px-2 py-1.5 rounded-md tabular-nums text-right"
        placeholder="0.00"
        value={item.subtotal || ''}
        onChange={(e) => updateItem(idx, 'subtotal', e.target.value)}
      />
      <button
        onClick={() => removeItem(idx)}
        disabled={items.length === 1}
        className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Line Items Table (with DnD) ───────────────────────────────────────────────

function LineItemsTable({ items, setItems, activeId, setActiveId, productList, focusedRow, setFocusedRow, autoFocusRow, setAutoFocusRow, updateItem, addItem, removeItem, linkedInvoice }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    setActiveId(null)
    const { active, over } = event
    if (active.id !== over?.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.id === active.id)
        const newIndex = prev.findIndex(i => i.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-ink">Line Items</h2>
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Plus size={13} />
          Add Item
        </button>
      </div>

      {/* Items table */}
      <div className="border border-border rounded-xl">
        {/* Header */}
        <div className="grid grid-cols-[28px_1fr_120px_80px_70px_110px_110px_36px] bg-gray-50 px-4 py-2.5 border-b border-border">
          {['', 'DESCRIPTION', 'PO NO', 'QTY', 'UOM', 'UNIT PRICE', 'SUBTOTAL', ''].map((h, i) => (
            <div key={`${h}-${i}`} className="text-[10px] font-bold tracking-widest text-ink-muted">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, idx) => (
              <SortableRow
                key={item.id}
                item={item}
                idx={idx}
                items={items}
                productList={productList}
                focusedRow={focusedRow}
                setFocusedRow={setFocusedRow}
                autoFocusRow={autoFocusRow}
                setAutoFocusRow={setAutoFocusRow}
                updateItem={updateItem}
                removeItem={removeItem}
                setItems={setItems}
                linkedInvoice={linkedInvoice}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CreditNoteEditor() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isNew    = !id || id === 'new'

  // ── State ──────────────────────────────────────────────────────────────────

  const [loading,     setLoading]     = useState(!isNew)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState({ show: false, message: '', folderPath: '' })
  const [productList, setProductList] = useState([])
  const [focusedRow,  setFocusedRow]  = useState(null)
  const [autoFocusRow, setAutoFocusRow] = useState(null)
  const [invoiceList, setInvoiceList] = useState([])

  const [header, setHeader] = useState({
    cn_no:           '',
    customer:        '',
    date:            today(),
    address:         '',
    attn:            '',
    tel:             '',
    acc_code:        '',
    terms:           '30 days',
    ref1:            '',
    ref2:            '',
    linked_invoice:  '',
    status:          'Pending'
  })

  const [items, setItems] = useState([EMPTY_ITEM()])
  const [activeId, setActiveId] = useState(null)
  const [customerList, setCustomerList] = useState([])

  // ── Load existing credit note ──────────────────────────────────────────────

  const normalizeUprice = (val) => {
    if (val === '-') return '-'
    const n = Number(val)
    if (!val && val !== 0) return '-'
    if (n === 0) return '-'
    return String(val)
  }

  const load = useCallback(async () => {
    if (isNew) {
      const nextNo = await window.api.creditNotes.nextNo()
      setHeader(h => ({ ...h, cn_no: nextNo }))
      return
    }
    setLoading(true)
    try {
      const data = await window.api.creditNotes.get(id)
      if (data) {
        const { items: its, ...hdr } = data
        setHeader(hdr)
        setItems(its.length
          ? its.map(item => ({ ...item, id: item.id || genId(), uprice: normalizeUprice(item.uprice) }))
          : [EMPTY_ITEM()])
      }
    } catch (err) {
      console.error('[CreditNoteEditor] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => { load() }, [load])

  // ── Load customer list + invoice list + product list ────────────────────────
  useEffect(() => {
    window.api.customers.list()
      .then(list => setCustomerList(list || []))
      .catch(() => {})

    window.api.products.list()
      .then(list => setProductList(list || []))
      .catch(() => {})

    // Load invoice list for the Linked Invoice dropdown
    window.api.invoices.list()
      .then(list => setInvoiceList(list || []))
      .catch(() => {})
  }, [])

  // ── Auto-fill when customer name matches a known customer ─────────────────
  const handleCustomerChange = (e) => {
    const name = e.target.value
    setHeader(h => ({ ...h, customer: name }))
    const match = customerList.find(c => c.name === name)
    if (match) {
      setHeader(h => ({
        ...h,
        customer: match.name,
        acc_code: match.acc_code || h.acc_code,
        address:  match.address  || h.address,
        tel:      match.tel      || h.tel,
        attn:     match.attn     || h.attn
      }))
    }
  }

  // ── Auto-fill from Linked Invoice ──────────────────────────────────────────
  const handleLinkedInvoiceChange = async (e) => {
    const invNo = e.target.value
    setHeader(h => ({ ...h, linked_invoice: invNo }))

    // If cleared, keep current fields as-is
    if (!invNo) return

    try {
      const invData = await window.api.invoices.get(invNo)
      if (!invData) return

      setHeader(h => ({
        ...h,
        customer: invData.customer || h.customer,
        address:  invData.address  || h.address,
        attn:     invData.attn     || h.attn,
        tel:      invData.tel      || h.tel,
        acc_code: invData.acc_code || h.acc_code
      }))
    } catch (err) {
      console.error('[CreditNoteEditor] Failed to fetch linked invoice:', err)
    }
  }

  // ── Item helpers ───────────────────────────────────────────────────────────

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }

      if (field === 'qty' || field === 'uprice') {
        if (next[idx].uprice !== '-') {
          const q = parseFloat(field === 'qty' ? value : next[idx].qty) || 0
          const p = parseFloat(field === 'uprice' ? value : next[idx].uprice) || 0
          next[idx].subtotal = (q * p).toFixed(2)
        }
      }

      return next
    })
  }

  const addItem = () => {
    setItems(prev => {
      const newIdx = prev.length
      setAutoFocusRow(newIdx)
      return [...prev, EMPTY_ITEM()]
    })
  }

  const removeItem = (idx) => setItems(p => p.filter((_, i) => i !== idx))

  const total = items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0)

  // ── Save (core, no navigation) ─────────────────────────────────────────────

  const performSave = async () => {
    if (!header.cn_no) throw new Error('CN No is required.')
    const hdr = { ...header, total }
    await window.api.creditNotes.save(hdr, items)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await performSave()
      navigate('/credit-notes')
    } catch (err) {
      console.error('[CreditNoteEditor] save error:', err)
      setToast({ show: true, message: err.message || 'Error saving credit note' })
    } finally {
      setSaving(false)
    }
  }

  // ── Export PDF (auto-saves first) ──────────────────────────────────────────

  const handleExportPdf = async () => {
    if (saving) return
    setSaving(true)
    try {
      await performSave()

      const payload = {
        cn_no: header.cn_no,
        date: header.date,
        billing: header.customer,
        billing_address: header.address,
        acc_code: header.acc_code,
        attn: header.attn,
        tel: header.tel,
        terms: header.terms,
        ref1: header.ref1,
        ref2: header.ref2,
        linked_invoice: header.linked_invoice,
        grand_total: total,
        items: items.map(idx => ({
          desc: (idx.description || '').replace(/\n/g, '<br/>'),
          po_no: idx.po_no,
          qty: idx.qty,
          uom: idx.uom,
          price: idx.uprice,
          total: idx.subtotal
        }))
      }

      const result = await window.api.creditNotes.exportPdf(payload)
      if (result.ok) {
        const folder = result.path ? result.path.replace(/[\\/][^\\/]+$/, '') : ''
        setToast({ show: true, message: 'Credit Note PDF exported!', folderPath: folder })
        setTimeout(() => setToast(t => ({ ...t, show: false })), 6000)
      }
    } catch (err) {
      console.error('[CreditNoteEditor] Export PDF error:', err)
      setToast({ show: true, message: err.message || 'Export PDF failed' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm">
        Loading…
      </div>
    )
  }

  return (
    <>
    <div className="h-full flex flex-col bg-bg">

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/credit-notes')}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="text-border">|</span>
          <h1 className="text-base font-bold text-ink">
            {isNew ? 'New Credit Note' : `Edit — ${header.cn_no}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={header.status}
            onChange={(e) => setHeader(h => ({ ...h, status: e.target.value }))}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-ink-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-700/20"
          >
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={handleExportPdf}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Eye size={14} />
            Export PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white ${CN_BTN} rounded-lg transition-colors disabled:opacity-50`}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Form body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">

          {/* Header Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 mb-8">

            {/* Bill To Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
              <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-4">Bill To</h3>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <input
                      placeholder="Type to search customers…"
                      list="cn-customer-datalist"
                      value={header.customer}
                      onChange={handleCustomerChange}
                      className={`w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink focus:ring-2 focus:ring-red-700 transition-shadow placeholder:font-medium placeholder:text-ink-muted`}
                    />
                    <datalist id="cn-customer-datalist">
                      {customerList.map(c => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.acc_code} — {c.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
                <div>
                  <textarea
                    placeholder="Billing Address"
                    value={header.address}
                    onChange={(e) => setHeader(h => ({ ...h, address: e.target.value }))}
                    className="w-full p-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] leading-relaxed text-ink focus:ring-2 focus:ring-red-700 transition-shadow min-h-[90px] resize-none placeholder:text-ink-muted"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      placeholder="Attention (Attn)"
                      value={header.attn}
                      onChange={(e) => setHeader(h => ({ ...h, attn: e.target.value }))}
                      className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] text-ink focus:ring-2 focus:ring-red-700 transition-shadow placeholder:text-ink-muted"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      placeholder="Telephone"
                      value={header.tel}
                      onChange={(e) => setHeader(h => ({ ...h, tel: e.target.value }))}
                      className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] text-ink focus:ring-2 focus:ring-red-700 transition-shadow placeholder:text-ink-muted"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Document Properties Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
              <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-4">Document</h3>

              <div className="space-y-3">
                {[
                  { label: 'CN NO:', field: 'cn_no' },
                  { label: 'DATE:', field: 'date', type: 'date' },
                  { label: 'TERMS:', field: 'terms', isSelect: true, opts: TERMS_OPTS },
                  { label: 'REF 1:', field: 'ref1' },
                  { label: 'REF 2:', field: 'ref2' },
                ].map((prop) => (
                  <div key={prop.field} className="flex grid grid-cols-[80px_1fr] items-center gap-4">
                    <span className="text-[12px] font-bold text-ink-muted text-right tracking-wide">{prop.label}</span>
                    {prop.isSelect ? (
                      <select
                        value={header[prop.field]}
                        onChange={(e) => setHeader(h => ({ ...h, [prop.field]: e.target.value }))}
                        className="h-9 px-3 bg-[#f5f5f7] rounded-lg border-0 text-[13px] font-medium text-ink focus:ring-2 focus:ring-red-700 transition-shadow w-full appearance-none"
                      >
                        {prop.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={prop.type || 'text'}
                        value={header[prop.field]}
                        onChange={(e) => setHeader(h => ({ ...h, [prop.field]: e.target.value }))}
                        className="h-9 px-3 bg-[#f5f5f7] rounded-lg border-0 text-[13px] font-medium text-ink focus:ring-2 focus:ring-red-700 transition-shadow w-full"
                      />
                    )}
                  </div>
                ))}

                {/* Linked Invoice dropdown */}
                <div className="flex grid grid-cols-[80px_1fr] items-center gap-4">
                  <span className="text-[12px] font-bold text-red-700 text-right tracking-wide">LINK INV:</span>
                  <select
                    value={header.linked_invoice}
                    onChange={handleLinkedInvoiceChange}
                    className="h-9 px-3 bg-red-50 rounded-lg border border-red-200 text-[13px] font-medium text-ink focus:ring-2 focus:ring-red-700 transition-shadow w-full appearance-none"
                  >
                    <option value="">— None —</option>
                    {invoiceList.map(inv => (
                      <option key={inv.invoice_no} value={inv.invoice_no}>
                        {inv.invoice_no} — {inv.customer || 'No Customer'} — RM {Number(inv.total || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Line items card */}
          <LineItemsTable
            items={items}
            setItems={setItems}
            activeId={activeId}
            setActiveId={setActiveId}
            productList={productList}
            focusedRow={focusedRow}
            setFocusedRow={setFocusedRow}
            autoFocusRow={autoFocusRow}
            setAutoFocusRow={setAutoFocusRow}
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
            linkedInvoice={header.linked_invoice}
          />

          {/* Total */}
          <div className="flex justify-end mt-4 pt-4">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-ink-muted font-medium">Total</span>
              <span className="text-xl font-bold text-red-700 tabular-nums">
                RM {fmtMoney(total)}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>


    {/* Toast */}
    {toast.show && (
      <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
        <div className="bg-ink text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px]">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{toast.message}</p>
            {toast.folderPath && (
              <button onClick={() => window.api.openFolder(toast.folderPath)} className="text-xs text-red-300 hover:underline mt-1 flex items-center gap-1">
                <FolderOpen size={12} /> Open Folder
              </button>
            )}
          </div>
          <button onClick={() => setToast(t => ({...t, show: false}))} className="text-white/50 hover:text-white"><X size={16} /></button>
        </div>
        <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) }}`}</style>
      </div>
    )}

    </>
  )
}
