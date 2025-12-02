frappe.ui.form.on('Shiprocket Settings', {
    generate_token: function (frm) {
        frappe.call({
            method: 'adi_shipment.adi_shipment.doctype.shiprocket_settings.shiprocket_settings.generate_token_manual',
            callback: function (r) {
                if (!r.exc) {
                    frappe.msgprint('Token generated successfully');
                    frm.reload_doc();
                }
            }
        });
    }
});
