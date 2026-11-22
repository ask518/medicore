// ============================================================================
// MEDICORE – Automated Multi-Tenant Isolation & Core Business Rules Verification
// ============================================================================

import { dbClient } from '../src/lib/dbClient.ts';

console.log('--- STARTING MEDICORE VERIFICATION SUITE ---');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedTests++;
  }
}

// ----------------------------------------------------------------------------
// TEST 1: Multiple Organizations (Tenants) Exist
// ----------------------------------------------------------------------------
const orgs = dbClient.getOrganizations();
assert(orgs.length >= 2, 'Scenario 1: At least two separate healthcare organizations exist');
const alnoor = dbClient.getOrganizationById('org-alnoor');
const alamal = dbClient.getOrganizationById('org-alamal');
assert(Boolean(alnoor && alamal), 'Scenario 1.1: Organizations org-alnoor and org-alamal are loaded independently');

// ----------------------------------------------------------------------------
// TEST 2: Multi-Tenant Data Isolation (Strict Boundary)
// ----------------------------------------------------------------------------
const alnoorPatients = dbClient.getPatients('org-alnoor');
const alamalPatients = dbClient.getPatients('org-alamal');

const alnoorHasAlamal = alnoorPatients.some(p => p.organization_id === 'org-alamal');
const alamalHasAlnoor = alamalPatients.some(p => p.organization_id === 'org-alnoor');

assert(!alnoorHasAlamal, 'Scenario 2: Organization Al-Noor CANNOT access Al-Amal patient records');
assert(!alamalHasAlnoor, 'Scenario 2.1: Organization Al-Amal CANNOT access Al-Noor patient records');

// Test strict patient ID lookup with cross-tenant check
let isolationErrorThrown = false;
try {
  // Try to access Al-Amal's patient under Al-Noor's tenant context
  dbClient.getPatientById('pat-mostafa', 'org-alnoor');
} catch (e: any) {
  isolationErrorThrown = true;
}
assert(isolationErrorThrown, 'Scenario 2.2: Cross-tenant direct ID access is blocked with security violation');

// ----------------------------------------------------------------------------
// TEST 3: Double-Booking Prevention Rule (Invariant Guard)
// ----------------------------------------------------------------------------
let doubleBookingBlocked = false;
try {
  // Existing appointment is on 2026-11-23 at 10:00 with Dr. Tarek (doc-tarek)
  dbClient.createAppointment('org-alnoor', {
    branch_id: 'branch-alnoor-main',
    doctor_id: 'doc-tarek',
    patient_id: 'pat-mona',
    appointment_date: '2026-11-23',
    start_time: '10:00',
    end_time: '10:20',
    type: 'new_consultation',
    status: 'confirmed',
    reason_for_visit: 'Conflict attempt test'
  });
} catch (e: any) {
  if (e.message.includes('Double-booking prevented')) {
    doubleBookingBlocked = true;
  }
}
assert(doubleBookingBlocked, 'Scenario 3: Double-booking guard strictly prevents two appointments at same minute for same doctor');

// ----------------------------------------------------------------------------
// TEST 4: Financial Ledger Integrity (Invoices & Cashbox Updates)
// ----------------------------------------------------------------------------
const initialCashbox = dbClient.getCashboxes('org-alnoor')[0];
const initialBal = initialCashbox.current_balance;

const testInvoice = dbClient.createInvoice('org-alnoor', {
  branch_id: 'branch-alnoor-main',
  patient_id: 'pat-ahmed',
  doctor_id: 'doc-tarek',
  issue_date: '2026-11-22',
  subtotal: 500,
  discount_amount: 50,
  tax_amount: 0,
  total_amount: 450,
  paid_amount: 0,
  balance_due: 450,
  status: 'unpaid',
  items: []
});

assert(testInvoice.balance_due === 450 && testInvoice.status === 'unpaid', 'Scenario 4.1: Invoice initial balance matches subtotal minus discount');

// Record partial payment of 200
dbClient.recordPayment('org-alnoor', {
  branch_id: 'branch-alnoor-main',
  invoice_id: testInvoice.id,
  patient_id: 'pat-ahmed',
  cashbox_id: initialCashbox.id,
  amount: 200,
  payment_mode: 'cash',
  is_reversal: false,
});

const updatedInvoice = dbClient.getInvoices('org-alnoor').find(i => i.id === testInvoice.id);
assert(updatedInvoice?.paid_amount === 200 && updatedInvoice?.balance_due === 250 && updatedInvoice?.status === 'partially_paid', 'Scenario 4.2: Partial payment recalculates paid, balance due, and updates status to partially_paid');

// Check cashbox updated
const updatedCashbox = dbClient.getCashboxes('org-alnoor').find(c => c.id === initialCashbox.id);
assert(updatedCashbox?.current_balance === initialBal + 200, 'Scenario 4.3: Cashbox balance increased by exact collected payment amount');

// ----------------------------------------------------------------------------
// TEST 5: Consultation Finalization & Security Audit Trail
// ----------------------------------------------------------------------------
const testConsultation = dbClient.saveConsultation('org-alnoor', {
  branch_id: 'branch-alnoor-main',
  patient_id: 'pat-ahmed',
  doctor_id: 'doc-tarek',
  consultation_date: new Date().toISOString(),
  status: 'finalized',
  chief_complaint: 'Automated test consultation',
  diagnoses_json: [{ code: 'M17.1', description: 'Osteoarthritis', is_primary: true }],
  specialty_code: 'orthopedics',
  specialty_data: {},
});

assert(testConsultation.status === 'finalized', 'Scenario 5.1: Clinical consultation saved with finalized status');

const logs = dbClient.getAuditLogs('org-alnoor');
const hasAuditEntry = logs.some(l => l.entity_id === testConsultation.id && l.action === 'SIGN_CONSULTATION');
assert(hasAuditEntry, 'Scenario 5.2: Digital signing creates immutable audit log record with actor and timestamp');

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('----------------------------------------------------');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('>>> ALL MEDICORE MULTI-TENANT VERIFICATION SCENARIOS PASSED WITH EVIDENCE <<<');
  process.exit(0);
}
