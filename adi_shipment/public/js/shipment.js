frappe.ui.form.on('Shipment', {
    refresh: function (frm) {
        // Add Shiprocket buttons only if document is saved
        if (!frm.is_new()) {

            // 1. Create Order (Show if no Shipment ID)
            if (!frm.doc.shipment_id) {
                frm.add_custom_button('Create Shiprocket Order', function () {
                    frappe.call({
                        method: 'adi_shipment.api.shiprocket.create_order_from_shipment',
                        args: { shipment_name: frm.doc.name },
                        freeze: true,
                        freeze_message: "Creating Order in Shiprocket...",
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.msgprint("Order Created Successfully!");
                                frm.reload_doc();
                                // Auto-trigger Ship Now
                                setTimeout(() => {
                                    open_courier_dialog(frm);
                                }, 1000);
                            }
                        }
                    });
                }, "Shiprocket");
            }

            // 2. Assign AWB (If Shipment ID exists but No AWB)
            else if (frm.doc.shipment_id && !frm.doc.awb_number) {
                frm.add_custom_button('Ship Now (Select Courier)', function () {
                    open_courier_dialog(frm);
                }, "Shiprocket");
            }

            // 3. Schedule Pickup (If AWB Assigned)
            else if (frm.doc.awb_number) {
                frm.add_custom_button('Schedule Pickup', function () {
                    frappe.call({
                        method: 'adi_shipment.api.shiprocket.schedule_pickup_for_shipment',
                        args: { shipment_name: frm.doc.name },
                        freeze: true,
                        freeze_message: "Scheduling Pickup...",
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.msgprint("Pickup Scheduled Successfully!");
                            }
                        }
                    });
                }, "Shiprocket");

                frm.add_custom_button('Track Shipment', function () {
                    window.open("https://app.shiprocket.in/tracking/" + frm.doc.awb_number, "_blank");
                }, "Shiprocket");
            }
        }
    }
});

function open_courier_dialog(frm) {
    let d = new frappe.ui.Dialog({
        title: 'Select Courier Partner',
        fields: [
            {
                fieldname: 'courier_html',
                fieldtype: 'HTML'
            }
        ]
    });

    d.show();
    d.get_field('courier_html').$wrapper.html('<div class="text-center text-muted p-4">Fetching best rates...</div>');

    frappe.call({
        method: 'adi_shipment.api.shiprocket.get_courier_serviceability',
        args: { shipment_name: frm.doc.name },
        callback: function (r) {
            if (r.message && r.message.data && r.message.data.available_courier_companies) {
                let couriers = r.message.data.available_courier_companies;

                // Sort by rate (cheapest first)
                couriers.sort((a, b) => a.rate - b.rate);

                let min_rate = couriers[0].rate;
                let min_days = Math.min(...couriers.map(c => c.estimated_delivery_days));

                let html = `
                    <style>
                        .courier-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; font-family: var(--font-stack); }
                        .courier-row { 
                            background: var(--card-bg, #fff); 
                            box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
                            transition: all 0.2s ease; 
                            border: 1px solid var(--border-color, #e5e7eb);
                            border-radius: 8px;
                        }
                        .courier-row:hover { 
                            transform: translateY(-2px); 
                            box-shadow: 0 8px 15px rgba(0,0,0,0.1); 
                            border-color: #2563eb;
                        }
                        .courier-cell { padding: 15px; vertical-align: middle; }
                        .courier-logo {
                            width: 45px; height: 45px; 
                            background: #f3f4f6; 
                            border-radius: 12px; 
                            display: flex; align-items: center; justify-content: center; 
                            font-weight: 700; font-size: 18px; color: #4b5563;
                            margin-right: 15px;
                        }
                        .courier-name { font-weight: 600; font-size: 16px; color: var(--text-color); margin-bottom: 4px; }
                        .courier-meta { font-size: 12px; color: var(--text-muted); }
                        .courier-rating { 
                            background: #fffbeb; color: #d97706; 
                            padding: 4px 8px; border-radius: 6px; 
                            font-weight: 600; font-size: 13px;
                            display: inline-flex; align-items: center; gap: 4px;
                        }
                        .courier-price { font-weight: 700; font-size: 18px; color: #059669; }
                        .btn-ship { 
                            background: #2563eb; color: white; 
                            border: none; padding: 8px 20px; 
                            border-radius: 8px; cursor: pointer; 
                            font-weight: 600; font-size: 14px;
                            transition: background 0.2s;
                        }
                        .btn-ship:hover { background: #1d4ed8; }
                        .badge { 
                            padding: 2px 8px; border-radius: 12px; 
                            font-size: 10px; font-weight: 700; text-transform: uppercase; 
                            margin-left: 8px; vertical-align: middle;
                        }
                        .badge-cheap { background: #dbeafe; color: #1e40af; }
                        .badge-fast { background: #d1fae5; color: #065f46; }
                    </style>
                    <div style="max-height: 500px; overflow-y: auto; padding: 5px;">
                        <table class="courier-table">
                            <tbody>
                `;

                couriers.forEach((c) => {
                    let badges = '';
                    if (c.rate === min_rate) badges += `<span class="badge badge-cheap">Cheapest</span>`;
                    if (c.estimated_delivery_days === min_days) badges += `<span class="badge badge-fast">Fastest</span>`;

                    let logo_char = c.courier_name.charAt(0).toUpperCase();

                    html += `
                        <tr class="courier-row">
                            <td class="courier-cell" style="border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 40%;">
                                <div style="display: flex; align-items: center;">
                                    <div class="courier-logo">${logo_char}</div>
                                    <div>
                                        <div class="courier-name">${c.courier_name} ${badges}</div>
                                        <div class="courier-meta">ID: ${c.courier_company_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="courier-cell" style="text-align: center;">
                                <div style="font-weight: 600;">${c.estimated_delivery_days} Days</div>
                                <div class="courier-meta">Delivery Time</div>
                            </td>
                            <td class="courier-cell" style="text-align: center;">
                                <div class="courier-rating">
                                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    ${c.rating}
                                </div>
                            </td>
                            <td class="courier-cell" style="text-align: right;">
                                <div class="courier-price">₹${c.rate}</div>
                            </td>
                            <td class="courier-cell" style="border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right;">
                                <button class="btn-ship" data-id="${c.courier_company_id}">
                                    Ship Now
                                </button>
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table></div>`;

                let $wrapper = d.get_field('courier_html').$wrapper;
                $wrapper.html(html);

                // Bind Click Event
                $wrapper.find('.btn-ship').on('click', function () {
                    let courier_id = $(this).data('id');
                    frappe.call({
                        method: 'adi_shipment.api.shiprocket.assign_awb_for_shipment',
                        args: {
                            shipment_name: frm.doc.name,
                            courier_company_id: courier_id
                        },
                        freeze: true,
                        freeze_message: "Assigning AWB...",
                        callback(r) {
                            if (!r.exc) {
                                d.hide();
                                frappe.msgprint("AWB Assigned Successfully!");
                                frm.reload_doc();
                            }
                        }
                    });
                });

            } else {
                d.get_field('courier_html').$wrapper.html('<div class="text-center text-danger p-4">No couriers available. Check address/weight.</div>');
            }
        }
    });
}
