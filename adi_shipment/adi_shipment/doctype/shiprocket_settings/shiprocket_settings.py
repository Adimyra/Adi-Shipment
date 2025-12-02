import frappe
from frappe.model.document import Document
from adi_shipment.api.shiprocket import get_token

class ShiprocketSettings(Document):
    pass

@frappe.whitelist()
def generate_token_manual():
    token = get_token()
    return token
