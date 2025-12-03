import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def after_install():
    create_custom_fields({
        "Shipment": [
            {
                "fieldname": "payment_method",
                "label": "Payment Method",
                "fieldtype": "Select",
                "options": "Prepaid\nCOD",
                "default": "Prepaid",
                "insert_after": "value_of_goods",
                "read_only": 0
            }
        ]
    })
