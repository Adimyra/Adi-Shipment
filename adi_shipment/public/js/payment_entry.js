frappe.ui.form.on('Payment Entry', {
    refresh: function (frm) {
        // Toggle custom grid columns visibility based on whether COD references exist
        let has_cod = false;
        if (frm.doc.references && frm.doc.references.length > 0) {
            frm.doc.references.forEach(r => {
                if (r.custom_awb_no) {
                    has_cod = true;
                }
            });
        }
        
        toggle_cod_grid_columns(frm, has_cod);

        if (frm.doc.docstatus === 0 && frm.doc.payment_type === 'Receive') {
            frm.add_custom_button(__('Fetch Pending COD Payments'), function () {
                frappe.call({
                    method: 'adi_shipment.api.cod_reconciliation.get_pending_cod_settlements',
                    callback: function (r) {
                        if (r.message && r.message.length > 0) {
                            show_cod_selection_dialog(frm, r.message);
                        } else {
                            frappe.msgprint(__('No pending COD settlements found.'));
                        }
                    }
                });
            }).addClass('btn-primary');

            frm.add_custom_button(__('Fetch AWB'), function () {
                fetch_awb_and_party_names(frm);
            });
        }
    }
});

function toggle_cod_grid_columns(frm, show) {
    if (frm.fields_dict.references && frm.fields_dict.references.grid) {
        let val = show ? 1 : 0;
        frm.fields_dict.references.grid.update_docfield_property('custom_party_name', 'in_list_view', val);
        frm.fields_dict.references.grid.update_docfield_property('custom_awb_no', 'in_list_view', val);
        frm.fields_dict.references.grid.refresh();
    }
}

function show_cod_selection_dialog(frm, cod_records) {
    let fields = [
        {
            fieldname: 'cod_search_html',
            fieldtype: 'HTML',
            options: `<div style="margin-bottom: 12px;">
                <input type="text" class="form-control" id="cod-search-box" placeholder="🔍 Search by AWB, COD Ref, Invoice Reference or Customer..." style="border: 1px solid #ced4da; border-radius: 4px; padding: 8px 12px; font-size: 13px; width: 100%;">
            </div>`
        },
        {
            fieldname: 'cod_list_html',
            fieldtype: 'HTML',
            options: get_table_html(cod_records)
        }
    ];

    let dialog = new frappe.ui.Dialog({
        title: __('Select COD Shipments to Reconcile'),
        fields: fields,
        primary_action_label: __('Link to Payment Entry'),
        primary_action: function (values) {
            let selected_names = [];
            dialog.$wrapper.find('.cod-select-chk:checked').each(function () {
                selected_names.push($(this).data('name'));
            });

            if (selected_names.length === 0) {
                frappe.msgprint(__('Please select at least one COD shipment.'));
                return;
            }

            let selected_cods = cod_records.filter(c => selected_names.includes(c.name));
            
            // Reconcile and populate Payment Entry
            populate_payment_entry(frm, selected_cods);
            dialog.hide();
        }
    });

    dialog.show();

    // Attach select-all click listener
    dialog.$wrapper.on('change', '#cod-select-all', function () {
        dialog.$wrapper.find('.cod-select-chk:visible').prop('checked', $(this).prop('checked'));
    });

    // Attach real-time search filtering
    dialog.$wrapper.on('keyup', '#cod-search-box', function () {
        let query = $(this).val().toLowerCase();
        dialog.$wrapper.find('tbody tr').each(function () {
            let text = $(this).text().toLowerCase();
            $(this).toggle(text.indexOf(query) > -1);
        });
    });
}

function get_table_html(records) {
    let rows = records.map(r => `
        <tr>
            <td style="text-align: center;"><input type="checkbox" class="cod-select-chk" data-name="${r.name}" style="transform: scale(1.1); cursor: pointer;"></td>
            <td style="font-weight: bold; color: #1a5c96;">${r.name}</td>
            <td>${r.awb_number || ''}</td>
            <td>${r.sales_invoice || r.sales_order || ''}</td>
            <td style="font-weight: 500;">${r.customer || ''}</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32;">₹ ${format_number(r.cod_amount)}</td>
            <td style="text-align: right; color: #c62828;">₹ ${format_number(r.shipment_amount)}</td>
        </tr>
    `).join('');

    return `
        <div style="max-height: 380px; overflow-y: auto; border: 1px solid #d1d8dd; border-radius: 4px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
            <table class="table table-bordered table-hover table-condensed" style="font-size: 12px; margin-bottom: 0;">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #475569;">
                        <th style="width: 40px; text-align: center;"><input type="checkbox" id="cod-select-all" style="transform: scale(1.1); cursor: pointer;"></th>
                        <th>${__('COD Ref')}</th>
                        <th>${__('AWB Number')}</th>
                        <th>${__('Reference')}</th>
                        <th>${__('Customer')}</th>
                        <th style="text-align: right;">${__('Gross COD')}</th>
                        <th style="text-align: right;">${__('Freight')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function populate_payment_entry(frm, selected_cods) {
    let company = selected_cods[0].company;
    
    frappe.db.get_value('Company', company, 'abbr', (val) => {
        let abbr = val.abbr;
        let freight_account = `Freight and Forwarding Charges - ${abbr}`;
        let cost_center = `Main - ${abbr}`;
        
        // Show custom grid columns programmatically
        toggle_cod_grid_columns(frm, true);

        // 1. Clear and populate References table
        frm.clear_table('references');
        
        let total_gross = 0.0;
        let total_freight = 0.0;
        
        let paid_from_account = frm.doc.paid_from;
        if (!paid_from_account) {
            paid_from_account = `Debtors - ${abbr}`;
        }
        
        selected_cods.forEach(cod => {
            let row = frm.add_child('references');
            row.reference_doctype = 'Journal Entry';
            row.reference_name = cod.journal_entry_id;
            row.total_amount = cod.cod_amount;
            row.outstanding_amount = cod.cod_amount;
            row.allocated_amount = cod.cod_amount;
            row.account = paid_from_account;
            row.bill_no = "AWB: " + cod.awb_number;
            
            // Set the custom columns
            row.custom_awb_no = cod.awb_number;
            row.custom_party_name = cod.customer;
            
            total_gross += flt(cod.cod_amount);
            total_freight += flt(cod.shipment_amount);
        });
        
        // 2. Set main net payout amount and remark
        let net_amount = total_gross - total_freight;
        frm.set_value('paid_amount', net_amount);
        frm.set_value('received_amount', net_amount);
        
        let remark = `Reconciled COD Payments for:\n` + selected_cods.map(c => `- AWB: ${c.awb_number} (Ref: ${c.name}, JV: ${c.journal_entry_id || ''}, Invoice: ${c.sales_invoice || c.sales_order || ''}, Party: ${c.customer || ''})`).join('\n');
        frm.set_value('remark', remark);
        
        // 3. Clear and populate Deductions/Loss table
        frm.clear_table('deductions');
        if (total_freight > 0) {
            frappe.db.exists('Account', freight_account).then(f_exists => {
                let fa = f_exists ? freight_account : null;
                if (!fa) {
                    fa = `Shipping Charges - ${abbr}`;
                }
                
                frappe.db.exists('Account', fa).then(fa_exists => {
                    let final_fa = fa_exists ? fa : null;
                    if (final_fa) {
                        let ded = frm.add_child('deductions');
                        ded.account = final_fa;
                        ded.cost_center = cost_center;
                        ded.amount = total_freight;
                    }
                    frm.refresh_fields();
                });
            });
        } else {
            frm.refresh_fields();
        }
        
        frappe.show_alert({
            message: __('Linked {0} COD shipments to Payment Entry.').format(selected_cods.length),
            indicator: 'green'
        });
    });
}

function format_number(val) {
    return flt(val).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

frappe.ui.form.on('Payment Entry Reference', {
    reference_name: function (frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.reference_doctype === 'Journal Entry' && row.reference_name) {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'COD',
                    filters: {
                        journal_entry_id: row.reference_name
                    },
                    fields: ['awb_number', 'customer'],
                    limit: 1
                },
                callback: function (r) {
                    if (r.message && r.message.length > 0) {
                        let cod = r.message[0];
                        frappe.model.set_value(cdt, cdn, 'custom_awb_no', cod.awb_number);
                        frappe.model.set_value(cdt, cdn, 'custom_party_name', cod.customer);
                        toggle_cod_grid_columns(frm, true);
                    }
                }
            });
        }
    }
});

function fetch_awb_and_party_names(frm) {
    let journal_entries = [];
    if (frm.doc.references && frm.doc.references.length > 0) {
        frm.doc.references.forEach(r => {
            if (r.reference_doctype === 'Journal Entry' && r.reference_name) {
                journal_entries.push(r.reference_name);
            }
        });
    }

    if (journal_entries.length === 0) {
        frappe.msgprint(__('No Journal Entry references found to fetch AWB for.'));
        return;
    }

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'COD',
            filters: {
                journal_entry_id: ['in', journal_entries]
            },
            fields: ['journal_entry_id', 'awb_number', 'customer']
        },
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                let cod_map = {};
                r.message.forEach(cod => {
                    cod_map[cod.journal_entry_id] = cod;
                });

                let updated_count = 0;
                frm.doc.references.forEach(row => {
                    if (row.reference_doctype === 'Journal Entry' && row.reference_name && cod_map[row.reference_name]) {
                        let cod = cod_map[row.reference_name];
                        row.custom_awb_no = cod.awb_number;
                        row.custom_party_name = cod.customer;
                        updated_count++;
                    }
                });

                if (updated_count > 0) {
                    frm.refresh_field('references');
                    toggle_cod_grid_columns(frm, true);
                    frappe.show_alert({
                        message: __('Fetched AWB & Party Names for {0} references.').format(updated_count),
                        indicator: 'green'
                    });
                } else {
                    frappe.msgprint(__('No matching COD documents found for the referenced journal entries.'));
                }
            } else {
                frappe.msgprint(__('No matching COD documents found for the referenced journal entries.'));
            }
        }
    });
}
