frappe.ui.form.on('COD', {
    shipment_id: function (frm) {
        // Fill the form from the Shipment while it has no Journal Entry yet
        if (!frm.doc.shipment_id || frm.doc.journal_entry_id) return;
        frappe.call({
            method: 'adi_shipment.api.cod_manual.get_cod_details_from_shipment',
            args: { shipment: frm.doc.shipment_id },
            callback: function (r) {
                const d = r.message;
                if (!d) return;
                const others = (d.existing_cod || []).filter((name) => name !== frm.doc.name);
                if (others.length) {
                    frappe.msgprint({
                        title: __('COD already exists'),
                        indicator: 'orange',
                        message: __('COD {0} already exists for this Shipment. Open and fix that COD instead of creating a new one.', [others.join(', ')])
                    });
                }
                if (d.payment_method && d.payment_method !== 'COD') {
                    frappe.show_alert({ message: __('This Shipment is not a COD shipment.'), indicator: 'orange' });
                }
                ['awb_number', 'delivery_note', 'sales_order', 'sales_invoice', 'service_provider',
                    'carrier_service', 'cod_amount', 'shipment_amount'].forEach((field) => {
                    if (d[field]) frm.set_value(field, d[field]);
                });
                if (!d.sales_invoice) {
                    frappe.show_alert({ message: __('No submitted Sales Invoice found. Select it before creating the Journal Entry.'), indicator: 'orange' }, 7);
                }
            }
        });
    },

    refresh: function (frm) {
        // Manual / failed COD: create the same draft Journal Entry the automatic flow creates
        if (!frm.is_new() && !frm.doc.journal_entry_id && !['Paid', 'Cancelled'].includes(frm.doc.status)) {
            frm.add_custom_button(__('Create Journal Entry'), function () {
                if (frm.is_dirty()) {
                    frappe.msgprint(__('Save the COD first.'));
                    return;
                }
                frappe.confirm(
                    __('Create a draft Journal Entry of {0} against Sales Invoice {1}?', [
                        format_currency(frm.doc.cod_amount), frm.doc.sales_invoice || __('(auto-detect)')
                    ]),
                    function () {
                        frappe.call({
                            method: 'adi_shipment.api.cod_manual.create_journal_entry_for_cod',
                            args: { cod_name: frm.doc.name },
                            freeze: true,
                            freeze_message: __('Creating Journal Entry...'),
                            callback: function (r) {
                                if (!r.exc) {
                                    frappe.show_alert({
                                        message: __('Journal Entry {0} created. Now click Verify COD to submit it.', [r.message]),
                                        indicator: 'green'
                                    }, 7);
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                );
            }).addClass('btn-primary');
        }

        // Add "Verify COD" button if status is Pending and Journal Entry is Draft (for backward compatibility)
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

        // Add button to view Journal Entry (for backward compatibility)
        if (frm.doc.journal_entry_id) {
            frm.add_custom_button(__('View Journal Entry'), function () {
                frappe.set_route('Form', 'Journal Entry', frm.doc.journal_entry_id);
            });
        }

        // Add button to view Payment Entry
        if (frm.doc.payment_entry_id) {
            frm.add_custom_button(__('View Payment Entry'), function () {
                frappe.set_route('Form', 'Payment Entry', frm.doc.payment_entry_id);
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
