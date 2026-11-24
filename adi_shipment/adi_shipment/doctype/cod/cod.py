# Copyright (c) 2026, Adimyra Systems Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class COD(Document):
	"""COD Document Controller"""

	def validate(self):
		self.validate_one_cod_per_shipment()

	def validate_one_cod_per_shipment(self):
		if not self.shipment_id or self.status == "Cancelled":
			return
		existing = frappe.db.get_value(
			"COD",
			{"shipment_id": self.shipment_id, "status": ["!=", "Cancelled"], "name": ["!=", self.name]},
			"name",
		)
		if existing:
			frappe.throw(
				_("COD {0} already exists for Shipment {1}. Open and fix that COD instead of creating a new one.").format(
					existing, self.shipment_id
				)
			)
