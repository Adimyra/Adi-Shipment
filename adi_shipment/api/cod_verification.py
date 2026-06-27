import frappe
from frappe import _
from frappe.utils import getdate


@frappe.whitelist()
def verify_and_submit_cod(cod_name):
    """
    Whitelisted method to verify COD and submit Journal Entry
    Called from COD form's "Verify COD" button
    
    Re-checks for Sales Invoice and updates Journal Entry if found
    """
    cod_doc = frappe.get_doc("COD", cod_name)
    
    # Validate
    if not cod_doc.journal_entry_id:
        frappe.throw("No Journal Entry linked to this COD document")
    
    if cod_doc.journal_status == "Submitted":
        frappe.throw("Journal Entry is already submitted")
    
    try:
        # Get Journal Entry
        je_doc = frappe.get_doc("Journal Entry", cod_doc.journal_entry_id)
        
        if je_doc.docstatus != 0:  # Not Draft
            frappe.throw(f"Journal Entry {je_doc.name} is not in draft state")
        
        # Re-check for Sales Invoice if not already linked
        if not cod_doc.sales_invoice and cod_doc.shipment_id:
            shipment_doc = frappe.get_doc("Shipment", cod_doc.shipment_id)
            from adi_shipment.api.cod_processing import get_linked_sales_invoice
            si_name, si_doc = get_linked_sales_invoice(shipment_doc)
            if si_doc:
                cod_doc.sales_invoice = si_name
                cod_doc.save()

        # If Sales Invoice is linked, ensure it is submitted and update Journal Entry reference
        if cod_doc.sales_invoice:
            si_status, debit_to = frappe.db.get_value("Sales Invoice", cod_doc.sales_invoice, ["docstatus", "debit_to"])
            if si_status == 1:
                updated_je = False
                for row in je_doc.accounts:
                    if row.party_type == "Customer" and row.party != "Shiprocket":
                        if not row.reference_name:
                            row.reference_type = "Sales Invoice"
                            row.reference_name = cod_doc.sales_invoice
                            row.account = debit_to
                            row.user_remark = f"COD Collected for Sales Invoice {cod_doc.sales_invoice}"
                            updated_je = True
                
                if updated_je:
                    je_doc.remark = f"₹ {cod_doc.cod_amount:.2f} against Sales Invoice {cod_doc.sales_invoice}"
                    je_doc.save()
                    frappe.msgprint(
                        f"Sales Invoice {cod_doc.sales_invoice} is submitted. Linked to Journal Entry.",
                        indicator="blue"
                    )
            else:
                frappe.msgprint(
                    f"Warning: Sales Invoice {cod_doc.sales_invoice} is still in draft. Journal Entry will be submitted without invoice allocation reference.",
                    indicator="orange"
                )
        
        # Submit Journal Entry
        je_doc.submit()
        
        # Update COD document
        cod_doc.journal_status = "Submitted"
        cod_doc.status = "Journal Submitted"
        cod_doc.save()
        
        frappe.db.commit()
        
        # Create rich success message
        reference_info = ""
        if cod_doc.sales_invoice:
            reference_info = f"""
            <div style="margin-bottom: 8px;">
                📄 Sales Invoice: <a href="/app/sales-invoice/{cod_doc.sales_invoice}" style="font-weight: bold;">{cod_doc.sales_invoice}</a>
            </div>
            """
        elif cod_doc.sales_order:
            reference_info = f"""
            <div style="margin-bottom: 8px;">
                📋 Sales Order: <a href="/app/sales-order/{cod_doc.sales_order}" style="font-weight: bold;">{cod_doc.sales_order}</a>
            </div>
            """
        
        message = f"""
        <div style="margin-bottom: 10px;">
            <strong>✅ COD Verified & Journal Entry Submitted</strong>
        </div>
        <div style="margin-bottom: 8px;">
            💰 COD Document: <a href="/app/cod/{cod_doc.name}" style="font-weight: bold;">{cod_doc.name}</a>
        </div>
        <div style="margin-bottom: 8px;">
            📝 Journal Entry: <a href="/app/journal-entry/{je_doc.name}" style="font-weight: bold; color: #10b981;">{je_doc.name}</a> <span style="color: #10b981;">●</span> Submitted
        </div>
        {reference_info}
        <div style="margin-bottom: 8px;">
            💵 Amount: ₹ {cod_doc.cod_amount:,.2f}
        </div>
        <div style="margin-top: 12px; padding: 8px; background-color: #ecfdf5; border-left: 3px solid #10b981;">
            <small>✓ Accounting entry completed. Payment will be reconciled when received from courier.</small>
        </div>
        """
        
        frappe.msgprint(
            message,
            title="COD Verification Complete",
            indicator="green",
            as_list=False
        )
        
        return {"success": True, "journal_entry": je_doc.name}
            
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error verifying COD {cod_name}: {str(e)}\\n\\nTraceback:\\n{frappe.get_traceback()}", "COD Verification Error")
        frappe.throw(f"Failed to verify COD: {str(e)}")


