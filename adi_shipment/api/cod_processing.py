import frappe
from frappe import _
from frappe.utils import getdate


def on_submit_shipment_create_cod(doc, method):
    """
    On Submit Hook for Shipment:
    - Creates COD document if payment_method is COD
    - Creates draft Journal Entry
    - Links all related documents (Delivery Note, Sales Order, Sales Invoice)
    - Updates COD document with journal_entry_id
    """
    # Only process if payment method is COD
    if doc.payment_method != "COD":
        return
    
    # Get COD amount from value_of_goods
    cod_amount = doc.value_of_goods or 0
    if cod_amount <= 0:
        frappe.msgprint("COD amount is 0. Skipping COD document creation.", indicator="orange")
        return

    try:
        # Get linked Sales Invoice
        si_name, si_doc = get_linked_sales_invoice(doc)
        
        if not si_name:
            frappe.log_error(
                f"No linked Sales Invoice found for Shipment {doc.name}",
                "COD Creation - No Sales Invoice"
            )
            # Continue anyway, we can still create COD without Sales Invoice
        
        # Get Delivery Note
        delivery_note = None
        sales_order = None
        
        if doc.shipment_delivery_note and len(doc.shipment_delivery_note) > 0:
            delivery_note = doc.shipment_delivery_note[0].delivery_note
            
            # Try to get Sales Order from Delivery Note items
            if delivery_note:
                dn_doc = frappe.get_doc("Delivery Note", delivery_note)
                for item in dn_doc.items:
                    if item.against_sales_order:
                        sales_order = item.against_sales_order
                        break
        
        # Check Shipment's own Sales Order links if DN didn't have any
        if not sales_order and hasattr(doc, "shipment_sales_order") and doc.shipment_sales_order:
             sales_order = doc.shipment_sales_order[0].sales_order
        elif not sales_order and hasattr(doc, "sales_order") and doc.sales_order:
             sales_order = doc.sales_order
        
        # Create COD Document
        cod_doc_name = create_cod_document(
            doc=doc,
            delivery_note=delivery_note,
            sales_order=sales_order,
            sales_invoice=si_name,
            cod_amount=cod_amount
        )
        
        # Always create Draft Journal Entry (use Sales Order if Sales Invoice not found)
        je_name = create_cod_journal_entry(
            doc, 
            si_doc, 
            sales_order,
            cod_doc_name, 
            cod_amount
        )
        
        # Update COD document with journal_entry_id
        cod_doc = frappe.get_doc("COD", cod_doc_name)
        cod_doc.journal_entry_id = je_name
        cod_doc.journal_status = "Draft"
        cod_doc.status = "Pending"
        cod_doc.save()
        
        # Create rich success message with links
        awb_info = f"AWB: {doc.awb_number}" if doc.awb_number else "AWB: Pending"
        carrier_info = f" via {doc.carrier_service}" if doc.carrier_service else ""
        
        message = f"""
        <div style="margin-bottom: 10px;">
            <strong>✅ Shipment Submitted Successfully</strong>
        </div>
        <div style="margin-bottom: 8px;">
            📦 Shipment: <a href="/app/shipment/{doc.name}" style="font-weight: bold;">{doc.name}</a>
        </div>
        <div style="margin-bottom: 8px;">
            🚚 {awb_info}{carrier_info}
        </div>
        <div style="margin-bottom: 8px;">
            💰 COD Document: <a href="/app/cod/{cod_doc_name}" style="font-weight: bold; color: #2490ef;">{cod_doc_name}</a>
        </div>
        <div style="margin-bottom: 8px;">
            📝 Journal Entry (Draft): <a href="/app/journal-entry/{je_name}" style="font-weight: bold; color: #2490ef;">{je_name}</a>
        </div>
        <div style="margin-top: 12px; padding: 8px; background-color: #f0f4f7; border-left: 3px solid #2490ef;">
            <small>💡 Next Step: Open COD document and click <strong>"Verify COD"</strong> to submit the Journal Entry</small>
        </div>
        """
        
        frappe.msgprint(
            message,
            title="COD Processing Complete",
            indicator="green",
            as_list=False
        )
        
        # No explicit commit here to allow atomic transaction with Shipment submission
        pass
        
    except Exception as e:
        # Log error but don't block shipment submission
        frappe.log_error(
            f"Error creating COD for Shipment {doc.name}: {str(e)}\\n\\nTraceback:\\n{frappe.get_traceback()}",
            "COD Creation Error"
        )
        frappe.msgprint(
            f"Warning: Shipment submitted but COD document creation failed. Check Error Log for details.",
            title="COD Creation Failed",
            indicator="orange"
        )
        # Don't throw - allow shipment to be submitted anyway


def on_cancel_shipment_cancel_cod(doc, method):
    """
    On Cancel Hook for Shipment:
    - Automatically cancels Journal Entry if submitted
    - Cancels related COD document
    - Updates status to Cancelled
    """
    # Only process if payment method is COD
    if doc.payment_method != "COD":
        return
    
    try:
        # Find COD document linked to this shipment
        cod_docs = frappe.get_all(
            "COD",
            filters={"shipment_id": doc.name},
            fields=["name", "journal_entry_id", "journal_status", "sales_invoice", "sales_order"]
        )
        
        if not cod_docs:
            return
        
        for cod in cod_docs:
            cod_doc = frappe.get_doc("COD", cod.name)
            
            # If Journal Entry is submitted, cancel it first
            if cod.journal_status == "Submitted" and cod.journal_entry_id:
                try:
                    je_doc = frappe.get_doc("Journal Entry", cod.journal_entry_id)
                    
                    if je_doc.docstatus == 1:  # Submitted
                        # Cancel the Journal Entry
                        je_doc.flags.ignore_permissions = True
                        je_doc.cancel()
                        
                        frappe.msgprint(
                            f"Journal Entry {je_doc.name} cancelled automatically",
                            indicator="orange"
                        )
                        
                        # Update COD journal status using db_set
                        cod_doc.db_set("journal_status", "Cancelled")
                        
                    elif je_doc.docstatus == 0: # Draft
                        # Delete the Draft Journal Entry
                        frappe.delete_doc("Journal Entry", je_doc.name, ignore_permissions=True)
                        
                        frappe.msgprint(
                            f"Draft Journal Entry {je_doc.name} deleted automatically",
                            indicator="orange"
                        )
                        
                        # Update COD journal status to None/Empty or Cancelled
                        cod_doc.db_set("journal_status", "Cancelled")
                        cod_doc.db_set("journal_entry_id", None)
                        
                except Exception as je_error:
                    frappe.log_error(
                        message=f"Failed to cancel/delete JE {cod.journal_entry_id}: {str(je_error)}",
                        title=f"JE Cancel Error - {doc.name}"
                    )
                    frappe.throw(
                        f"Cannot cancel/delete Journal Entry {cod.journal_entry_id}. Please handle it manually."
                    )
            
            # Update COD status to Cancelled using db_set to avoid validation errors with legacy data
            cod_doc.db_set("status", "Cancelled")
            
            frappe.msgprint(
                f"COD Document {cod.name} cancelled",
                indicator="orange"
            )
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(
            message=f"Error: {str(e)}\n\nTraceback:\n{frappe.get_traceback()}",
            title=f"COD Cancel Error - {doc.name}"
        )
        frappe.throw(f"Failed to cancel COD: {str(e)}")


def create_cod_document(doc, delivery_note, sales_order, sales_invoice, cod_amount):
    """Creates COD document with shipment details"""
    cod_doc = frappe.get_doc({
        "doctype": "COD",
        "shipment_id": doc.name,
        "awb_number": doc.awb_number,
        "delivery_note": delivery_note,
        "sales_order": sales_order,
        "sales_invoice": sales_invoice,
        "service_provider": doc.service_provider,
        "carrier_service": doc.carrier_service,
        "cod_amount": cod_amount,
        "shipment_amount": doc.shipment_amount or 0,
        "status": "Draft"
    })
    
    cod_doc.insert()
    return cod_doc.name


def create_cod_journal_entry(shipment_doc, si_doc, sales_order, cod_doc_name, cod_amount):
    """
    Creates a Draft Journal Entry to transfer COD amount from Customer to Shiprocket Supplier.
    Credit: Customer (Reduces receivable from Customer)
    Debit: Supplier (Creates payable to Shiprocket)
    
    Uses Sales Invoice if available, otherwise uses Sales Order
    """
    amount = cod_amount
    
    if amount <= 0:
        frappe.throw("COD amount must be greater than 0")
    
    # Get company and customer
    company = None
    customer = None
    reference_type = None
    reference_name = None
    cost_center = None
    
    if si_doc:
        # Use Sales Invoice details
        company = si_doc.company
        customer = si_doc.customer
        reference_type = "Sales Invoice"
        reference_name = si_doc.name
        cost_center = si_doc.items[0].cost_center if si_doc.items else None
    elif sales_order:
        # Use Sales Order details
        so_doc = frappe.get_doc("Sales Order", sales_order)
        company = so_doc.company
        customer = so_doc.customer
        reference_type = "Sales Order"
        reference_name = so_doc.name
        cost_center = so_doc.items[0].cost_center if so_doc.items else None
    else:
        # Fallback to defaults
        company = frappe.defaults.get_user_default("Company")
        customer = None  # Will be set manually later
    
    company_abbr = frappe.get_value("Company", company, "abbr")
    
    # Ensure Shiprocket Supplier exists
    setup_shiprocket_supplier()
    
    # Get accounts
    try:
        if si_doc:
            debtors_account = si_doc.debit_to
        else:
            debtors_account = f"Debtors - {company_abbr}"
        
        # Get Shiprocket payable account
        from erpnext.accounts.party import get_party_account
        creditors_account = get_party_account("Supplier", "Shiprocket", company)
        
        if not creditors_account:
            creditors_account = frappe.get_value("Company", company, "default_payable_account")
        
        if not creditors_account:
            frappe.throw(f"Could not find Payable Account for Shiprocket in Company {company}")
            
    except Exception as e:
        frappe.throw(f"Error fetching accounts: {str(e)}")
    
    # Set default cost center if not found
    if not cost_center:
        cost_center = f"Main - {company_abbr}"
    
    # Create Journal Entry
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.posting_date = getdate()
    je.company = company
    
    # Set title based on creditors account (e.g., "Creditors - ZV")
    je.title = creditors_account.split(" - ")[0] if " - " in creditors_account else "Creditors"
    
    # Set remark based on reference document
    if si_doc:
        je.remark = f"₹ {amount:.2f} against Sales Invoice {si_doc.name}"
    elif sales_order:
        je.remark = f"₹ {amount:.2f} against Sales Order {sales_order}"
    else:
        je.remark = f"COD Collection for Shipment {shipment_doc.name}"
    
    # Row 1: Debit Supplier (Shiprocket owes us this money)
    je.append("accounts", {
        "account": creditors_account,
        "party_type": "Supplier",
        "party": "Shiprocket",
        "debit_in_account_currency": amount,
        "credit_in_account_currency": 0,
        "user_remark": f"COD Collected for {reference_type} {reference_name}" if reference_type else f"COD Collected for Shipment {shipment_doc.name}",
        "cost_center": cost_center,
        "against_account": customer if customer else ""
    })
    
    # Row 2: Credit Customer (Customer has paid via COD)
    je.append("accounts", {
        "account": debtors_account,
        "party_type": "Customer" if customer else None,
        "party": customer,
        "debit_in_account_currency": 0,
        "credit_in_account_currency": amount,
        "reference_type": reference_type,
        "reference_name": reference_name,
        "cost_center": cost_center,
        "against_account": "Shiprocket"
    })
    
    je.insert(ignore_permissions=True)
    
    return je.name


def setup_shiprocket_supplier():
    """Ensures Shiprocket Supplier exists"""
    if not frappe.db.exists("Supplier", "Shiprocket"):
        supp = frappe.new_doc("Supplier")
        supp.supplier_name = "Shiprocket"
        supp.supplier_group = "Services"
        supp.supplier_type = "Company"
        supp.insert(ignore_permissions=True)
        frappe.msgprint("Created Supplier: Shiprocket", indicator="blue")


def get_linked_sales_invoice(shipment_doc):
    """
    Traverses Shipment -> Delivery Note -> Sales Invoice
    Returns: (sales_invoice_name, sales_invoice_doc) or (None, None)
    """
    if not shipment_doc.shipment_delivery_note:
        return None, None
        
    for link in shipment_doc.shipment_delivery_note:
        dn_doc = frappe.get_doc("Delivery Note", link.delivery_note)
        
        # Method A: Check Items for link
        for item in dn_doc.items:
            if item.against_sales_invoice:
                return item.against_sales_invoice, frappe.get_doc("Sales Invoice", item.against_sales_invoice)
        
        # Method B: Check 'Sales Invoice Item' table
        si_items = frappe.get_all(
            "Sales Invoice Item",
            filters={"delivery_note": link.delivery_note},
            fields=["parent"]
        )
        if si_items:
            si_name = si_items[0].parent
            return si_name, frappe.get_doc("Sales Invoice", si_name)
            
    return None, None
