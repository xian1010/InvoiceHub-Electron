import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';
import {
  getDb, 
  listQuotations, 
  saveQuotation,
  getQuotation,
  deleteQuotation,
  updateQuotationStatus,
  getNextQuotationNo,
  getDashboardStats,
  saveCompanyProfile,
  getCompanyProfile,
  saveInvoice,
  listInvoices,
  deleteInvoice
} from './test_db_mock.js';

console.log("=== STARTING INTEGRATION TESTS ===");

const errors = [];
const successes = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(`[FAILED] ${message}`);
    throw new Error(message);
  } else {
    successes.push(`[PASSED] ${message}`);
    console.log(`✅ ${message}`);
  }
}

async function runTests() {
  try {
    const db = getDb();
    assert(db !== null, "Database connection established.");
    
    saveCompanyProfile({
      name: 'Test Corp', reg_no: '12345', address: '123 Lane', 
      tel: '999', email: 'test@test.com', bank_info: 'Bank 123'
    });
    const cp = getCompanyProfile();
    assert(cp.name === 'Test Corp', "Company Profile correctly saved and retrieved.");

    const stats = getDashboardStats();
    assert(typeof stats.revenue !== 'undefined', "Dashboard stats successfully retrieved.");

    const qtNo = getNextQuotationNo();
    assert(qtNo.startsWith('QT-'), "Next Quotation Number formatted correctly.");
    
    const header = {
      quotation_no: qtNo, customer: 'John Doe Test', date: '2025-01-01',
      total: 500, address: 'Test Address', attn: 'John', tel: '123',
      acc_code: '300-1111', terms: 'COD', ref1: '', ref2: '', status: 'Draft'
    };
    const items = [
      { description: 'Service A', qty: 2, uom: 'HR', uprice: 250, subtotal: 500 }
    ];
    
    saveQuotation(header, items);
    
    let qt = getQuotation(qtNo);
    assert(qt && qt.quotation_no === qtNo && qt.items.length === 1, "Quotation correctly saved with line items.");
    
    updateQuotationStatus(qtNo, 'Invoiced');
    const checkedQt = getQuotation(qtNo);
    assert(checkedQt.status === 'Invoiced', "Quotation status updated to Invoiced.");
    
    const invNo = `INV-TEST-${Date.now()}`;
    saveInvoice(
      { ...header, invoice_no: invNo, status: 'Pending', ref3: '', ref4: '' },
      items.map(it => ({ ...it, po_no: '' }))
    );
    
    const invList = listInvoices();
    const foundInv = invList.find(i => i.invoice_no === invNo);
    assert(foundInv !== undefined, "Quotation successfully converted and pushed to Invoices.");

    deleteQuotation(qtNo);
    deleteInvoice(invNo);
    
    const tmpPath = path.join(process.cwd(), `qt_test_export_${Date.now()}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify({
      invoice_no: qtNo, date: header.date, billing: header.customer,
      billing_address: header.address, acc_code: header.acc_code,
      attn: header.attn, tel: header.tel, terms: header.terms,
      ref1: '', ref2: '', grand_total: 500,
      items: [
        { desc: 'Service A', po_no: '', qty: 2, uom: 'HR', price: 250, total: 500 }
      ]
    }));
    
    const pyScript = path.join(process.cwd(), '..', 'pdf_quotation.py');
    const wrapperScript = path.join(process.cwd(), `wrapper_${Date.now()}.py`);
    const wrapperContent = `
import sys
import json
import os
sys.path.append(os.path.dirname(r"${pyScript}"))
from pdf_quotation import generate_quotation_pdf

with open(r"${tmpPath}", "r", encoding="utf-8") as f:
    data = json.load(f)

try:
    out_path = generate_quotation_pdf(data)
    print("SUCCESS:" + out_path)
except Exception as e:
    print("ERROR:" + str(e))
    sys.exit(1)
`;
    fs.writeFileSync(wrapperScript, wrapperContent);
    
    console.log("Running Python Bridge...");
    const py = spawnSync('python', [wrapperScript], { encoding: 'utf-8' });
    
    try { fs.unlinkSync(tmpPath); } catch(e){}
    try { fs.unlinkSync(wrapperScript); } catch(e){}
    
    if (py.stdout && py.stdout.includes("SUCCESS:")) {
      const pdfPath = py.stdout.split("SUCCESS:")[1].trim();
      assert(fs.existsSync(pdfPath), `PDF generated and exists at ${pdfPath}`);
    } else {
      console.error(py.stderr || py.stdout);
      assert(false, "Python pdf_quotation generation failed.");
    }
    
    const stmtTmpPath = path.join(process.cwd(), `stmt_test_${Date.now()}.json`);
    fs.writeFileSync(stmtTmpPath, JSON.stringify({
        customer: 'John Doe',
        from_date: '2025-01-01',
        to_date: '2025-12-31',
        opening_balance: 0,
        transactions: [
           { date: '2025-12-01', description: 'Test', ref_no: 'INV-100', debit: 100, credit: 0, balance: 100 }
        ]
    }));
    
    const stmtPyScript = path.join(process.cwd(), '..', 'pdf_statement.py');
    const stmtWrapper = path.join(process.cwd(), `wrapper_stmt_${Date.now()}.py`);
    fs.writeFileSync(stmtWrapper, `
import sys, json, os
sys.path.append(os.path.dirname(r"${stmtPyScript}"))
from pdf_statement import generate_statement_pdf
with open(r"${stmtTmpPath}", "r", encoding="utf-8") as f:
    data = json.load(f)
try:
    c = data.get("customer", "")
    fd = data.get("from_date", "")
    td = data.get("to_date", "")
    ob = float(data.get("opening_balance", 0))
    rows = data.get("transactions", [])
    out_path = generate_statement_pdf(c, fd, td, ob, rows)
    print("SUCCESS:" + out_path)
except Exception as e:
    print("ERROR:" + str(e))
    sys.exit(1)
`);

    const stmtPy = spawnSync('python', [stmtWrapper], { encoding: 'utf-8' });
    try { fs.unlinkSync(stmtTmpPath); fs.unlinkSync(stmtWrapper); } catch(e){}
    
    if (stmtPy.stdout && stmtPy.stdout.includes("SUCCESS:")) {
       const stmtPdf = stmtPy.stdout.split("SUCCESS:")[1].trim();
       assert(fs.existsSync(stmtPdf), `Statement PDF successfully generated at ${stmtPdf}`);
    } else {
       console.error(stmtPy.stderr || stmtPy.stdout);
       assert(false, "Python Statement PDF generation failed.");
    }

    console.log("\\n=== INTEGRATION TESTS COMPLETED SUCCESSFULLY ===");

  } catch (err) {
    console.error("\\n\\n[TEST FAILURES ENDED SUITE]:", err);
    process.exit(1);
  }
}

runTests();
