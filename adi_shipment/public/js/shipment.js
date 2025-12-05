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
        title: 'Ship Order',
        size: 'large', // Wider modal
        fields: [
            {
                fieldname: 'ui_html',
                fieldtype: 'HTML'
            }
        ]
    });

    d.show();
    d.get_field('ui_html').$wrapper.html('<div class="text-center text-muted p-4">Fetching best rates...</div>');

    frappe.call({
        method: 'adi_shipment.api.shiprocket.get_courier_serviceability',
        args: { shipment_name: frm.doc.name },
        callback: function (r) {
            if (r.message && r.message.shiprocket_response && r.message.shiprocket_response.data) {
                let data = r.message.shiprocket_response.data;
                let ctx = r.message.context || {};
                let couriers = data.available_courier_companies || [];

                // Sort by rate
                couriers.sort((a, b) => a.rate - b.rate);

                let min_rate = couriers.length ? couriers[0].rate : 0;
                let min_days = couriers.length ? Math.min(...couriers.map(c => c.estimated_delivery_days)) : 0;

                let html = `
                    <style>
                        .sr-container { font-family: 'Inter', sans-serif; color: #1f2937; }
                        
                        /* Header Section */
                        .sr-header { 
                            display: flex; gap: 20px; padding: 15px; 
                            background: #f9fafb; border-radius: 8px; margin-bottom: 20px;
                            border: 1px solid #e5e7eb;
                        }
                        .sr-stat-group { flex: 1; }
                        .sr-stat-label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
                        .sr-stat-val { font-size: 14px; font-weight: 600; color: #111827; }
                        .sr-stat-sub { font-size: 12px; color: #6b7280; }

                        /* Courier List */
                        .sr-list { max-height: 60vh; overflow-y: auto; padding-right: 5px; }
                        .sr-card { 
                            display: flex; align-items: center; 
                            background: #fff; border: 1px solid #e5e7eb; 
                            border-radius: 8px; padding: 15px; margin-bottom: 10px;
                            transition: all 0.2s;
                        }
                        .sr-card:hover { border-color: #7c3aed; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1); }
                        
                        .sr-logo { 
                            width: 40px; height: 40px; background: #f3f4f6; 
                            border-radius: 8px; display: flex; align-items: center; justify-content: center;
                            font-weight: 700; color: #4b5563; margin-right: 15px; font-size: 16px;
                        }
                        .sr-info { flex: 2; }
                        .sr-name { font-weight: 600; font-size: 15px; margin-bottom: 2px; }
                        .sr-meta { font-size: 12px; color: #6b7280; }
                        
                        .sr-metric { flex: 1; text-align: center; }
                        .sr-metric-val { font-weight: 600; font-size: 14px; }
                        .sr-metric-lbl { font-size: 11px; color: #6b7280; }
                        
                        .sr-price { flex: 1; text-align: right; font-size: 18px; font-weight: 700; color: #059669; margin-right: 20px; }
                        
                        .sr-btn { 
                            background: #7c3aed; color: white; border: none; 
                            padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px;
                            cursor: pointer; transition: background 0.2s;
                        }
                        .sr-btn:hover { background: #6d28d9; }

                        .sr-badge { 
                            display: inline-block; padding: 2px 6px; border-radius: 4px; 
                            font-size: 10px; font-weight: 700; text-transform: uppercase; margin-left: 6px; 
                        }
                        .bg-blue { background: #dbeafe; color: #1e40af; }
                        .bg-green { background: #d1fae5; color: #065f46; }
                        .bg-yellow { background: #fffbeb; color: #b45309; }
                    </style>

                    <div class="sr-container">
                        <!-- Summary Header -->
                        <div class="sr-header">
                            <div class="sr-stat-group">
                                <div class="sr-stat-label">Package Weight</div>
                                <div class="sr-stat-val">${ctx.weight} kg</div>
                                <div class="sr-stat-sub">Volumetric: ${ctx.volumetric_weight ? ctx.volumetric_weight.toFixed(3) : '-'} kg</div>
                            </div>
                            <div class="sr-stat-group">
                                <div class="sr-stat-label">Dimensions (LxWxH)</div>
                                <div class="sr-stat-val">${ctx.dimensions} cm</div>
                            </div>
                            <div class="sr-stat-group">
                                <div class="sr-stat-label">Payment Mode</div>
                                <div class="sr-stat-val">${ctx.payment_method}</div>
                            </div>
                            <div class="sr-stat-group">
                                <div class="sr-stat-label">Pincodes</div>
                                <div class="sr-stat-val">${ctx.pickup_pincode} &rarr; ${ctx.delivery_pincode}</div>
                            </div>
                        </div>

                        <!-- Courier List -->
                        <div class="sr-list">
                `;

                if (couriers.length === 0) {
                    html += `<div class="text-center text-muted p-4">No couriers available for this route.</div>`;
                } else {
                    couriers.forEach(c => {
                        let badges = '';
                        if (c.rate === min_rate) badges += `<span class="sr-badge bg-blue">Cheapest</span>`;
                        if (c.estimated_delivery_days === min_days) badges += `<span class="sr-badge bg-green">Fastest</span>`;

                        let logo = c.courier_name.charAt(0).toUpperCase();

                        html += `
                            <div class="sr-card">
                                <div class="sr-logo">${logo}</div>
                                <div class="sr-info">
                                    <div class="sr-name">${c.courier_name} ${badges}</div>
                                    <div class="sr-meta">ID: ${c.courier_company_id} | ${c.courier_name} Surface</div>
                                </div>
                                <div class="sr-metric">
                                    <div class="sr-metric-val">${c.estimated_delivery_days} Days</div>
                                    <div class="sr-metric-lbl">Estimated Time</div>
                                </div>
                                <div class="sr-metric">
                                    <div class="sr-metric-val">
                                        <span class="sr-badge bg-yellow" style="margin:0;">★ ${c.rating}</span>
                                    </div>
                                    <div class="sr-metric-lbl">Rating</div>
                                </div>
                                <div class="sr-price">₹${c.rate}</div>
                                <button class="sr-btn" data-id="${c.courier_company_id}" data-rate="${c.rate}">Ship Now</button>
                            </div>
                        `;
                    });
                }

                html += `</div></div>`; // Close list and container

                let $wrapper = d.get_field('ui_html').$wrapper;
                $wrapper.html(html);

                // Bind Click
                $wrapper.find('.sr-btn').on('click', function () {
                    let courier_id = $(this).data('id');
                    let rate = $(this).data('rate');
                    frappe.call({
                        method: 'adi_shipment.api.shiprocket.assign_awb_for_shipment',
                        args: {
                            shipment_name: frm.doc.name,
                            courier_company_id: courier_id,
                            amount: rate
                        },
                        freeze: true,
                        freeze_message: "Assigning AWB...",
                        callback: function (r) {
                            if (!r.exc) {
                                d.hide();
                                frappe.msgprint("AWB Assigned Successfully!");
                                frm.reload_doc();
                            }
                        }
                    });
                });

            } else {
                let msg = r.message && r.message.error ? r.message.error : "No couriers available.";
                d.get_field('ui_html').$wrapper.html(`<div class="text-center text-danger p-4">${msg}</div>`);
            }
        }
    });
}
