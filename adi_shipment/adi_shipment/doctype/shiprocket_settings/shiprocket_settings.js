frappe.ui.form.on('Shiprocket Settings', {
    refresh: function (frm) {
        frm.add_custom_button('Reset', function () {
            frm.set_value('email', '');
            frm.set_value('password', '');
            frm.set_value('token', '');
            frm.set_value('token_expiry', '');
            frm.save();
        });
    },
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
