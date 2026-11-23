// ============================================================================
// MEDICORE – Unified Multi-Tenant Database Client & Business Rule Engine
// ============================================================================

import {
  Organization, SubscriptionPlan, Subscription, Branch, User, Doctor,
  Patient, Appointment, Consultation, AnatomicalFinding, Prescription,
  LaboratoryOrder, RadiologyOrder, Service, Invoice, Payment, Cashbox,
  DoctorCommission, AuditLog, SystemAnnouncement
} from '../types/database';
import {
  INITIAL_PLANS, INITIAL_ORGS, INITIAL_SUBSCRIPTIONS, INITIAL_BRANCHES,
  INITIAL_USERS, INITIAL_DOCTORS, INITIAL_PATIENTS, INITIAL_APPOINTMENTS,
  INITIAL_CONSULTATIONS, INITIAL_ANATOMICAL_FINDINGS, INITIAL_PRESCRIPTIONS,
  INITIAL_SERVICES, INITIAL_INVOICES, INITIAL_PAYMENTS, INITIAL_CASHBOXES,
  INITIAL_COMMISSIONS, INITIAL_AUDIT_LOGS, INITIAL_ANNOUNCEMENTS, INITIAL_RAD_ORDERS
} from './mockData';

type Listener = () => void;

class MultiTenantDatabase {
  private plans: SubscriptionPlan[] = [...INITIAL_PLANS];
  private orgs: Organization[] = [...INITIAL_ORGS];
  private subs: Subscription[] = [...INITIAL_SUBSCRIPTIONS];
  private branches: Branch[] = [...INITIAL_BRANCHES];
  private users: User[] = [...INITIAL_USERS];
  private doctors: Doctor[] = [...INITIAL_DOCTORS];
  private patients: Patient[] = [...INITIAL_PATIENTS];
  private appointments: Appointment[] = [...INITIAL_APPOINTMENTS];
  private consultations: Consultation[] = [...INITIAL_CONSULTATIONS];
  private findings: AnatomicalFinding[] = [...INITIAL_ANATOMICAL_FINDINGS];
  private prescriptions: Prescription[] = [...INITIAL_PRESCRIPTIONS];
  private labOrders: LaboratoryOrder[] = [];
  private radOrders: RadiologyOrder[] = [...INITIAL_RAD_ORDERS];
  private services: Service[] = [...INITIAL_SERVICES];
  private invoices: Invoice[] = [...INITIAL_INVOICES];
  private payments: Payment[] = [...INITIAL_PAYMENTS];
  private cashboxes: Cashbox[] = [...INITIAL_CASHBOXES];
  private commissions: DoctorCommission[] = [...INITIAL_COMMISSIONS];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private announcements: SystemAnnouncement[] = [...INITIAL_ANNOUNCEMENTS];

  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && localStorage.getItem('medicore_demo_purged') === 'true') {
      this.orgs = [];
      this.subs = [];
      this.branches = [];
      this.users = INITIAL_USERS.filter(u => u.role === 'super_admin');
      this.doctors = [];
      this.patients = [];
      this.appointments = [];
      this.consultations = [];
      this.findings = [];
      this.prescriptions = [];
      this.labOrders = [];
      this.radOrders = [];
      this.invoices = [];
      this.payments = [];
      this.cashboxes = [];
      this.commissions = [];
    }
  }

  public purgeAllDemoData() {
    this.patients = [];
    this.appointments = [];
    this.consultations = [];
    this.findings = [];
    this.prescriptions = [];
    this.labOrders = [];
    this.radOrders = [];
    this.invoices = [];
    this.payments = [];
    this.commissions = [];
    this.orgs = [];
    this.branches = [];
    this.subs = [];
    this.doctors = [];
    this.users = INITIAL_USERS.filter(u => u.role === 'super_admin');
    if (typeof window !== 'undefined') {
      localStorage.setItem('medicore_demo_purged', 'true');
      localStorage.setItem('medicore_user_id', 'user-super-admin');
    }
    this.logAudit({
      action: 'PURGE_DEMO_DATA',
      entityType: 'system',
      entityId: 'global',
      newValues: { message: 'All demo and simulation fixtures purged. Platform is running in pure production mode.' }
    });
    this.notify();
  }

  public restoreDemoData() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('medicore_demo_purged');
    }
    this.orgs = [...INITIAL_ORGS];
    this.subs = [...INITIAL_SUBSCRIPTIONS];
    this.branches = [...INITIAL_BRANCHES];
    this.users = [...INITIAL_USERS];
    this.doctors = [...INITIAL_DOCTORS];
    this.patients = [...INITIAL_PATIENTS];
    this.appointments = [...INITIAL_APPOINTMENTS];
    this.consultations = [...INITIAL_CONSULTATIONS];
    this.findings = [...INITIAL_ANATOMICAL_FINDINGS];
    this.prescriptions = [...INITIAL_PRESCRIPTIONS];
    this.radOrders = [...INITIAL_RAD_ORDERS];
    this.services = [...INITIAL_SERVICES];
    this.invoices = [...INITIAL_INVOICES];
    this.payments = [...INITIAL_PAYMENTS];
    this.cashboxes = [...INITIAL_CASHBOXES];
    this.commissions = [...INITIAL_COMMISSIONS];
    this.notify();
  }

  public isDemoPurged(): boolean {
    return typeof window !== 'undefined' && localStorage.getItem('medicore_demo_purged') === 'true';
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // --------------------------------------------------------------------------
  // Audit Trail
  // --------------------------------------------------------------------------
  public logAudit(params: {
    orgId?: string;
    branchId?: string;
    userId?: string;
    userName?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }) {
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organization_id: params.orgId,
      branch_id: params.branchId,
      user_id: params.userId,
      user_name: params.userName || 'System',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues,
      new_values: params.newValues,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    this.notify();
    return entry;
  }

  public getAuditLogs(orgId?: string) {
    if (!orgId) return [...this.auditLogs];
    return this.auditLogs.filter(a => a.organization_id === orgId);
  }

  // --------------------------------------------------------------------------
  // System Announcements & Plans
  // --------------------------------------------------------------------------
  public getAnnouncements() {
    return this.announcements.filter(a => a.is_active);
  }

  public getPlans() {
    return [...this.plans];
  }

  public updatePlan(id: string, updates: Partial<SubscriptionPlan>) {
    const idx = this.plans.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.plans[idx] = { ...this.plans[idx], ...updates, updated_at: new Date().toISOString() };
      this.notify();
      return this.plans[idx];
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Organizations & Subscriptions (Super Admin / Multi-Tenant Boundary)
  // --------------------------------------------------------------------------
  public getOrganizations() {
    return [...this.orgs];
  }

  public getOrganizationById(id: string) {
    return this.orgs.find(o => o.id === id);
  }

  public createOrganization(data: Omit<Organization, 'id' | 'storage_consumed_mb' | 'created_at' | 'updated_at'>, planSlug = 'starter') {
    const orgId = `org-${Date.now()}`;
    const newOrg: Organization = {
      ...data,
      id: orgId,
      storage_consumed_mb: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.orgs.push(newOrg);

    // Create subscription
    const plan = this.plans.find(p => p.slug === planSlug) || this.plans[0];
    const sub: Subscription = {
      id: `sub-${Date.now()}`,
      organization_id: orgId,
      plan_id: plan.id,
      status: 'active',
      cycle: 'monthly',
      amount: plan.price_monthly,
      currency: plan.currency,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      payment_method: 'manual_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      plan: plan
    };
    this.subs.push(sub);

    // Create primary branch
    const branch: Branch = {
      id: `branch-${Date.now()}`,
      organization_id: orgId,
      name_ar: `الفرع الرئيسي - ${newOrg.name_ar}`,
      name_en: `Main Branch - ${newOrg.name_en}`,
      code: 'MAIN-01',
      phone: newOrg.phone,
      email: newOrg.email,
      address: newOrg.address || 'العنوان الرئيسي',
      city: newOrg.city,
      is_main_branch: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.branches.push(branch);

    // Create cashbox
    const cashbox: Cashbox = {
      id: `cb-${Date.now()}`,
      organization_id: orgId,
      branch_id: branch.id,
      name: 'خزينة الاستقبال الرئيسية',
      current_balance: 0,
      is_active: true,
    };
    this.cashboxes.push(cashbox);

    this.logAudit({
      orgId,
      action: 'REGISTER_ORG',
      entityType: 'organizations',
      entityId: orgId,
      newValues: { name: newOrg.name_en, plan: plan.name_en }
    });

    this.notify();
    return { org: newOrg, subscription: sub, branch };
  }

  public updateOrganizationStatus(orgId: string, status: Organization['status']) {
    const org = this.orgs.find(o => o.id === orgId);
    if (org) {
      org.status = status;
      org.updated_at = new Date().toISOString();
      this.logAudit({ orgId, action: 'UPDATE_STATUS', entityType: 'organizations', entityId: orgId, newValues: { status } });
      this.notify();
    }
    return org;
  }

  public getSubscriptionByOrgId(orgId: string) {
    const sub = this.subs.find(s => s.organization_id === orgId);
    if (sub) {
      const plan = this.plans.find(p => p.id === sub.plan_id);
      return { ...sub, plan };
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Branches
  // --------------------------------------------------------------------------
  public getBranches(orgId: string) {
    return this.branches.filter(b => b.organization_id === orgId && b.is_active);
  }

  public createBranch(orgId: string, data: Omit<Branch, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    const branch: Branch = {
      ...data,
      id: `branch-${Date.now()}`,
      organization_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.branches.push(branch);
    this.logAudit({ orgId, branchId: branch.id, action: 'CREATE_BRANCH', entityType: 'branches', entityId: branch.id });
    this.notify();
    return branch;
  }

  // --------------------------------------------------------------------------
  // Users & Staff
  // --------------------------------------------------------------------------
  public getUsers(orgId?: string) {
    if (!orgId) return [...this.users];
    return this.users.filter(u => u.organization_id === orgId);
  }

  public getUserById(id: string) {
    return this.users.find(u => u.id === id);
  }

  public getDoctors(orgId: string) {
    return this.doctors
      .filter(d => d.organization_id === orgId && d.is_active)
      .map(doc => {
        const user = this.users.find(u => u.id === doc.user_id);
        return { ...doc, user };
      });
  }

  // --------------------------------------------------------------------------
  // Patients (EMR)
  // --------------------------------------------------------------------------
  public getPatients(orgId: string, search = '') {
    let list = this.patients.filter(p => p.organization_id === orgId && p.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        p.mrn.toLowerCase().includes(q) ||
        p.first_name_ar.includes(q) ||
        p.last_name_ar.includes(q) ||
        p.phone.includes(q) ||
        (p.first_name_en && p.first_name_en.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getPatientById(id: string, orgId?: string) {
    const pat = this.patients.find(p => p.id === id);
    if (orgId && pat && pat.organization_id !== orgId) {
      throw new Error('Access Denied: Cross-tenant patient isolation violated.');
    }
    return pat;
  }

  public createPatient(orgId: string, data: Omit<Patient, 'id' | 'organization_id' | 'mrn' | 'created_at' | 'updated_at'>) {
    const count = this.patients.filter(p => p.organization_id === orgId).length + 1;
    const mrn = `MRN-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
    const newPatient: Patient = {
      ...data,
      id: `pat-${Date.now()}`,
      organization_id: orgId,
      mrn,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.patients.unshift(newPatient);
    this.logAudit({ orgId, action: 'CREATE_PATIENT', entityType: 'patients', entityId: newPatient.id, newValues: { mrn, name: `${data.first_name_ar} ${data.last_name_ar}` } });
    this.notify();
    return newPatient;
  }

  // --------------------------------------------------------------------------
  // Appointments & Double-Booking Prevention Rule
  // --------------------------------------------------------------------------
  public getAppointments(orgId: string, filters?: { branchId?: string; doctorId?: string; date?: string; status?: string }) {
    return this.appointments
      .filter(apt => {
        if (apt.organization_id !== orgId) return false;
        if (filters?.branchId && apt.branch_id !== filters.branchId) return false;
        if (filters?.doctorId && apt.doctor_id !== filters.doctorId) return false;
        if (filters?.date && apt.appointment_date !== filters.date) return false;
        if (filters?.status && apt.status !== filters.status) return false;
        return true;
      })
      .map(apt => {
        const patient = this.patients.find(p => p.id === apt.patient_id);
        const doctor = this.doctors.find(d => d.id === apt.doctor_id);
        const branch = this.branches.find(b => b.id === apt.branch_id);
        return { ...apt, patient, doctor, branch };
      })
      .sort((a, b) => `${a.appointment_date} ${a.start_time}`.localeCompare(`${b.appointment_date} ${b.start_time}`));
  }

  public createAppointment(orgId: string, data: Omit<Appointment, 'id' | 'organization_id' | 'appointment_number' | 'created_at' | 'updated_at'>) {
    // DOUBLE-BOOKING PREVENTION GUARD (Healthcare Invariant)
    const activeConflict = this.appointments.find(apt => 
      apt.doctor_id === data.doctor_id &&
      apt.appointment_date === data.appointment_date &&
      apt.start_time === data.start_time &&
      !['cancelled', 'no_show'].includes(apt.status)
    );

    if (activeConflict) {
      throw new Error(`Double-booking prevented: Doctor already has an active appointment at ${data.appointment_date} ${data.start_time}`);
    }

    const count = this.appointments.filter(a => a.organization_id === orgId).length + 1;
    const aptNumber = `APT-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

    const newApt: Appointment = {
      ...data,
      id: `apt-${Date.now()}`,
      organization_id: orgId,
      appointment_number: aptNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.appointments.push(newApt);
    this.logAudit({ orgId, branchId: data.branch_id, action: 'BOOK_APPOINTMENT', entityType: 'appointments', entityId: newApt.id });
    this.notify();
    return newApt;
  }

  public updateAppointmentStatus(id: string, status: Appointment['status'], extra?: Partial<Appointment>) {
    const apt = this.appointments.find(a => a.id === id);
    if (apt) {
      apt.status = status;
      if (status === 'checked_in') apt.checked_in_at = new Date().toISOString();
      if (status === 'in_consultation') apt.consultation_started_at = new Date().toISOString();
      if (status === 'completed') apt.completed_at = new Date().toISOString();
      if (extra) Object.assign(apt, extra);
      apt.updated_at = new Date().toISOString();
      this.logAudit({ orgId: apt.organization_id, branchId: apt.branch_id, action: 'UPDATE_STATUS', entityType: 'appointments', entityId: id, newValues: { status } });
      this.notify();
    }
    return apt;
  }

  // --------------------------------------------------------------------------
  // Consultations & Anatomical Findings
  // --------------------------------------------------------------------------
  public getConsultations(orgId: string, patientId?: string) {
    return this.consultations
      .filter(c => c.organization_id === orgId && (!patientId || c.patient_id === patientId))
      .map(c => {
        const patient = this.patients.find(p => p.id === c.patient_id);
        const doctor = this.doctors.find(d => d.id === c.doctor_id);
        return { ...c, patient, doctor };
      })
      .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date));
  }

  public saveConsultation(orgId: string, data: Omit<Consultation, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    const newCon: Consultation = {
      ...data,
      id: `con-${Date.now()}`,
      organization_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.consultations.unshift(newCon);

    if (data.appointment_id) {
      this.updateAppointmentStatus(data.appointment_id, 'completed');
    }

    this.logAudit({
      orgId,
      branchId: data.branch_id,
      action: data.status === 'finalized' ? 'SIGN_CONSULTATION' : 'SAVE_CONSULTATION',
      entityType: 'consultations',
      entityId: newCon.id
    });
    this.notify();
    return newCon;
  }

  public getAnatomicalFindings(orgId: string, consultationId?: string, patientId?: string) {
    return this.findings.filter(f => 
      f.organization_id === orgId &&
      (!consultationId || f.consultation_id === consultationId) &&
      (!patientId || f.patient_id === patientId)
    );
  }

  public saveAnatomicalFindings(orgId: string, findingsList: Omit<AnatomicalFinding, 'id' | 'organization_id' | 'created_at'>[]) {
    const saved = findingsList.map(item => {
      const f: AnatomicalFinding = {
        ...item,
        id: `find-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        organization_id: orgId,
        created_at: new Date().toISOString(),
      };
      this.findings.push(f);
      return f;
    });
    this.notify();
    return saved;
  }

  // --------------------------------------------------------------------------
  // Prescriptions
  // --------------------------------------------------------------------------
  public getPrescriptions(orgId: string, patientId?: string) {
    return this.prescriptions
      .filter(p => p.organization_id === orgId && (!patientId || p.patient_id === patientId))
      .map(rx => {
        const patient = this.patients.find(p => p.id === rx.patient_id);
        const doctor = this.doctors.find(d => d.id === rx.doctor_id);
        return { ...rx, patient, doctor };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createPrescription(orgId: string, data: Omit<Prescription, 'id' | 'organization_id' | 'prescription_number' | 'created_at'>) {
    const count = this.prescriptions.filter(p => p.organization_id === orgId).length + 1;
    const rxNumber = `RX-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
    const newRx: Prescription = {
      ...data,
      id: `rx-${Date.now()}`,
      organization_id: orgId,
      prescription_number: rxNumber,
      created_at: new Date().toISOString(),
    };
    this.prescriptions.unshift(newRx);
    this.logAudit({ orgId, branchId: data.branch_id, action: 'CREATE_PRESCRIPTION', entityType: 'prescriptions', entityId: newRx.id });
    this.notify();
    return newRx;
  }

  // --------------------------------------------------------------------------
  // Laboratory & Radiology
  // --------------------------------------------------------------------------
  public getLabOrders(orgId: string) {
    return this.labOrders.filter(o => o.organization_id === orgId);
  }

  public getRadOrders(orgId: string) {
    return this.radOrders.filter(o => o.organization_id === orgId);
  }

  public createRadOrder(orgId: string, data: Omit<RadiologyOrder, 'id' | 'organization_id' | 'order_number' | 'created_at' | 'updated_at'>) {
    const count = this.radOrders.filter(r => r.organization_id === orgId).length + 1;
    const orderNumber = `RAD-${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;
    const newRad: RadiologyOrder = {
      ...data,
      id: `rad-${Date.now()}`,
      organization_id: orgId,
      order_number: orderNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.radOrders.unshift(newRad);
    this.notify();
    return newRad;
  }

  // --------------------------------------------------------------------------
  // Services & Invoices & Payments & Commissions
  // --------------------------------------------------------------------------
  public getServices(orgId: string) {
    return this.services.filter(s => s.organization_id === orgId && s.is_active);
  }

  public getCashboxes(orgId: string) {
    return this.cashboxes.filter(c => c.organization_id === orgId && c.is_active);
  }

  public getInvoices(orgId: string) {
    return this.invoices
      .filter(i => i.organization_id === orgId)
      .map(inv => {
        const patient = this.patients.find(p => p.id === inv.patient_id);
        const doctor = this.doctors.find(d => d.id === inv.doctor_id);
        return { ...inv, patient, doctor };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createInvoice(orgId: string, data: Omit<Invoice, 'id' | 'organization_id' | 'invoice_number' | 'created_at' | 'updated_at'>) {
    const count = this.invoices.filter(i => i.organization_id === orgId).length + 1;
    const invNumber = `INV-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
    const newInv: Invoice = {
      ...data,
      id: `inv-${Date.now()}`,
      organization_id: orgId,
      invoice_number: invNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.invoices.unshift(newInv);
    this.logAudit({ orgId, branchId: data.branch_id, action: 'CREATE_INVOICE', entityType: 'invoices', entityId: newInv.id });
    this.notify();
    return newInv;
  }

  public recordPayment(orgId: string, data: Omit<Payment, 'id' | 'organization_id' | 'receipt_number' | 'created_at'>) {
    const count = this.payments.filter(p => p.organization_id === orgId).length + 1;
    const recNumber = `REC-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
    const newPay: Payment = {
      ...data,
      id: `pay-${Date.now()}`,
      organization_id: orgId,
      receipt_number: recNumber,
      created_at: new Date().toISOString(),
    };
    this.payments.unshift(newPay);

    // Update invoice paid & balance
    const inv = this.invoices.find(i => i.id === data.invoice_id);
    if (inv) {
      inv.paid_amount += data.amount;
      inv.balance_due = Math.max(0, inv.total_amount - inv.paid_amount);
      inv.status = inv.balance_due === 0 ? 'paid' : (inv.paid_amount > 0 ? 'partially_paid' : 'unpaid');
      inv.updated_at = new Date().toISOString();
    }

    // Update cashbox if specified
    if (data.cashbox_id) {
      const cb = this.cashboxes.find(c => c.id === data.cashbox_id);
      if (cb) {
        cb.current_balance += data.amount;
      }
    }

    // Auto-calculate doctor commission if applicable
    if (inv?.doctor_id) {
      const doctor = this.doctors.find(d => d.id === inv.doctor_id);
      if (doctor && doctor.commission_rate > 0) {
        const commAmount = (data.amount * doctor.commission_rate) / 100;
        this.commissions.push({
          id: `com-${Date.now()}`,
          organization_id: orgId,
          branch_id: data.branch_id,
          doctor_id: doctor.id,
          invoice_id: inv.id,
          payment_id: newPay.id,
          amount: commAmount,
          commission_date: new Date().toISOString().split('T')[0],
          is_settled: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    this.logAudit({ orgId, branchId: data.branch_id, action: 'RECORD_PAYMENT', entityType: 'payments', entityId: newPay.id, newValues: { amount: data.amount, receipt: recNumber } });
    this.notify();
    return newPay;
  }

  public getCommissions(orgId: string) {
    return this.commissions
      .filter(c => c.organization_id === orgId)
      .map(c => {
        const doctor = this.doctors.find(d => d.id === c.doctor_id);
        return { ...c, doctor };
      });
  }
}

export const dbClient = new MultiTenantDatabase();
