/**
 * ai.js — AI Purchase Order OCR service
 * Node.js port of ai_service.py using the openai npm package.
 * Supports images (.jpg/.png/.gif/.webp) AND PDF files (.pdf).
 */

import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'

// ── API config ────────────────────────────────────────────────────────────────

const BASE_URL   = 'https://api.vectorengine.ai/v1'
const API_KEY    = 'sk-seMZSwcdp7GGyBd5NLa04jsPXi0MQetzjW1LMm3C5GaHgBbo'
const MODEL      = 'gpt-4o'
const MAX_TOKENS = 1500

const MEDIA_TYPES = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp'
}

// ── Prompts (mirrors ai_service.py exactly) ───────────────────────────────────

const SYSTEM_PROMPT = `You are a professional financial accountant. Your task is to extract key data from Purchase Order images.
Your output must be strict JSON format, without any explanation or extra text.
IMPORTANT: Ignore all purely blank rows, separator lines, or decorative/formatting rows in the PO table. Only extract rows that contain actual product descriptions, quantities, or amounts.`

const USER_PROMPT = `Please read this Purchase Order image, extract the following information, and return STRICTLY as JSON without any chat:

{
  "customer":   "<Company name from the page header/letterhead – the buyer who issued this PO. Do NOT fill in the supplier/recipient name>",
  "address":    "<Buyer company address from the letterhead area>",
  "date":       "<Date, format DD/MM/YYYY, if format unclear keep original>",
  "po_number":  "<PO number / document reference>",
  "attn":       "<Contact person name, empty string if none>",
  "tel":        "<Phone number, empty string if none>",
  "terms":      "<Payment terms, e.g. 30 Days, empty string if none>",
  "items": [
    {
      "description": "<Product or service description. You MUST identify every physical line break visible in the image. If a product name is followed by specification lines below it, capture ALL of them and preserve their structure using standard JSON newline escape sequences. Use \\n between lines in the JSON string value.>",
      "qty":         "<Quantity, pure number string, e.g. 5>",
      "uom":         "<Unit: PCS / UNIT / SET / BOX / LOT / KG / PKT etc., PCS if none>",
      "unit_price":  "<Unit price, pure number string, no currency symbol, e.g. 120.00>"
    }
  ]
}

Rules:
- "customer" must be the letterhead company – the buyer who sent this PO.
  Do not fill the "To:" / "Vendor:" / "Supplier:" company, that is us.
- Only return the JSON object, no other text.
- Missing fields should be empty string "".
- Number fields must not contain commas or currency symbols.
- Extract ALL valid line items. SKIP any row where the description is blank, or the row is only whitespace, or the row is a divider/header/subtotal row with no real product name.
- CRITICAL – Description line breaks: You MUST detect every physical line break in the image for each description. Use the standard JSON newline escape \\n between lines. The final parsed value must contain real newline characters, NOT the literal two-character text backslash-n.`

// ── PDF to Image conversion ───────────────────────────────────────────────────

/**
 * Convert first page of a PDF to a PNG image buffer using Python (PyMuPDF).
 * Falls back to returning null if conversion fails.
 */
async function pdfToImage(pdfPath) {
  const { spawn } = await import('child_process')
  const { app } = await import('electron')
  const outPath = path.join(app.getPath('temp'), `po_pdf_page_${Date.now()}.png`)

  return new Promise((resolve, reject) => {
    // Use Python + PyMuPDF (fitz) for reliable PDF→PNG conversion
    const pyCode = `
import sys, fitz, os
pdf_path = sys.argv[1]
out_path = sys.argv[2]
doc = fitz.open(pdf_path)
page = doc[0]
mat = fitz.Matrix(3.0, 3.0)
pix = page.get_pixmap(matrix=mat)
pix.save(out_path)
doc.close()
print("OK:" + out_path)
`
    const tmpScript = path.join(app.getPath('temp'), `pdf2img_${Date.now()}.py`)
    fs.writeFileSync(tmpScript, pyCode)

    const py = spawn('python', [tmpScript, pdfPath, outPath])
    let stdout = '', stderr = ''
    py.stdout.on('data', d => { stdout += d.toString() })
    py.stderr.on('data', d => { stderr += d.toString() })
    py.on('close', code => {
      try { fs.unlinkSync(tmpScript) } catch {}
      if (code === 0 && fs.existsSync(outPath)) {
        resolve(outPath)
      } else {
        reject(new Error(`PDF conversion failed: ${stderr || stdout || 'Unknown error'}\nPlease install PyMuPDF: pip install PyMuPDF`))
      }
    })
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract PO data from an image or PDF file.
 * @param {string} filePath  absolute path to image or PDF
 * @returns {Promise<object>}  structured PO data
 */
export async function extractPoData(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  let imagePath = filePath
  let tempImage = null

  // If PDF, convert first page to image
  if (ext === '.pdf') {
    console.log('[ai] PDF detected, converting first page to image...')
    imagePath = await pdfToImage(filePath)
    tempImage = imagePath  // track for cleanup
    console.log(`[ai] PDF converted to: ${imagePath}`)
  }

  const imgExt = path.extname(imagePath).toLowerCase()
  const mediaType = MEDIA_TYPES[imgExt]

  if (!mediaType) {
    const supported = [...Object.keys(MEDIA_TYPES), '.pdf'].join(', ')
    throw new Error(`Unsupported file format '${ext}'.\nSupported: ${supported}`)
  }

  try {
    const fileBuffer = fs.readFileSync(imagePath)
    const b64 = fileBuffer.toString('base64')

    const content = [
      {
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${b64}` }
      },
      { type: 'text', text: USER_PROMPT }
    ]

    const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 60000 })

    console.log(`[ai] -> model=${MODEL}  file=${filePath}`)

    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content }
      ]
    })

    const raw = response.choices[0].message.content.trim()
    console.log(`[ai] Raw (first 300): ${raw.slice(0, 300)}`)
    return _parseAndNormalise(raw)
  } finally {
    // Clean up temp image from PDF conversion
    if (tempImage) {
      try { fs.unlinkSync(tempImage) } catch {}
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _parseAndNormalise(raw) {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()

  let data
  try {
    data = JSON.parse(cleaned)
  } catch {
    throw new Error(`AI returned invalid JSON:\n${cleaned.slice(0, 400)}`)
  }

  for (const key of ['customer', 'address', 'date', 'po_number', 'attn', 'tel', 'terms']) {
    if (data[key] == null) data[key] = ''
    data[key] = String(data[key]).trim()
  }

  const poNumber = data.po_number || ''

  data.items = (data.items ?? [])
    .map(item => {
      // Normalise description: replace literal backslash-n (\\n as two chars) with real newline
      const rawDesc = String(item.description ?? '').trim()
      const description = rawDesc.replace(/\\n/g, '\n')
      const qty        = String(item.qty        ?? '1').trim()
      const uom        = (String(item.uom       ?? 'PCS').trim().toUpperCase()) || 'PCS'
      const unit_price = String(item.unit_price ?? '0').trim()
      return { description, qty, uom, unit_price, po_no: poNumber }
    })
    // ── Mandatory filter: drop blank / zero-value rows ──────────────────────
    .filter(item => {
      if (!item.description.trim()) return false           // empty description
      const price = parseFloat(item.unit_price) || 0
      const qty   = parseFloat(item.qty)        || 0
      // Keep row if it has a non-zero price OR a non-zero qty (some rows are lump-sum)
      if (price === 0 && qty === 0) return false
      return true
    })

  return data
}

// ── Invoice PDF Recovery ──────────────────────────────────────────────────────

const INVOICE_SYSTEM_PROMPT = `You are a professional financial accountant. Your task is to extract key data from Invoice PDF images.
Your output must be strict JSON format, without any explanation or extra text.
IMPORTANT: Ignore all purely blank rows, separator lines, or decorative/formatting rows in the invoice table. Only extract rows that contain actual product descriptions, quantities, or amounts.`

const INVOICE_USER_PROMPT = `Please read this Invoice PDF image, extract the following information, and return STRICTLY as JSON without any chat:

{
  "invoice_no":  "<Invoice number, e.g. INV-0001>",
  "customer":    "<Customer / Bill To company name>",
  "address":     "<Customer billing address>",
  "date":        "<Invoice date, format YYYY-MM-DD>",
  "attn":        "<Attention / contact person, empty string if none>",
  "tel":         "<Telephone number, empty string if none>",
  "acc_code":    "<Account code, empty string if none>",
  "terms":       "<Payment terms, e.g. 30 days, empty string if none>",
  "ref1":        "<Reference 1 / PO number, empty string if none>",
  "ref2":        "<Reference 2, empty string if none>",
  "items": [
    {
      "description": "<Product or service description. Preserve line breaks using \\\\n in the JSON string.>",
      "po_no":       "<PO number for this line item, empty string if none>",
      "qty":         "<Quantity, pure number string>",
      "uom":         "<Unit: PCS / UNIT / SET / BOX / LOT / KG etc.>",
      "uprice":      "<Unit price, pure number string without currency symbol. Use '-' if lump sum>",
      "subtotal":    "<Line subtotal, pure number string>"
    }
  ]
}

Rules:
- Only return the JSON object, no other text.
- Missing fields should be empty string "".
- Number fields must not contain commas or currency symbols.
- Extract ALL valid line items. SKIP blank/header/subtotal/footer rows.
- If the date format is DD/MM/YYYY, convert it to YYYY-MM-DD.
- CRITICAL: description line breaks must use \\\\n escape.`

/**
 * Extract invoice data from a PDF file (for bulk recovery).
 * @param {string} filePath  absolute path to PDF
 * @returns {Promise<object>}  structured invoice data
 */
export async function extractInvoiceData(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  let imagePath = filePath
  let tempImage = null

  // Convert PDF to image
  if (ext === '.pdf') {
    imagePath = await pdfToImage(filePath)
    tempImage = imagePath
  }

  const imgExt = path.extname(imagePath).toLowerCase()
  const mediaType = MEDIA_TYPES[imgExt]

  if (!mediaType) {
    throw new Error(`Unsupported file format '${ext}'`)
  }

  try {
    const fileBuffer = fs.readFileSync(imagePath)
    const b64 = fileBuffer.toString('base64')

    const content = [
      {
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${b64}` }
      },
      { type: 'text', text: INVOICE_USER_PROMPT }
    ]

    const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 90000 })

    console.log(`[ai:recovery] -> model=${MODEL}  file=${filePath}`)

    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: INVOICE_SYSTEM_PROMPT },
        { role: 'user',   content }
      ]
    })

    const raw = response.choices[0].message.content.trim()
    console.log(`[ai:recovery] Raw (first 300): ${raw.slice(0, 300)}`)
    return _parseInvoiceResult(raw)
  } finally {
    if (tempImage) {
      try { fs.unlinkSync(tempImage) } catch {}
    }
  }
}

function _parseInvoiceResult(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()

  let data
  try {
    data = JSON.parse(cleaned)
  } catch {
    throw new Error(`AI returned invalid JSON:\n${cleaned.slice(0, 400)}`)
  }

  // Normalise header fields
  for (const key of ['invoice_no', 'customer', 'address', 'date', 'attn', 'tel', 'acc_code', 'terms', 'ref1', 'ref2']) {
    if (data[key] == null) data[key] = ''
    data[key] = String(data[key]).trim()
  }

  // Normalise date to YYYY-MM-DD if it came as DD/MM/YYYY
  if (data.date && data.date.includes('/')) {
    const parts = data.date.split('/')
    if (parts.length === 3 && parts[2].length === 4) {
      data.date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // Normalise items
  data.items = (data.items ?? [])
    .map(item => {
      const rawDesc = String(item.description ?? '').trim()
      const description = rawDesc.replace(/\\n/g, '\n')
      const po_no    = String(item.po_no    ?? '').trim()
      const qty      = String(item.qty      ?? '1').trim()
      const uom      = (String(item.uom     ?? 'PCS').trim().toUpperCase()) || 'PCS'
      const uprice   = String(item.uprice   ?? '-').trim()
      const subtotal = String(item.subtotal ?? '0').trim()
      return { description, po_no, qty, uom, uprice, subtotal }
    })
    .filter(item => item.description.trim() !== '')

  // Calculate total from items
  data.total = data.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)

  return data
}
