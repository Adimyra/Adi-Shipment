frappe.listview_settings['COD'] = {
    onload: function (listview) {
        listview.page.add_inner_button(__('Reconcile Shiprocket Payout'), function () {
            let dialog = new frappe.ui.Dialog({
                title: __('Reconcile Shiprocket Payout'),
                fields: [
                    {
                        fieldname: 'download_template_btn',
                        fieldtype: 'HTML',
                        options: `<div style="margin-bottom: 15px; text-align: right;">
                            <button class="btn btn-xs btn-default" id="download-cod-template-btn" style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                                📥 ${__('Download Sample CSV Template')}
                            </button>
                        </div>`
                    },
                    {
                        fieldname: 'bank_account',
                        label: __('Bank Account'),
                        fieldtype: 'Link',
                        options: 'Account',
                        get_query: function () {
                            return {
                                filters: {
                                    'account_type': 'Bank',
                                    'is_group': 0
                                }
                            };
                        },
                        reqd: 1
                    },
                    {
                        fieldname: 'posting_date',
                        label: __('Posting Date'),
                        fieldtype: 'Date',
                        default: frappe.datetime.get_today(),
                        reqd: 1
                    },
                    {
                        fieldname: 'csv_file',
                        label: __('Upload Shiprocket Payout CSV'),
                        fieldtype: 'Attach',
                        description: __('Expected columns: AWB / Waybill, COD Amount, Freight, Net Payout. Handles standard Shiprocket payout reports directly.'),
                        reqd: 1
                    }
                ],
                primary_action_label: __('Reconcile'),
                primary_action: function (values) {
                    dialog.disable_primary_action();
                    frappe.call({
                        method: 'adi_shipment.api.cod_reconciliation.reconcile_shiprocket_payout',
                        args: {
                            file_url: values.csv_file,
                            bank_account: values.bank_account,
                            posting_date: values.posting_date
                        },
                        freeze: true,
                        freeze_message: __('Processing Shiprocket payout CSV...'),
                        callback: function (r) {
                            dialog.enable_primary_action();
                            if (!r.exc) {
                                dialog.hide();
                                listview.refresh();
                            }
                        }
                    });
                }
            });
            dialog.show();

            // Attach download template click handler using jQuery event delegation
            dialog.$wrapper.on('click', '#download-cod-template-btn', function (e) {
                e.preventDefault();
                let csvContent = "awb,cod_amount,freight,net_payout\n14112367213922,708.00,103.36,604.64\n368623726401,268.00,237.16,30.84\n";
                let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                let url = URL.createObjectURL(blob);
                let link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", "shiprocket_payout_template.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        });
    }
};
