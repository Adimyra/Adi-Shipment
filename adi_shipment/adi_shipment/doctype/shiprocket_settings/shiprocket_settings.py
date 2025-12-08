import frappe
from frappe.model.document import Document
from adi_shipment.api.shiprocket import get_token

class ShiprocketSettings(Document):
	def validate(self):
		if self.shipment_naming_series:
			self.update_shipment_autoname()

	def update_shipment_autoname(self):
		try:
			if not frappe.db.exists("DocType", "Shipment"):
				return

			doc = frappe.get_doc("DocType", "Shipment")
			if doc.autoname != self.shipment_naming_series:
				doc.autoname = self.shipment_naming_series
				doc.flags.ignore_permissions = True
				doc.save()
				frappe.msgprint(f"Shipment Naming Series updated to {self.shipment_naming_series}")
		except Exception as e:
			frappe.log_error(f"Error updating Shipment autoname: {str(e)}")

@frappe.whitelist()
def generate_token_manual():
    token = get_token()
    return token
