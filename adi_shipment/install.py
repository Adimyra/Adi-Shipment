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
            },
            {
                "fieldname": "shiprocket_order_id",
                "label": "Shiprocket Order ID",
                "fieldtype": "Data",
                "insert_after": "payment_method",
                "read_only": 1
            }
        ]
    })

    # Auto-create Shiprocket Customer and Supplier if they don't exist
    from adi_shipment.api.cod_processing import setup_shiprocket_customer, setup_shiprocket_supplier
    setup_shiprocket_customer()
    setup_shiprocket_supplier()

