import csv
import io
import frappe
from frappe import _
from frappe.utils import getdate
from adi_shipment.api.cod_processing import setup_shiprocket_customer

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
            fields=["name", "status", "cod_amount", "sales_invoice", "sales_order", "journal_entry_id"]
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

        # Resolve company dynamically
        company_name = None
        if cod_doc.sales_invoice:
            company_name = frappe.db.get_value("Sales Invoice", cod_doc.sales_invoice, "company")
        if not company_name and cod_doc.sales_order:
            company_name = frappe.db.get_value("Sales Order", cod_doc.sales_order, "company")
        if not company_name:
            company_name = frappe.defaults.get_user_default("Company") or frappe.get_all("Company", limit=1)[0].name

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
            "company": company_name,
            "journal_entry_id": cod_doc.journal_entry_id
        })

    if not success_matches:
        msg = _("No pending COD documents matched. ")
        if unmatched_awbs:
            msg += _("Unmatched AWBs: {0}. ").format(", ".join(unmatched_awbs[:5]))
        if already_paid:
            msg += _("Already paid AWBs: {0}.").format(", ".join(already_paid[:5]))
        frappe.throw(msg)

    # Ensure Shiprocket Customer exists
    setup_shiprocket_customer()

    # 4. Determine Company and Accounts
    first_match = success_matches[0]
    company = first_match["company"]
    company_abbr = frappe.get_value("Company", company, "abbr")
    freight_account = get_freight_expense_account(company)

    # Check rounding adjustment
    difference = round(total_gross_cod - (total_net_payout + total_freight), 2)
    if abs(difference) > 0 and abs(difference) < 5.00:
        total_net_payout = round(total_net_payout + difference, 2)

    # 5. Create Programmatic Payment Entry (Settle Journal Entries natively)
    from erpnext.accounts.party import get_party_account
    
    paid_from = get_party_account("Customer", "Shiprocket", company)
    if not paid_from:
        paid_from = f"Debtors - {company_abbr}"

    pe = frappe.new_doc("Payment Entry")
    pe.payment_type = "Receive"
    pe.party_type = "Customer"
    pe.party = "Shiprocket"
    pe.company = company
    pe.posting_date = getdate(posting_date)
    pe.paid_from = paid_from
    pe.paid_to = bank_account
    pe.paid_amount = total_net_payout
    pe.received_amount = total_net_payout
    
    file_name = file_doc.file_name or "Shiprocket CSV"
    pe.reference_no = file_name
    pe.reference_date = getdate(posting_date)
    pe.remarks = f"Shiprocket COD Payout Settlement | Ref: {file_name} | Matched {len(success_matches)} shipments"

    for match in success_matches:
        customer = None
        if match["sales_invoice"]:
            customer = frappe.db.get_value("Sales Invoice", match["sales_invoice"], "customer")
                
        pe.append("references", {
            "reference_doctype": "Journal Entry",
            "reference_name": match["journal_entry_id"],
            "total_amount": match["gross"],
            "outstanding_amount": match["gross"],
            "allocated_amount": match["gross"],
            "account": paid_from,
            "bill_no": f"AWB: {match['awb']}",
            "custom_awb_no": match["awb"],
            "custom_party_name": customer
        })

    # Add Deductions (Freight Expense)
    if total_freight > 0 and freight_account:
        pe.append("deductions", {
            "account": freight_account,
            "cost_center": f"Main - {company_abbr}",
            "amount": total_freight,
            "description": f"Shiprocket courier fees deducted from payout"
        })

    pe.insert(ignore_permissions=True)
    pe.submit()

    # 6. Update COD Records
    for match in success_matches:
        cod = frappe.get_doc("COD", match["cod_doc"])
        cod.db_set("status", "Paid")
        cod.db_set("payment_status", "Paid")
        cod.db_set("payment_entry_id", pe.name)

    frappe.db.commit()

    # 7. Formulate summary message
    summary_message = f"""
    <div style="margin-bottom: 10px;">
        <strong>🎉 COD Reconciliation Complete</strong>
    </div>
    <div style="margin-bottom: 8px;">
        📝 Payment Entry: <a href="/app/payment-entry/{pe.name}" style="font-weight: bold; color: #10b981;">{pe.name}</a> (Submitted)
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
        "payment_entry": pe.name,
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
    Returns a list of COD documents that are pending payout,
    specifically for display in the Payment Entry helper.
    """
    records = frappe.get_all(
        "COD",
        filters={"status": "Pending", "sales_invoice": ["not in", [None, ""]]},
        fields=["name", "awb_number", "sales_invoice", "sales_order", "cod_amount", "shipment_amount", "journal_entry_id"]
    )
    
    # Resolve the company, customer, grand_total, outstanding_amount, and debit_to for each record dynamically
    for r in records:
        company = None
        customer = None
        debit_to = None
        grand_total = 0.0
        outstanding_amount = 0.0
        
        if r.sales_invoice:
            si_data = frappe.db.get_value(
                "Sales Invoice", 
                r.sales_invoice, 
                ["company", "customer", "debit_to", "grand_total", "outstanding_amount"], 
                as_dict=True
            )
            if si_data:
                company = si_data.company
                customer = si_data.customer
                debit_to = si_data.debit_to
                grand_total = si_data.grand_total
                outstanding_amount = si_data.outstanding_amount
                
        if not company and r.sales_order:
            company, customer = frappe.db.get_value("Sales Order", r.sales_order, ["company", "customer"])
            
        if not company:
            company = frappe.defaults.get_user_default("Company") or frappe.get_all("Company", limit=1)[0].name
            
        r["company"] = company
        r["customer"] = customer
        r["debit_to"] = debit_to
        r["grand_total"] = grand_total
        r["outstanding_amount"] = outstanding_amount
        
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
                filters={"journal_entry_id": ref.reference_name, "status": ["in", ["Pending", "Journal Submitted"]]},
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
                filters={"journal_entry_id": ref.reference_name, "payment_entry_id": doc.name},
                fields=["name"]
            )
            for cod in cod_names:
                cod_doc = frappe.get_doc("COD", cod.name)
                cod_doc.db_set("status", "Journal Submitted")
                cod_doc.db_set("payment_status", "Due")
                cod_doc.db_set("payment_entry_id", None)


@frappe.whitelist()
def get_awb_and_party_names(journal_entries):
    """
    Returns a list of COD details (awb_number, customer) for the given journal entry IDs.
    """
    import json
    if isinstance(journal_entries, str):
        journal_entries = json.loads(journal_entries)

    if not journal_entries:
        return []

    records = frappe.get_all(
        "COD",
        filters={"journal_entry_id": ["in", journal_entries]},
        fields=["journal_entry_id", "awb_number", "sales_invoice", "sales_order"]
    )

    for r in records:
        customer = None
        if r.sales_invoice:
            customer = frappe.db.get_value("Sales Invoice", r.sales_invoice, "customer")
        if not customer and r.sales_order:
            customer = frappe.db.get_value("Sales Order", r.sales_order, "customer")
        r["customer"] = customer

    return records

