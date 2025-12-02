frappe.ui.form.on('Delivery Note', {
    refresh: function (frm) {
        if (!frm.doc.__islocal && frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Shiprocket Order'), function () {
                frappe.set_route('adi_shiprocket', {
                    delivery_note: frm.doc.name
                });
            }, __('Shipment'));
        }
    }
});
