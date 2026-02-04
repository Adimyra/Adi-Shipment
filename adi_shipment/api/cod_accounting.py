import frappe
from frappe import _

@frappe.whitelist()
def process_cod_journal_only(shipment_name):
    """
    Method 1: Direct Transfer via Journal Entry.
    Credit Customer | Debit Supplier (Directly on Ledger, no Invoice doc)
    """
    doc = frappe.get_doc("Shipment", shipment_name)
    si_name, si_doc = get_linked_sales_invoice(doc)
    
    if not si_name:
        frappe.throw("No linked Sales Invoice found for this Shipment.")
    if si_doc.status == "Paid":
        frappe.msgprint(f"Sales Invoice {si_name} is already Paid.")
        return

    setup_master_data(si_doc.company)
    create_journal_entry_transfer(si_doc, shipment_name)


@frappe.whitelist()
def process_cod_invoice_flow(shipment_name):
    """
    Method 2: Two-Step Flow.
    1. JV to clear Customer against Clearing Account.
    2. Purchase Invoice (Debit Note) to debit Supplier against Clearing Account.
    (Creates a visible 'Invoice' document for the Supplier debt)
    """
    doc = frappe.get_doc("Shipment", shipment_name)
    si_name, si_doc = get_linked_sales_invoice(doc)
    
    if not si_name:
        frappe.throw("No linked Sales Invoice found for this Shipment.")
    if si_doc.status == "Paid":
        frappe.msgprint(f"Sales Invoice {si_name} is already Paid.")
        return

    setup_master_data(si_doc.company)
    create_cod_adjustment_docs(si_doc, shipment_name)


# ---------------- INTERNAL HELPERS ---------------- #

def get_linked_sales_invoice(shipment_doc):
    """
    Traverses Shipment -> Delivery Note -> Sales Invoice
    """
    if not shipment_doc.shipment_delivery_note:
        return None, None
        
    for link in shipment_doc.shipment_delivery_note:
        dn_doc = frappe.get_doc("Delivery Note", link.delivery_note)
        
        # Method A: Check Items for link
        for item in dn_doc.items:
            if item.against_sales_invoice:
                return item.against_sales_invoice, frappe.get_doc("Sales Invoice", item.against_sales_invoice)
        
        # Method B: Check 'Sales Invoice Item' table if not directly linked in item
        si_items = frappe.get_all("Sales Invoice Item", filters={"delivery_note": link.delivery_note}, fields=["parent"])
        if si_items:
            si_name = si_items[0].parent
            return si_name, frappe.get_doc("Sales Invoice", si_name)
            
    return None, None


def setup_master_data(company):
    """
    Ensures Shiprocket Supplier exists.
    """
    # 1. Create Supplier 'Shiprocket'
    if not frappe.db.exists("Supplier", "Shiprocket"):
        supp = frappe.new_doc("Supplier")
        supp.supplier_name = "Shiprocket"
        supp.supplier_group = "Services"
        supp.supplier_type = "Company"
        supp.insert(ignore_permissions=True)
        frappe.msgprint("Created Supplier: Shiprocket")


def create_journal_entry_transfer(si_doc, shipment_name):
    """
    Creates a Journal Entry to transfer the outstanding amount from Customer to Shiprocket Supplier.
    Credit: Customer (Reduces receivable from Customer)
    Debit: Supplier (Creates receivable/debit balance on Shiprocket)
    """
    amount = si_doc.outstanding_amount
    if amount <= 0:
        frappe.msgprint("Invoice is already paid or zero. No Journal Entry needed.")
        return

    company_currency = frappe.get_value("Company", si_doc.company, "default_currency")
    
    # Get Default Accounts
    try:
        debtors_account = si_doc.debit_to # Customer's Account
        
        # Use standard ERPNext utility to find the correct Payable Account
        # This checks Supplier defaults, Company defaults, and child tables automatically.
        from erpnext.accounts.party import get_party_account
        creditors_account = get_party_account("Supplier", "Shiprocket", si_doc.company)
            
        if not creditors_account:
            # Final Fallback to Company Default if utility fails for some reason
            creditors_account = frappe.get_value("Company", si_doc.company, "default_payable_account")

        if not creditors_account:
            frappe.throw(f"Could not find a Creditors Account (Payable) for Shiprocket in Company {si_doc.company}. Please set a default Payable Account in Company settings.")
            
    except Exception as e:
        frappe.throw(f"Error fetching accounts: {str(e)}")

    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.posting_date = frappe.utils.nowdate()
    je.company = si_doc.company
    je.remark = f"Transfer COD Balance from Customer to Shiprocket for Shipment {shipment_name}"
    
    # Row 1: Debit Supplier (Shiprocket owes us this money now)
    je.append("accounts", {
        "account": creditors_account,
        "party_type": "Supplier",
        "party": "Shiprocket",
        "debit_in_account_currency": amount,
        "credit_in_account_currency": 0,
        "user_remark": f"COD Collected for Sales Invoice {si_doc.name}", # Reference in remark, not link (avoid validation error)
        "cost_center": si_doc.items[0].cost_center if si_doc.items else None 
    })
    
    # Row 2: Credit Customer (Customer has paid)
    je.append("accounts", {
        "account": debtors_account,
        "party_type": "Customer",
        "party": si_doc.customer,
        "debit_in_account_currency": 0,
        "credit_in_account_currency": amount,
        "reference_type": "Sales Invoice",
        "reference_name": si_doc.name,
        "cost_center": si_doc.items[0].cost_center if si_doc.items else None
    })
    
    je.insert(ignore_permissions=True)
    je.submit()
    
    frappe.msgprint(f"Successfully created Journal Entry: <a href='/app/journal-entry/{je.name}'>{je.name}</a><br>Customer Balance Cleared. Amount now pending with Shiprocket.")


# ---------------- METHOD 2 HELPERS ---------------- #

def create_cod_adjustment_docs(si_doc, shipment_name):
    """
    Two-Step Accounting:
    1. Journal Entry: Credit Customer | Debit Temporary Clearing Account.
       (Effect: Customer is paid. Money is in 'Holding').
    2. Purchase Invoice (Debit Note): Debit Supplier | Credit Temporary Clearing Account.
       (Effect: Shiprocket owes us. Money moves from 'Holding' to Supplier Debt).
    """
    amount = si_doc.outstanding_amount
    if amount <= 0:
        frappe.msgprint("Invoice is already paid or zero. No adjustment needed.")
        return

    # 1. Get/Create Clearing Account
    clearing_account = get_clearing_account(si_doc.company)
    
    # 2. Step 1: Journal Entry (Customer -> Clearing)
    jv = frappe.new_doc("Journal Entry")
    jv.voucher_type = "Journal Entry"
    jv.posting_date = frappe.utils.nowdate()
    jv.company = si_doc.company
    jv.remark = f"COD Collection for {si_doc.name} (Step 1: Clear Customer)"
    
    # Debit Clearing Account
    jv.append("accounts", {
        "account": clearing_account,
        "debit_in_account_currency": amount,
        "credit_in_account_currency": 0,
        "cost_center": si_doc.items[0].cost_center if si_doc.items else None 
    })
    
    # Credit Customer (Mark Invoice Paid)
    jv.append("accounts", {
        "account": si_doc.debit_to,
        "party_type": "Customer",
        "party": si_doc.customer,
        "debit_in_account_currency": 0,
        "credit_in_account_currency": amount,
        "reference_type": "Sales Invoice",
        "reference_name": si_doc.name,
        "cost_center": si_doc.items[0].cost_center if si_doc.items else None 
    })
    
    jv.insert(ignore_permissions=True)
    jv.submit()
    
    # 3. Step 2: Purchase Invoice Debit Note (Clearing -> Supplier)
    create_purchase_debit_note(si_doc, shipment_name, amount, clearing_account)
    
    frappe.msgprint(f"<b>Success!</b><br>1. Customer Invoice Cleared via JV <a href='/app/journal-entry/{jv.name}'>{jv.name}</a>.<br>2. Supplier Debt Record Created via Debit Note.")


def get_clearing_account(company):
    """Find or Create 'Shiprocket COD Clearing' account"""
    account_name = "Shiprocket COD Clearing"
    company_abbr = frappe.get_value("Company", company, "abbr")
    full_name = f"{account_name} - {company_abbr}"
    
    existing = frappe.db.exists("Account", full_name)
    if existing: return existing
    
    # Create if missing
    parent = frappe.db.get_value("Account", {"company": company, "is_group": 1, "root_type": "Asset", "account_name": "Current Assets"}, "name")
    if not parent:
         parent = frappe.db.get_value("Account", {"company": company, "is_group": 1, "root_type": "Asset"}, "name")
         
    acct = frappe.new_doc("Account")
    acct.account_name = account_name
    acct.parent_account = parent
    acct.company = company
    acct.account_type = "Bank" # Needed to be selectable in some views
    acct.insert(ignore_permissions=True)
    return acct.name


def create_purchase_debit_note(si_doc, shipment_name, amount, clearing_account):
    """Creates a Purchase Invoice (Is Return) against Shiprocket"""
    
    # Ensure a Generic Service Item exists for this financial adjustment
    # We use this instead of real stock items to avoid "Stock Received But Not Billed" accounting issues
    service_item = "COD-ADJUSTMENT"
    if not frappe.db.exists("Item", service_item):
        item = frappe.new_doc("Item")
        item.item_code = service_item
        item.item_name = "COD Adjustment (Financial)"
        item.item_group = "Services" # or All Item Groups
        item.is_stock_item = 0
        item.is_purchase_item = 1
        item.gst_hsn_code = "999799" # Default, will be overridden per line
        item.insert(ignore_permissions=True)

    pi = frappe.new_doc("Purchase Invoice")
    pi.is_return = 1 # Return = Debit Note
    pi.supplier = "Shiprocket"
    pi.company = si_doc.company
    pi.posting_date = frappe.utils.nowdate()
    pi.currency = frappe.get_value("Company", si_doc.company, "default_currency")
    pi.conversion_rate = 1
    pi.update_stock = 0 # Explicitly ensure no stock impact
    
    # Copy items from Sales Invoice, but use the Service Item Code
    # We copy Description + HSN to ensure Tax/Compliance matches exactly
    for item in si_doc.items:
        pi.append("items", {
            "item_code": service_item,         # Use Service Item to avoid Stock Acc entries
            "item_name": item.item_name,       # Keep original name
            "description": item.description,   # Keep original description
            "qty": -1 * abs(item.qty), 
            "rate": item.rate,
            "uom": item.uom,
            "conversion_factor": 1,
            "expense_account": clearing_account, # Correctly hits the Clearing Account
            "cost_center": item.cost_center,
            "gst_hsn_code": item.gst_hsn_code  # Important: Copy HSN from original item
        })
    
    pi.save(ignore_permissions=True)
    pi.submit()
    
    frappe.msgprint(f"Created Invoice for Supplier: <a href='/app/purchase-invoice/{pi.name}'>{pi.name}</a>")
