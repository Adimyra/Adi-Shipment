import csv
import io
import frappe
from frappe import _
from frappe.utils import getdate
from adi_shipment.api.cod_processing import get_cod_clearing_account

@frappe.whitelist()
def reconcile_shiprocket_payout(file_url, bank_account, posting_date):
    """
    Whitelisted method to process Shiprocket COD Payout CSV,
    match AWB numbers, create consolidated Journal Entry, and update COD document statuses.
    """
    if not file_url:
        frappe.throw(_("Please upload a CSV file to reconcile."))
    if not bank_account:
        frappe.throw(_("Please select a Bank Account."))
    if not posting_date:
        frappe.throw(_("Please select a Posting Date."))

    # 1. Fetch file content
    try:
        file_doc = frappe.get_doc("File", {"file_url": file_url})
        content = file_doc.get_content()
    except Exception as e:
        frappe.throw(_("Failed to read file from URL {0}: {1}").format(file_url, str(e)))

    if isinstance(content, bytes):
        content = content.decode('utf-8-sig', errors='ignore')

    f = io.StringIO(content)
    reader = csv.reader(f)

    try:
        header = [h.strip().lower() for h in next(reader)]
    except StopIteration:
        frappe.throw(_("The uploaded CSV file is empty."))

    # 2. Identify Column Indices
    awb_idx = -1
    cod_idx = -1
    freight_idx = -1
    net_idx = -1

    for i, col in enumerate(header):
        if any(x in col for x in ['awb', 'waybill', 'airway bill', 'tracking']):
            awb_idx = i
        elif any(x in col for x in ['cod amount', 'collectable', 'cod value', 'gross cod', 'amount collected', 'cod_amount', 'cod value']):
            cod_idx = i
        elif any(x in col for x in ['freight', 'shipping', 'postage', 'courier fee', 'shipment cost', 'total fee', 'shipping charge', 'freight charge']):
            freight_idx = i
        elif any(x in col for x in ['net payout', 'remitted', 'remittance', 'net amount', 'payout amount', 'net_payout']):
            net_idx = i

    if awb_idx == -1:
        frappe.throw(_("Could not identify the AWB / Tracking number column in the CSV headers. Found headers: {0}").format(", ".join(header)))

    success_matches = []
    unmatched_awbs = []
    already_paid = []
    skipped_rows = 0

    total_gross_cod = 0.0
    total_freight = 0.0
    total_net_payout = 0.0

    # 3. Process Rows
    for row_num, row in enumerate(reader, start=2):
        if not row or not any(row):
            continue

        awb = row[awb_idx].strip()
        if not awb:
            skipped_rows += 1
            continue

        # Find matching COD document
        cod_docs = frappe.get_all(
            "COD",
            filters={"awb_number": awb},
            fields=["name", "status", "cod_amount", "sales_invoice", "sales_order", "company"]
        )

        if not cod_docs:
            unmatched_awbs.append(awb)
            continue

        cod_doc = cod_docs[0]

        if cod_doc.status == "Paid":
            already_paid.append(awb)
            continue

        # Parse amounts from row or fallback to doc values
        try:
            row_gross = float(row[cod_idx]) if (cod_idx != -1 and row[cod_idx]) else float(cod_doc.cod_amount)
        except ValueError:
            row_gross = float(cod_doc.cod_amount)

        try:
            row_freight = float(row[freight_idx]) if (freight_idx != -1 and row[freight_idx]) else 0.0
        except ValueError:
            row_freight = 0.0

        try:
            row_net = float(row[net_idx]) if (net_idx != -1 and row[net_idx]) else (row_gross - row_freight)
        except ValueError:
            row_net = row_gross - row_freight

        total_gross_cod += row_gross
        total_freight += row_freight
        total_net_payout += row_net

        success_matches.append({
            "cod_doc": cod_doc.name,
            "awb": awb,
            "gross": row_gross,
            "freight": row_freight,
            "net": row_net,
            "sales_invoice": cod_doc.sales_invoice,
            "sales_order": cod_doc.sales_order,
            "company": cod_doc.company
        })

    if not success_matches:
        msg = _("No pending COD documents matched. ")
        if unmatched_awbs:
            msg += _("Unmatched AWBs: {0}. ").format(", ".join(unmatched_awbs[:5]))
        if already_paid:
            msg += _("Already paid AWBs: {0}.").format(", ".join(already_paid[:5]))
        frappe.throw(msg)

    # 4. Determine Company and Accounts
    first_match = success_matches[0]
    company = first_match["company"]
    company_abbr = frappe.get_value("Company", company, "abbr")
    clearing_account = get_cod_clearing_account(company)
    freight_account = get_freight_expense_account(company)

    # Check rounding adjustment
    difference = round(total_gross_cod - (total_net_payout + total_freight), 2)
    if abs(difference) > 0 and abs(difference) < 5.00:
        total_net_payout = round(total_net_payout + difference, 2)

    # 5. Create Consolidated Journal Entry
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.posting_date = getdate(posting_date)
    je.company = company
    
    file_name = file_doc.file_name or "Shiprocket CSV"
    je.remark = f"Shiprocket COD Payout Settlement | Ref: {file_name} | Matched {len(success_matches)} shipments"

    # Row 1: Debit Bank Account (Net received)
    je.append("accounts", {
        "account": bank_account,
        "debit_in_account_currency": total_net_payout,
        "credit_in_account_currency": 0,
        "user_remark": f"Net remittance deposited to bank from {file_name}",
        "cost_center": f"Main - {company_abbr}"
    })

    # Row 2: Debit Freight Expense (Courier fees)
    if total_freight > 0 and freight_account:
        je.append("accounts", {
            "account": freight_account,
            "debit_in_account_currency": total_freight,
            "credit_in_account_currency": 0,
            "user_remark": f"Shiprocket courier fees deducted",
            "cost_center": f"Main - {company_abbr}"
        })

    # Credits: One line per matched shipment to credit the clearing account
    clearing_account_type = frappe.db.get_value("Account", clearing_account, "account_type")
    
    for match in success_matches:
        credit_row = {
            "account": clearing_account,
            "debit_in_account_currency": 0,
            "credit_in_account_currency": match["gross"],
            "user_remark": f"Reconciliation for AWB {match['awb']} (Doc: {match['cod_doc']})",
            "cost_center": f"Main - {company_abbr}",
            "against_account": bank_account
        }
        
        # Safety Check: If clearing account type is Receivable (like COD - ZV), ERPNext requires a Customer party
        if clearing_account_type == "Receivable":
            cust = None
            if match["sales_invoice"]:
                cust = frappe.db.get_value("Sales Invoice", match["sales_invoice"], "customer")
            elif match["sales_order"]:
                cust = frappe.db.get_value("Sales Order", match["sales_order"], "customer")
                
            if cust:
                credit_row.update({
                    "party_type": "Customer",
                    "party": cust
                })
                
        je.append("accounts", credit_row)

    je.insert(ignore_permissions=True)
    je.submit()

    # 6. Update COD Records
    for match in success_matches:
        cod = frappe.get_doc("COD", match["cod_doc"])
        cod.db_set("status", "Paid")
        cod.db_set("payment_status", "Paid")
        cod.db_set("payment_entry_id", je.name)

    frappe.db.commit()

    # 7. Formulate summary message
    summary_message = f"""
    <div style="margin-bottom: 10px;">
        <strong>🎉 COD Reconciliation Complete</strong>
    </div>
    <div style="margin-bottom: 8px;">
        📝 Journal Entry: <a href="/app/journal-entry/{je.name}" style="font-weight: bold; color: #10b981;">{je.name}</a> (Submitted)
    </div>
    <div style="margin-bottom: 8px;">
        📦 Matched & Paid Shipments: <strong>{len(success_matches)}</strong>
    </div>
    <div style="margin-bottom: 8px;">
        💰 Total Gross COD Cleared: <strong>₹ {total_gross_cod:,.2f}</strong>
    </div>
    <div style="margin-bottom: 8px;">
        🚚 Courier Expenses Booked: <strong>₹ {total_freight:,.2f}</strong>
    </div>
    <div style="margin-bottom: 8px;">
        🏦 Net Payout Transferred to Bank: <strong>₹ {total_net_payout:,.2f}</strong>
    </div>
    """

    if unmatched_awbs:
        summary_message += f"""
        <div style="margin-top: 10px; padding: 6px; background-color: #fef3c7; border-left: 3px solid #d97706;">
            <small>⚠️ <strong>{len(unmatched_awbs)} AWBs unmatched in system:</strong> {", ".join(unmatched_awbs[:8])}...</small>
        </div>
        """

    frappe.msgprint(
        summary_message,
        title="Payout Reconciliation Complete",
        indicator="green",
        as_list=False
    )

    return {
        "journal_entry": je.name,
        "matched_count": len(success_matches),
        "unmatched_count": len(unmatched_awbs)
    }

def get_freight_expense_account(company):
    """Finds a matching freight or shipping expense account in the Chart of Accounts"""
    company_abbr = frappe.get_value("Company", company, "abbr")
    
    # 1. Check for standard Freight and Forwarding Charges - ZV
    acc_name1 = f"Freight and Forwarding Charges - {company_abbr}"
    if frappe.db.exists("Account", acc_name1):
        return acc_name1

    # 2. Check for Shipping Charges - ZV
    acc_name2 = f"Shipping Charges - {company_abbr}"
    if frappe.db.exists("Account", acc_name2):
        return acc_name2

    # 3. Fallback to first account containing freight in its name
    freight_accs = frappe.get_all(
        "Account", 
        filters={
            "company": company, 
            "account_name": ["like", "%freight%"], 
            "is_group": 0
        }, 
        limit=1
    )
    if freight_accs:
        return freight_accs[0].name

    # 4. Fallback to first account containing shipping in its name
    shipping_accs = frappe.get_all(
        "Account", 
        filters={
            "company": company, 
            "account_name": ["like", "%shipping%"], 
            "is_group": 0
        }, 
        limit=1
    )
    if shipping_accs:
        return shipping_accs[0].name

    return None


@frappe.whitelist()
def get_pending_cod_settlements():
    """
    Returns a list of COD documents that have been journalized but are not yet paid,
    specifically for display in the Payment Entry helper.
    """
    records = frappe.get_all(
        "COD",
        filters={"status": "Journal Submitted", "journal_entry_id": ["not in", [None, ""]]},
        fields=["name", "awb_number", "sales_invoice", "sales_order", "cod_amount", "shipment_amount", "journal_entry_id"]
    )
    
    # Resolve the company and customer for each record dynamically
    for r in records:
        company = None
        customer = None
        if r.sales_invoice:
            company, customer = frappe.db.get_value("Sales Invoice", r.sales_invoice, ["company", "customer"])
        if not company and r.sales_order:
            company, customer = frappe.db.get_value("Sales Order", r.sales_order, ["company", "customer"])
        if not company:
            company = frappe.defaults.get_user_default("Company") or frappe.get_all("Company", limit=1)[0].name
            
        r["company"] = company
        r["customer"] = customer
        
    return records


def on_submit_payment_entry_update_cod(doc, method):
    """
    Triggered on Payment Entry submit.
    If the Payment Entry references any Journal Entries linked to COD documents,
    mark those COD documents as "Paid" and link the Payment Entry.
    """
    for ref in doc.references:
        if ref.reference_doctype == "Journal Entry":
            cod_names = frappe.get_all(
                "COD",
                filters={"journal_entry_id": ref.reference_name},
                fields=["name"]
            )
            for cod in cod_names:
                cod_doc = frappe.get_doc("COD", cod.name)
                cod_doc.db_set("status", "Paid")
                cod_doc.db_set("payment_status", "Paid")
                cod_doc.db_set("payment_entry_id", doc.name)


def on_cancel_payment_entry_rollback_cod(doc, method):
    """
    Triggered on Payment Entry cancel.
    If the Payment Entry references any Journal Entries linked to COD documents,
    rollback those COD documents back to "Journal Submitted".
    """
    for ref in doc.references:
        if ref.reference_doctype == "Journal Entry":
            cod_names = frappe.get_all(
                "COD",
                filters={"journal_entry_id": ref.reference_name},
                fields=["name"]
            )
            for cod in cod_names:
                cod_doc = frappe.get_doc("COD", cod.name)
                cod_doc.db_set("status", "Journal Submitted")
                cod_doc.db_set("payment_status", "Due")
                cod_doc.db_set("payment_entry_id", None)
