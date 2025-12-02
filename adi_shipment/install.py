import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def after_install():
    create_custom_fields({
        "Delivery Note": [
            {
                "fieldname": "shiprocket_order_id",
                "label": "Shiprocket Order ID",
                "fieldtype": "Data",
                "read_only": 1,
                "insert_after": "customer_name"
            },
            {
                "fieldname": "shiprocket_shipment_id",
                "label": "Shiprocket Shipment ID",
                "fieldtype": "Data",
                "read_only": 1,
                "insert_after": "shiprocket_order_id"
            },
            {
                "fieldname": "shiprocket_awb",
                "label": "Shiprocket AWB",
                "fieldtype": "Data",
                "read_only": 1,
                "insert_after": "shiprocket_shipment_id"
            }
        ]
    })
