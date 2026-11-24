"""Helpers for creating or repairing a COD document by hand.

COD documents are normally created when a COD Shipment is submitted
(cod_processing.on_submit_shipment_create_cod). If that step fails, or a COD
is made manually, these methods let the user fill it from the Shipment and
create the same draft Journal Entry the automatic flow creates. The existing
"Verify COD" button then submits it.
"""

import frappe
from frappe import _
from frappe.utils import flt

from adi_shipment.api.cod_processing import (
    create_cod_journal_entry,
    get_linked_sales_invoice,
    setup_shiprocket_customer,
)


@frappe.whitelist()
def get_cod_details_from_shipment(shipment):
    """Values to pre-fill a COD form from its Shipment."""
    frappe.has_permission("Shipment", "read", shipment, throw=True)
    doc = frappe.get_doc("Shipment", shipment)

    delivery_note = doc.shipment_delivery_note[0].delivery_note if doc.shipment_delivery_note else None
    sales_order = None
    if delivery_note:
        sales_order = frappe.db.get_value(
            "Delivery Note Item",
            {"parent": delivery_note, "against_sales_order": ["is", "set"]},
            "against_sales_order",
        )

    si_name, si_doc = get_linked_sales_invoice(doc)
    if si_doc and si_doc.docstatus != 1:
        si_name = None

    return {
        "awb_number": doc.awb_number,
        "delivery_note": delivery_note,
        "sales_order": sales_order,
        "sales_invoice": si_name,
        "service_provider": doc.service_provider,
        "carrier_service": doc.carrier_service,
        "cod_amount": doc.value_of_goods,
        "shipment_amount": doc.shipment_amount,
        "payment_method": doc.payment_method,
        "shipment_docstatus": doc.docstatus,
        "existing_cod": frappe.get_all(
            "COD", filters={"shipment_id": shipment, "status": ["!=", "Cancelled"]}, pluck="name"
        ),
    }


@frappe.whitelist()
def create_journal_entry_for_cod(cod_name):
    """Create the draft COD Journal Entry for a COD that has none, link it and set status Pending."""
    cod = frappe.get_doc("COD", cod_name)
    cod.check_permission("write")
    frappe.has_permission("Journal Entry", "create", throw=True)

    if cod.journal_entry_id and frappe.db.get_value("Journal Entry", cod.journal_entry_id, "docstatus") in (0, 1):
        frappe.throw(_("Journal Entry {0} is already linked to this COD.").format(cod.journal_entry_id))
    if cod.status in ("Paid", "Cancelled"):
        frappe.throw(_("Cannot create a Journal Entry for a COD that is {0}.").format(cod.status))
    if flt(cod.cod_amount) <= 0:
        frappe.throw(_("COD Amount must be greater than 0."))
    if not cod.shipment_id:
        frappe.throw(_("Set the Shipment first."))

    shipment = frappe.get_doc("Shipment", cod.shipment_id)
    if shipment.docstatus != 1:
        frappe.throw(_("Shipment {0} must be submitted first.").format(shipment.name))

    if cod.sales_invoice:
        si_doc = frappe.get_doc("Sales Invoice", cod.sales_invoice)
    else:
        si_name, si_doc = get_linked_sales_invoice(shipment)
        if si_doc:
            cod.sales_invoice = si_name

    if not si_doc or si_doc.docstatus != 1:
        frappe.throw(
            _("No submitted Sales Invoice found for this COD. Submit the invoice and select it in the Sales Invoice field, then try again.")
        )
    if shipment.delivery_customer and si_doc.customer != shipment.delivery_customer:
        frappe.throw(
            _("Sales Invoice {0} is for customer {1}, but the Shipment is for {2}.").format(
                si_doc.name, si_doc.customer, shipment.delivery_customer
            )
        )

    setup_shiprocket_customer()
    je_name = create_cod_journal_entry(
        shipment_doc=shipment,
        si_doc=si_doc,
        sales_order=cod.sales_order,
        cod_doc_name=cod.name,
        cod_amount=flt(cod.cod_amount),
    )

    cod.journal_entry_id = je_name
    cod.journal_status = "Draft"
    cod.status = "Pending"
    cod.save()

    return je_name
