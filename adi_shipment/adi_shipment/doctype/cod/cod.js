frappe.ui.form.on('COD', {
    refresh: function (frm) {
        // Add "Verify COD" button if status is Pending and Journal Entry is Draft
        if (frm.doc.journal_entry_id && ["Pending", "Draft"].includes(frm.doc.status) && frm.doc.journal_status !== "Submitted") {
            frm.add_custom_button(__('Verify COD'), function () {
                frappe.call({
                    method: 'adi_shipment.api.cod_verification.verify_and_submit_cod',
                    args: {
                        cod_name: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: __("Verifying COD and submitting Journal Entry..."),
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.show_alert({
                                message: __('COD Verified and Journal Entry Submitted'),
                                indicator: 'green'
                            });
                            frm.reload_doc();
                        }
                    }
                });
            }).addClass('btn-primary');
        }

        // Add "Create Journal Entry" button if journal_entry_id is missing and status is Draft/Pending
        if (!frm.doc.journal_entry_id && ["Pending", "Draft"].includes(frm.doc.status)) {
            frm.add_custom_button(__('Create Journal Entry'), function () {
                frappe.call({
                    method: 'adi_shipment.api.cod_processing.create_je_for_cod',
                    args: {
                        cod_name: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: __("Creating Journal Entry..."),
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.show_alert({
                                message: __('Journal Entry created successfully'),
                                indicator: 'green'
                            });
                            frm.reload_doc();
                        }
                    }
                });
            }).addClass('btn-primary');
        }

        // Add button to view Journal Entry
        if (frm.doc.journal_entry_id) {
            frm.add_custom_button(__('View Journal Entry'), function () {
                frappe.set_route('Form', 'Journal Entry', frm.doc.journal_entry_id);
            });
        }

        // Add button to view Shipment
        if (frm.doc.shipment_id) {
            frm.add_custom_button(__('View Shipment'), function () {
                frappe.set_route('Form', 'Shipment', frm.doc.shipment_id);
            });
        }
    }
});
