# ADI Shipment - Automatic COD Processing Flow

## Overview
The ADI Shipment app now automatically creates COD (Cash on Delivery) documents and draft Journal Entries when a Shipment is submitted with COD payment method, similar to the Autowings app flow.

---

## 🚀 What Happens on Shipment Submission

### **Trigger Condition:**
- `payment_method` = "COD"
- `cod_amount` > 0
- Shipment is being submitted

### **Automatic Process:**

#### **Phase 1: COD Document Creation**
When a Shipment is submitted, the system automatically creates a **COD** document with:

**Fields Populated:**
- **Shipment ID**: Link to the Shipment
- **AWB Number**: Tracking number from Shipment
- **Delivery Note**: Extracted from Shipment's delivery note links
- **Sales Order**: Extracted from Delivery Note items
- **Sales Invoice**: Traversed from Delivery Note → Sales Invoice
- **Service Provider**: Courier service provider (e.g., "Shiprocket", "Manual")
- **Carrier Service**: Specific carrier service used
- **COD Amount**: Amount to be collected
- **Status**: "Draft" initially, then "Pending"

---

#### **Phase 2: Draft Journal Entry Creation**

**Only if Sales Invoice is found**, the system creates a **Draft Journal Entry**:

**Journal Entry Details:**
- **Posting Date**: Current date
- **Company**: From Sales Invoice
- **Remark**: "COD Collection for Shipment {name} (AWB: {awb_number})"

**Accounting Entries:**
1. **Debit Entry:**
   - Account: `{Shiprocket/Supplier} Payable - {Company Abbr}`
   - Party Type: Supplier
   - Party: "Shiprocket"
   - Amount: COD Amount
   - Meaning: *Shiprocket owes us this money*

2. **Credit Entry:**
   - Account: `Debtors - {Company Abbr}`
   - Party Type: Customer
   - Party: Customer from Sales Invoice
   - Amount: COD Amount
   - Reference: Sales Invoice
   - Meaning: *Customer has paid via COD*

---

#### **Phase 3: Link Updates**

The COD document is updated with:
- `journal_entry_id`: Link to the created Journal Entry
- `journal_status`: "Draft"
- `status`: "Pending"

---

## 📊 COD Document Status Flow

```
Draft → Pending → Journal Submitted → Paid
```

| Status | Description |
|--------|-------------|
| **Draft** | COD document just created |
| **Pending** | Journal Entry created and linked |
| **Journal Submitted** | User manually submitted the Journal Entry |
| **Paid** | Payment Entry created and linked |
| **Cancelled** | Shipment was cancelled |

---

## 🔄 Shipment Cancellation Flow

### **What Happens:**
When a Shipment with COD is cancelled:

1. **Validation Check:**
   - System checks if the COD's Journal Entry is already submitted
   - If Journal Entry is submitted → **Prevents cancellation** with error message
   - If Journal Entry is still draft → Allows cancellation

2. **COD Status Update:**
   - Updates COD document `status` to "Cancelled"
   - Shows message: "COD Document {name} status updated to Cancelled"

3. **Rollback on Error:**
   - If any error occurs, all changes are rolled back
   - Ensures data integrity

---

## 📋 Document Hierarchy

```
Shipment (COD Payment)
    │
    ├─► COD Document
    │       ├─► Shipment ID
    │       ├─► AWB Number
    │       ├─► Delivery Note
    │       ├─► Sales Order
    │       ├─► Sales Invoice
    │       ├─► Service Provider
    │       ├─► Carrier Service
    │       ├─► COD Amount
    │       └─► Status
    │
    └─► Journal Entry (Draft)
            ├─► Debit: Shiprocket Payable
            └─► Credit: Customer Debtors
```

---

## 🔑 Key Features

### **1. Fully Automatic**
✅ No manual button clicks required  
✅ COD document created on Shipment submission  
✅ Draft Journal Entry created automatically  

### **2. Smart Linking**
✅ Automatically finds Sales Invoice via Delivery Note  
✅ Extracts Sales Order from Delivery Note items  
✅ Links all related documents together  

### **3. Error Handling**
✅ Rollback on any error  
✅ Prevents cancellation if Journal Entry submitted  
✅ Logs errors for debugging  

### **4. Data Integrity**
✅ Transaction-based processing  
✅ Either everything succeeds or nothing is created  
✅ No partial data  

### **5. Supplier Auto-Creation**
✅ Automatically creates "Shiprocket" supplier if doesn't exist  
✅ Sets up correct supplier group and type  

---

## 🎯 User Journey

### **Creating a COD Shipment:**

1. **Create Shipment** from Delivery Note
   - Set `payment_method` = "COD"
   - Enter `cod_amount`
   - Add shipment details (AWB, carrier, etc.)

2. **Submit Shipment**
   - System automatically creates COD document
   - System creates draft Journal Entry
   - Success message shown with COD document name

3. **Verify Journal Entry**
   - Open the linked Journal Entry
   - Review the accounting entries
   - Submit the Journal Entry when ready

4. **Record Payment** (Future)
   - Create Payment Entry
   - Reference the Journal Entry
   - System will update COD status to "Paid"

---

## 📁 Files Created

### **1. COD DocType**
- **Path**: `adi_shipment/adi_shipment/doctype/cod/`
- **Files**:
  - `cod.json` - DocType definition
  - `cod.py` - Python controller
  - `test_cod.py` - Test file
  - `__init__.py` - Module init

### **2. COD Processing Module**
- **Path**: `adi_shipment/api/cod_processing.py`
- **Functions**:
  - `on_submit_shipment_create_cod()` - Main submission handler
  - `on_cancel_shipment_cancel_cod()` - Cancellation handler
  - `create_cod_document()` - COD document creation
  - `create_cod_journal_entry()` - Journal Entry creation
  - `setup_shiprocket_supplier()` - Supplier setup
  - `get_linked_sales_invoice()` - Sales Invoice finder

### **3. Updated Files**
- **hooks.py**: Added COD processing hooks to Shipment events
- **shipment.js**: Removed manual COD accounting buttons

---

## 🔧 Configuration

### **Required Setup:**
1. **Company**: Must have default payable account configured
2. **Shiprocket Supplier**: Auto-created if doesn't exist
3. **Cost Center**: Uses Sales Invoice cost center or "Main"

### **Optional:**
- Custom naming series for COD documents (default: `COD-.YYYY.-.#####`)

---

## ⚠️ Important Notes

### **When COD is NOT Created:**
- If `payment_method` is not "COD"
- If `cod_amount` is 0 or not set
- If Shipment is not submitted

### **When Journal Entry is NOT Created:**
- If Sales Invoice is not found
- COD document is still created, but without Journal Entry
- Warning message shown to user

### **Cancellation Protection:**
- Cannot cancel Shipment if COD's Journal Entry is submitted
- Must cancel Journal Entry first, then Shipment
- Prevents accounting inconsistencies

---

## 🆚 Comparison with Manual Process

### **Before (Manual):**
1. Submit Shipment
2. Click "COD: Pay via Journal" button
3. Confirm action
4. Journal Entry created and submitted immediately

### **After (Automatic):**
1. Submit Shipment
2. ✅ **COD document auto-created**
3. ✅ **Draft Journal Entry auto-created**
4. User verifies and submits Journal Entry when ready

**Benefits:**
- ✅ Better audit trail with COD document
- ✅ Safer - Journal Entry in draft allows verification
- ✅ Consistent with Autowings app flow
- ✅ All documents linked automatically
- ✅ No manual button clicks needed

---

## 📈 Future Enhancements

Potential additions:
- Payment Entry integration to auto-update COD status
- Bulk COD processing
- COD reconciliation reports
- Email notifications on COD creation
- Dashboard for pending CODs

---

## 🐛 Troubleshooting

### **COD Not Created:**
- Check if `payment_method` = "COD"
- Check if `cod_amount` > 0
- Check error logs in Error Log doctype

### **Journal Entry Not Created:**
- Check if Sales Invoice exists
- Check if Delivery Note is linked
- Verify company has default payable account

### **Cannot Cancel Shipment:**
- Check if Journal Entry is submitted
- Cancel Journal Entry first
- Then cancel Shipment

---

## ✅ Summary

The ADI Shipment app now provides **fully automated COD processing** that:

✅ Creates COD documents automatically on Shipment submission  
✅ Generates draft Journal Entries for accounting  
✅ Links all related documents (Shipment, Delivery Note, Sales Order, Sales Invoice)  
✅ Tracks COD status through the entire lifecycle  
✅ Prevents data inconsistencies with cancellation protection  
✅ Maintains audit trail with proper document linking  
✅ Follows the same proven pattern as Autowings app  

**No more manual button clicks - everything happens automatically!**
