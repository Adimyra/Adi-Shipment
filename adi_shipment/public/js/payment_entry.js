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
        let clearing_account = `COD - ${abbr}`;
        let freight_account = `Freight and Forwarding Charges - ${abbr}`;
        let cost_center = `Main - ${abbr}`;
        
        // Safety fallback check for clearing account existence
        frappe.db.exists('Account', clearing_account).then(exists => {
            if (!exists) {
                clearing_account = `Shiprocket COD Clearing - ${abbr}`;
            }
            
            // Show custom grid columns programmatically
            toggle_cod_grid_columns(frm, true);

            // 1. Programmatically bypass payable filter and set clearing account
            frm.set_value('paid_from', clearing_account);
            
            // 2. Clear and populate References table
            frm.clear_table('references');
            
            let total_gross = 0.0;
            let total_freight = 0.0;
            
            selected_cods.forEach(cod => {
                let row = frm.add_child('references');
                row.reference_doctype = 'Journal Entry';
                row.reference_name = cod.journal_entry_id;
                row.total_amount = cod.cod_amount;
                row.outstanding_amount = cod.cod_amount;
                row.allocated_amount = cod.cod_amount;
                row.bill_no = "AWB: " + cod.awb_number;
                
                // Set the custom columns
                row.custom_awb_no = cod.awb_number;
                row.custom_party_name = cod.customer;
                
                total_gross += flt(cod.cod_amount);
                total_freight += flt(cod.shipment_amount);
            });
            
            // 3. Set main net payout amount and remark
            let net_amount = total_gross - total_freight;
            frm.set_value('paid_amount', net_amount);
            frm.set_value('received_amount', net_amount);
            
            let remark = `Reconciled COD Payments for:\n` + selected_cods.map(c => `- AWB: ${c.awb_number} (Ref: ${c.name}, Invoice: ${c.sales_invoice || c.sales_order || ''}, Party: ${c.customer || ''})`).join('\n');
            frm.set_value('remark', remark);
            
            // 4. Clear and populate Deductions/Loss table
            frm.clear_table('deductions');
            if (total_freight > 0) {
                frappe.db.exists('Account', freight_account).then(f_exists => {
                    let fa = f_exists ? freight_account : null;
                    if (fa) {
                        let ded = frm.add_child('deductions');
                        ded.account = fa;
                        ded.cost_center = cost_center;
                        ded.amount = total_freight;
                    }
                    frm.refresh_fields();
                });
            } else {
                frm.refresh_fields();
            }
            
            frappe.show_alert({
                message: __('Linked {0} COD shipments to Payment Entry.').format(selected_cods.length),
                indicator: 'green'
            });
        });
    });
}

function format_number(val) {
    return flt(val).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}
