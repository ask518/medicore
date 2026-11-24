// ============================================================================
// MEDICORE – Pharmacy & Medical Inventory Management Module
// Stock Levels, Batch/Expiry Alerts, Suppliers & Atomic Stock Movement Ledger
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { InventoryItem, InventoryMovement, InventoryMovementType, Supplier } from '../../types/database';
import {
  Package, Plus, AlertTriangle, Calendar, DollarSign, Truck,
  ArrowUpRight, ArrowDownLeft, Search, Filter, RefreshCw,
  CheckCircle2, Phone, Mail, Layers
} from 'lucide-react';

const CATEGORIES = [
  { id: 'Medication', ar: 'أدوية وصيدلية', en: 'Medication' },
  { id: 'Consumable', ar: 'مستهلكات طبية', en: 'Consumable' },
  { id: 'Surgical', ar: 'مستلزمات جراحية', en: 'Surgical' },
  { id: 'Dental', ar: 'مستلزمات أسنان', en: 'Dental' },
  { id: 'Lab Reagent', ar: 'محاليل ومستلزمات معمل', en: 'Lab Reagent' },
];

export const Inventory: React.FC = () => {
  const { organization, activeBranch, can } = useAuth();
  const { locale } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const branchId = activeBranch?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const canCreate = can('inventory', 'create') || can('inventory', 'edit');

  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'suppliers'>('stock');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'low_stock' | 'expiring'>('all');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [movementTarget, setMovementTarget] = useState<InventoryItem | null>(null);

  // New Item Form
  const [sku, setSku] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('Medication');
  const [initQty, setInitQty] = useState('0');
  const [reorderThreshold, setReorderThreshold] = useState('10');
  const [unit, setUnit] = useState('box');
  const [unitCost, setUnitCost] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Movement Form
  const [moveType, setMoveType] = useState<InventoryMovementType>('purchase');
  const [moveQty, setMoveQty] = useState('1');
  const [movePrice, setMovePrice] = useState('0');
  const [moveRef, setMoveRef] = useState('');
  const [moveNotes, setMoveNotes] = useState('');

  // Supplier Form
  const [supNameAr, setSupNameAr] = useState('');
  const [supNameEn, setSupNameEn] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supTaxId, setSupTaxId] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let itemQuery = supabase
        .from('inventory_items')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name_ar');
      if (branchId) itemQuery = itemQuery.eq('branch_id', branchId);

      const [itemRes, movRes, supRes] = await Promise.all([
        itemQuery,
        supabase
          .from('inventory_movements')
          .select('*, item:inventory_items(sku, name_ar, name_en, unit)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('suppliers')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
      ]);

      if (itemRes.error) throw itemRes.error;
      setItems((itemRes.data || []) as InventoryItem[]);
      setMovements((movRes.data || []) as unknown as InventoryMovement[]);
      setSuppliers((supRes.data || []) as Supplier[]);
    } catch (err) {
      console.error('Inventory load error:', err);
      error(ar ? 'تعذر تحميل بيانات المخزون والصيدلية.' : 'Unable to load inventory records.');
    } finally {
      setLoading(false);
    }
  }, [orgId, branchId, ar, error]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !branchId || !sku.trim() || !nameAr.trim()) {
      error(ar ? 'يرجى تحديد الفرع النشط، الكود (SKU)، واسم الصنف.' : 'Active branch, SKU, and name are required.');
      return;
    }
    setSaving(true);
    const { error: insertErr } = await supabase.from('inventory_items').insert({
      organization_id: orgId,
      branch_id: branchId,
      sku: sku.trim().toUpperCase(),
      name_ar: nameAr.trim(),
      name_en: nameEn.trim() || nameAr.trim(),
      category,
      current_quantity: Math.max(0, parseInt(initQty, 10) || 0),
      reorder_threshold: Math.max(0, parseInt(reorderThreshold, 10) || 10),
      unit: unit.trim() || 'piece',
      unit_cost: Number(unitCost) || 0,
      selling_price: Number(sellingPrice) || 0,
      batch_number: batchNumber.trim() || null,
      expiry_date: expiryDate || null,
      is_active: true,
    });
    setSaving(false);

    if (insertErr) {
      error(insertErr.code === '23505'
        ? (ar ? 'كود الصنف (SKU) مسجل مسبقاً في هذا الفرع.' : 'SKU already exists in this branch.')
        : (ar ? 'تعذر حفظ الصنف.' : 'Could not save inventory item.'));
      return;
    }

    success(ar ? 'تمت إضافة الصنف للمخزون بنجاح' : 'Inventory item added');
    setShowItemModal(false);
    setSku(''); setNameAr(''); setNameEn(''); setInitQty('0'); setBatchNumber(''); setExpiryDate('');
    await loadData();
  };

  const openMovementModal = (item: InventoryItem, defaultType: InventoryMovementType = 'purchase') => {
    setMovementTarget(item);
    setMoveType(defaultType);
    setMoveQty('1');
    setMovePrice(String(defaultType === 'purchase' ? item.unit_cost : item.selling_price));
    setMoveRef('');
    setMoveNotes('');
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !movementTarget) return;
    const qty = parseInt(moveQty, 10);
    if (!qty || qty <= 0) {
      error(ar ? 'الكمية يجب أن تكون أكبر من صفر.' : 'Quantity must be positive.');
      return;
    }

    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('record_inventory_movement', {
      p_item_id: movementTarget.id,
      p_movement_type: moveType,
      p_quantity: qty,
      p_unit_price: Number(movePrice) || 0,
      p_reference_id: moveRef.trim() || null,
      p_notes: moveNotes.trim() || null,
    });
    setSaving(false);

    if (rpcErr) {
      error(rpcErr.message || (ar ? 'تعذر تنفيذ حركة المخزون.' : 'Could not record stock movement.'));
      return;
    }

    success(ar ? 'تم قيد حركة المخزون وتحديث الرصيد بنجاح' : 'Stock movement recorded');
    setMovementTarget(null);
    await loadData();
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !supNameAr.trim()) return;
    setSaving(true);
    const { error: insertErr } = await supabase.from('suppliers').insert({
      organization_id: orgId,
      name_ar: supNameAr.trim(),
      name_en: supNameEn.trim() || supNameAr.trim(),
      contact_person: supContact.trim() || null,
      phone: supPhone.trim() || null,
      email: supEmail.trim() || null,
      tax_id: supTaxId.trim() || null,
      is_active: true,
    });
    setSaving(false);

    if (insertErr) {
      error(ar ? 'تعذر حفظ بيانات المورد.' : 'Could not save supplier.');
      return;
    }

    success(ar ? 'تمت إضافة المورد بنجاح' : 'Supplier added');
    setShowSupplierModal(false);
    setSupNameAr(''); setSupNameEn(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupTaxId('');
    await loadData();
  };

  if (!organization) return null;

  const now = new Date();
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const isExpiringOrExpired = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (d < now) return 'expired';
    if (d <= sixtyDaysFromNow) return 'expiring';
    return 'ok';
  };

  // Metrics
  const totalValuation = items.reduce((sum, i) => sum + Number(i.current_quantity) * Number(i.unit_cost), 0);
  const lowStockCount = items.filter(i => i.current_quantity <= i.reorder_threshold).length;
  const expiringCount = items.filter(i => {
    const st = isExpiringOrExpired(i.expiry_date);
    return st === 'expired' || st === 'expiring';
  }).length;

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (alertFilter === 'low_stock' && item.current_quantity > item.reorder_threshold) return false;
    if (alertFilter === 'expiring') {
      const st = isExpiringOrExpired(item.expiry_date);
      if (st !== 'expired' && st !== 'expiring') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.sku.toLowerCase().includes(q) && !item.name_ar.toLowerCase().includes(q) && !item.name_en.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const movementLabel = (type: InventoryMovementType) => {
    switch (type) {
      case 'purchase': return { label: ar ? 'توريد / شراء (+)' : 'Purchase (+)', cls: 'bg-emerald-100 text-emerald-800' };
      case 'dispense': return { label: ar ? 'صرف إكلينيكي (-)' : 'Dispense (-)', cls: 'bg-sky-100 text-sky-800' };
      case 'transfer_in': return { label: ar ? 'تحويل وارد (+)' : 'Transfer In (+)', cls: 'bg-teal-100 text-teal-800' };
      case 'transfer_out': return { label: ar ? 'تحويل صادر (-)' : 'Transfer Out (-)', cls: 'bg-indigo-100 text-indigo-800' };
      case 'damage': return { label: ar ? 'تالف / منتهي (-)' : 'Damage/Expired (-)', cls: 'bg-rose-100 text-rose-800' };
      case 'adjustment': return { label: ar ? 'جرد وتعديل رصيد' : 'Adjustment', cls: 'bg-amber-100 text-amber-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <span>{ar ? 'الصيدلية والمخازن الطبية' : 'Pharmacy & Medical Inventory'}</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {ar
              ? 'إدارة الأدوية والمستهلكات الطبية، تتبع التشغيلات وتواريخ الصلاحية، وتنبيهات النواقص'
              : 'Medications, clinical consumables, batch/expiry tracking, low-stock alerts, and suppliers'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title={ar ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && activeTab === 'suppliers' && (
            <button
              type="button"
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{ar ? 'إضافة مورد جديد' : 'Add Supplier'}</span>
            </button>
          )}
          {canCreate && activeTab !== 'suppliers' && (
            <button
              type="button"
              onClick={() => setShowItemModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{ar ? 'إضافة صنف دوائي / مستلزم' : 'Add Inventory Item'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'الأصناف النشطة (الفرع)' : 'Active SKUs'}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{items.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{suppliers.length} {ar ? 'موردون مسجلون' : 'Suppliers'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'تقييم المخزون (بالتكلفة)' : 'Inventory Valuation'}</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-1">{totalValuation.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{currency}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'تنبيهات حد الطلب (نواقص)' : 'Low-Stock Alerts'}</p>
            <p className={`text-2xl font-black mt-1 ${lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{lowStockCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{ar ? 'أصناف وصلت للحد الأدنى' : 'Below threshold'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">{ar ? 'صلاحية منتهية / قريبة' : 'Expiring / Expired'}</p>
            <p className={`text-2xl font-black mt-1 ${expiringCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{expiringCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{ar ? 'خلال 60 يوم أو منتهي' : 'Within 60 days'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'stock'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{ar ? 'أرصدة الصيدلية والمخزون' : 'Stock Levels'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'movements'
              ? 'bg-medicore-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>{ar ? 'سجل حركات التوريد والصرف' : 'Stock Movements'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{ar ? 'الموردون وشركات الأدوية' : 'Suppliers'}</span>
        </button>
      </div>

      {/* TAB 1: STOCK */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={ar ? 'بحث بالكود (SKU) أو اسم الدواء / المستلزم...' : 'Search by SKU or item name...'}
                className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">{ar ? 'جميع التصنيفات' : 'All Categories'}</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>)}
              </select>

              <select
                value={alertFilter}
                onChange={e => setAlertFilter(e.target.value as any)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">{ar ? 'كل الأرصدة' : 'All Stock'}</option>
                <option value="low_stock">{ar ? 'النواقص فقط (حد الطلب)' : 'Low Stock Only'}</option>
                <option value="expiring">{ar ? 'قريب الانتهاء / منتهي' : 'Expiring / Expired'}</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 text-start">SKU</th>
                    <th className="p-3.5 text-start">{ar ? 'الصنف' : 'Item'}</th>
                    <th className="p-3.5 text-center">{ar ? 'التصنيف' : 'Category'}</th>
                    <th className="p-3.5 text-center">{ar ? 'التشغيلة والصلاحية' : 'Batch & Expiry'}</th>
                    <th className="p-3.5 text-center">{ar ? 'الرصيد الحالي' : 'Current Qty'}</th>
                    <th className="p-3.5 text-center">{ar ? 'التكلفة / البيع' : 'Cost / Price'}</th>
                    <th className="p-3.5 text-center">{ar ? 'حركة المخزون' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-400">{ar ? 'جارٍ تحميل المخزون...' : 'Loading stock...'}</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-400">{ar ? 'لا توجد أصناف مطابقة.' : 'No inventory items found.'}</td></tr>
                  ) : (
                    filteredItems.map(item => {
                      const isLow = item.current_quantity <= item.reorder_threshold;
                      const expState = isExpiringOrExpired(item.expiry_date);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="p-3.5 font-mono font-bold text-slate-700">{item.sku}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{ar ? item.name_ar : item.name_en}</div>
                            <div className="text-[10px] text-slate-400">{ar ? item.name_en : item.name_ar}</div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono text-[11px]">
                            {item.batch_number && <div className="text-slate-600">{item.batch_number}</div>}
                            {item.expiry_date ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                expState === 'expired' ? 'bg-rose-100 text-rose-800'
                                : expState === 'expiring' ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-500'
                              }`}>
                                {item.expiry_date}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-mono font-black ${
                              isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.current_quantity} {item.unit}
                            </span>
                            {isLow && <div className="text-[10px] text-rose-600 font-bold mt-0.5">{ar ? `حد الطلب: ${item.reorder_threshold}` : `Min: ${item.reorder_threshold}`}</div>}
                          </td>
                          <td className="p-3.5 text-center font-mono">
                            <div className="text-slate-500">{Number(item.unit_cost).toLocaleString()} {currency}</div>
                            <div className="font-bold text-slate-900">{Number(item.selling_price).toLocaleString()} {currency}</div>
                          </td>
                          <td className="p-3.5 text-center">
                            {canCreate && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openMovementModal(item, 'purchase')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>{ar ? 'توريد' : 'In'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openMovementModal(item, 'dispense')}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1"
                                >
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>{ar ? 'صرف' : 'Out'}</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الصنف' : 'Item'}</th>
                  <th className="p-3.5 text-center">{ar ? 'نوع الحركة' : 'Type'}</th>
                  <th className="p-3.5 text-center">{ar ? 'الكمية' : 'Qty'}</th>
                  <th className="p-3.5 text-center">{ar ? 'سعر الوحدة' : 'Unit Price'}</th>
                  <th className="p-3.5 text-start">{ar ? 'المرجع والملاحظات' : 'Reference & Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400">{ar ? 'لا توجد حركات مسجلة بعد.' : 'No stock movements recorded yet.'}</td></tr>
                ) : (
                  movements.map(m => {
                    const badge = movementLabel(m.movement_type);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">
                          {new Date(m.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{m.item ? (ar ? m.item.name_ar : m.item.name_en) : '—'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{m.item?.sku}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-black text-slate-900">{m.quantity} {m.item?.unit}</td>
                        <td className="p-3.5 text-center font-mono">{Number(m.unit_price).toLocaleString()} {currency}</td>
                        <td className="p-3.5 text-slate-600">
                          {m.reference_id && <span className="font-mono text-[11px] font-bold text-indigo-700 me-2">#{m.reference_id}</span>}
                          <span>{m.notes || '—'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              {ar ? 'لم يتم تسجيل موردين بعد.' : 'No suppliers registered yet.'}
            </div>
          ) : (
            suppliers.map(sup => (
              <div key={sup.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">{ar ? sup.name_ar : sup.name_en}</h3>
                    <p className="text-[11px] text-slate-500">{ar ? sup.name_en : sup.name_ar}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 inline me-1" />
                    {ar ? 'معتمد' : 'Active'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  {sup.contact_person && <div>{ar ? 'المندوب:' : 'Contact:'} <strong>{sup.contact_person}</strong></div>}
                  {sup.phone && <div className="flex items-center gap-1.5 font-mono text-[11px]"><Phone className="w-3.5 h-3.5 text-slate-400" />{sup.phone}</div>}
                  {sup.email && <div className="flex items-center gap-1.5 text-[11px]"><Mail className="w-3.5 h-3.5 text-slate-400" />{sup.email}</div>}
                  {sup.tax_id && <div className="text-[11px] font-mono text-slate-400">{ar ? 'الرقم الضريبي:' : 'Tax ID:'} {sup.tax_id}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: ADD ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
            <h3 className="font-black text-slate-900 text-base mb-4">{ar ? 'إضافة صنف جديد للمخزون / الصيدلية' : 'Add New Inventory Item'}</h3>
            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU *</label>
                  <input required value={sku} onChange={e => setSku(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" placeholder="MED-001" />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'التصنيف *' : 'Category *'}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'اسم الصنف بالعربية *' : 'Arabic Name *'}</label>
                  <input required value={nameAr} onChange={e => setNameAr(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="أوجمنتين 1 جم أقراص" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                  <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="Augmentin 1g Tabs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الرصيد الافتتاحي' : 'Initial Qty'}</label>
                  <input type="number" min="0" value={initQty} onChange={e => setInitQty(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'حد الطلب' : 'Reorder At'}</label>
                  <input type="number" min="0" value={reorderThreshold} onChange={e => setReorderThreshold(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الوحدة' : 'Unit'}</label>
                  <input value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="box / piece" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'تكلفة الوحدة' : 'Unit Cost'}</label>
                  <input type="number" step="0.01" min="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'سعر البيع / الصرف' : 'Selling Price'}</label>
                  <input type="number" step="0.01" min="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'رقم التشغيلة (Batch)' : 'Batch #'}</label>
                  <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'تاريخ انتهاء الصلاحية' : 'Expiry Date'}</label>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">{saving ? '...' : (ar ? 'حفظ الصنف' : 'Save Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK MOVEMENT */}
      {movementTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-1">{ar ? 'تسجيل حركة مخزون' : 'Record Stock Movement'}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {ar ? movementTarget.name_ar : movementTarget.name_en} ({ar ? 'الرصيد الحالي:' : 'Current:'} <strong className="font-mono">{movementTarget.current_quantity} {movementTarget.unit}</strong>)
            </p>
            <form onSubmit={handleRecordMovement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'نوع الحركة *' : 'Movement Type *'}</label>
                <select value={moveType} onChange={e => setMoveType(e.target.value as InventoryMovementType)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold">
                  <option value="purchase">{ar ? 'توريد / فاتورة شراء (+)' : 'Purchase (+)'}</option>
                  <option value="dispense">{ar ? 'صرف إكلينيكي / مريض (-)' : 'Dispense (-)'}</option>
                  <option value="transfer_in">{ar ? 'تحويل وارد من فرع (+)' : 'Transfer In (+)'}</option>
                  <option value="transfer_out">{ar ? 'تحويل صادر لفرع (-)' : 'Transfer Out (-)'}</option>
                  <option value="damage">{ar ? 'إهلاك / منتهي الصلاحية (-)' : 'Damage / Expired (-)'}</option>
                  <option value="adjustment">{ar ? 'جرد وتعديل الرصيد الفعلي' : 'Physical Count Adjustment'}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{moveType === 'adjustment' ? (ar ? 'الرصيد الفعلي الجديد *' : 'New Physical Count *') : (ar ? 'الكمية *' : 'Quantity *')}</label>
                  <input type="number" min="1" required value={moveQty} onChange={e => setMoveQty(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'سعر الوحدة' : 'Unit Price'}</label>
                  <input type="number" step="0.01" min="0" value={movePrice} onChange={e => setMovePrice(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'رقم مرجعي (فاتورة شراء / روشتة)' : 'Reference ID'}</label>
                <input value={moveRef} onChange={e => setMoveRef(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" placeholder="PO-2026-..." />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'ملاحظات' : 'Notes'}</label>
                <input value={moveNotes} onChange={e => setMoveNotes(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setMovementTarget(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-medicore-600 hover:bg-medicore-700 text-white font-bold">{saving ? '...' : (ar ? 'اعتماد الحركة' : 'Commit Movement')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-black text-slate-900 text-base mb-4">{ar ? 'إضافة مورد جديد' : 'Add Supplier'}</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'اسم المورد بالعربية *' : 'Supplier Name AR *'}</label>
                <input required value={supNameAr} onChange={e => setSupNameAr(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" placeholder="الشركة المتحدة للأدوية" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{ar ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                <input value={supNameEn} onChange={e => setSupNameEn(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'المندوب' : 'Contact'}</label>
                  <input value={supContact} onChange={e => setSupContact(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الهاتف' : 'Phone'}</label>
                  <input value={supPhone} onChange={e => setSupPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'البريد الإلكتروني' : 'Email'}</label>
                  <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{ar ? 'الرقم الضريبي' : 'Tax ID'}</label>
                  <input value={supTaxId} onChange={e => setSupTaxId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{saving ? '...' : (ar ? 'حفظ المورد' : 'Save Supplier')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
