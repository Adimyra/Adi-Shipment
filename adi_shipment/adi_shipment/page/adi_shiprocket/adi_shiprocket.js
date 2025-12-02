frappe.pages['adi_shiprocket'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'ADI Shiprocket',
        single_column: true
    });

    // Add Tabs
    const $tabs = $(`
        <div class="shiprocket-tabs" style="margin-bottom: 20px;">
            <ul class="nav nav-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="dashboard-tab" data-toggle="tab" data-target="#dashboard" role="tab" style="cursor: pointer;">Dashboard</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" id="create-shipment-tab" data-toggle="tab" data-target="#create-shipment" role="tab" style="cursor: pointer;">Create Shipment</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" id="rate-calc-tab" data-toggle="tab" data-target="#rate-calc" role="tab" style="cursor: pointer;">Rate Calculator</a>
                </li>
            </ul>
            <div class="tab-content" style="padding-top: 20px;">
                <div class="tab-pane fade show active" id="dashboard" role="tabpanel"></div>
                <div class="tab-pane fade" id="create-shipment" role="tabpanel"></div>
                <div class="tab-pane fade" id="rate-calc" role="tabpanel"></div>
            </div>
        </div>
    `).appendTo(page.main);

    // --- Dashboard Logic ---
    function render_dashboard() {
        const $container = $('#dashboard');
        $container.html('<div class="text-center p-5"><div class="spinner-border" role="status"></div><br>Loading Dashboard...</div>');

        frappe.call({
            method: "adi_shipment.adi_shipment.page.adi_shiprocket.adi_shiprocket.get_dashboard_data",
            callback: function (r) {
                if (r.message && !r.message.error) {
                    const stats = r.message.stats;
                    const orders = r.message.orders;

                    let stats_html = `
                        <div class="row" style="margin-bottom: 30px;">
                            <div class="col-md-2 col-sm-4 col-6">
                                <div class="dashboard-stat-box" style="background: #F8F9FA; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #E2E6EA;">
                                    <h3 style="color: #212529; margin-bottom: 5px;">${stats.total}</h3>
                                    <span style="color: #6C757D; font-size: 12px; text-transform: uppercase; font-weight: 600;">Total Orders</span>
                                </div>
                            </div>
                            <div class="col-md-2 col-sm-4 col-6">
                                <div class="dashboard-stat-box" style="background: #E3F2FD; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #BBDEFB;">
                                    <h3 style="color: #1976D2; margin-bottom: 5px;">${stats.new}</h3>
                                    <span style="color: #1976D2; font-size: 12px; text-transform: uppercase; font-weight: 600;">New</span>
                                </div>
                            </div>
                            <div class="col-md-2 col-sm-4 col-6">
                                <div class="dashboard-stat-box" style="background: #FFF3E0; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #FFE0B2;">
                                    <h3 style="color: #F57C00; margin-bottom: 5px;">${stats.pickup_scheduled}</h3>
                                    <span style="color: #F57C00; font-size: 12px; text-transform: uppercase; font-weight: 600;">Pickup Scheduled</span>
                                </div>
                            </div>
                            <div class="col-md-2 col-sm-4 col-6">
                                <div class="dashboard-stat-box" style="background: #E8F5E9; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #C8E6C9;">
                                    <h3 style="color: #388E3C; margin-bottom: 5px;">${stats.shipped}</h3>
                                    <span style="color: #388E3C; font-size: 12px; text-transform: uppercase; font-weight: 600;">Shipped</span>
                                </div>
                            </div>
                            <div class="col-md-2 col-sm-4 col-6">
                                <div class="dashboard-stat-box" style="background: #E0F2F1; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #B2DFDB;">
                                    <h3 style="color: #00796B; margin-bottom: 5px;">${stats.delivered}</h3>
                                    <span style="color: #00796B; font-size: 12px; text-transform: uppercase; font-weight: 600;">Delivered</span>
                                </div>
                            </div>
                        </div>
                    `;

                    let table_html = `
                        <h4 style="margin-bottom: 15px;">Recent Orders</h4>
                        <div class="table-responsive">
                            <table class="table table-bordered table-hover">
                                <thead style="background-color: #f8f9fa;">
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Status</th>
                                        <th>Total</th>
                                        <th>Payment</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    if (orders.length > 0) {
                        orders.forEach(order => {
                            let status_color = "secondary";
                            if (order.status === "NEW") status_color = "primary";
                            else if (order.status === "SHIPPED") status_color = "info";
                            else if (order.status === "DELIVERED") status_color = "success";
                            else if (order.status === "CANCELED") status_color = "danger";

                            table_html += `
                                <tr>
                                    <td>${order.channel_order_id || order.id}</td>
                                    <td>${order.customer_name}</td>
                                    <td><span class="indicator ${status_color}">${order.status}</span></td>
                                    <td>₹ ${order.total}</td>
                                    <td>${order.payment_method}</td>
                                    <td>
                                        <a href="https://app.shiprocket.in/orders/processing?search=${order.id}" target="_blank" class="btn btn-xs btn-default">
                                            View in Shiprocket
                                        </a>
                                    </td>
                                </tr>
                            `;
                        });
                    } else {
                        table_html += `<tr><td colspan="6" class="text-center text-muted">No orders found.</td></tr>`;
                    }

                    table_html += `</tbody></table></div>`;

                    $container.html(stats_html + table_html);
                } else {
                    $container.html(`<div class="alert alert-danger">Error loading dashboard: ${r.message ? r.message.error : "Unknown error"}</div>`);
                }
            }
        });
    }

    // --- Page Load Logic ---
    // (Removed Autofill from Delivery Note as requested)

    // --- Create Shipment Logic ---
    function render_create_shipment() {
        const $container = $('#create-shipment');

        let htmlContent = `
    <div class="row">
        <div class="col-md-8 offset-md-2">
            <form id="order-details-form" style="background: #fff; padding: 20px; border: 1px solid #d1d8dd; border-radius: 4px;">
                <h4>Create Adhoc Order</h4>
                <hr>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Order ID *</label>
                            <input type="text" class="form-control" name="order_id" required>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Order Date *</label>
                            <input type="datetime-local" class="form-control" name="order_date" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Pickup Location</label>
                            <input type="text" class="form-control" name="pickup_location" placeholder="e.g. work" value="work">
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Payment Method</label>
                            <select class="form-control" name="payment_method">
                                <option value="Prepaid">Prepaid</option>
                                <option value="COD">COD</option>
                            </select>
                        </div>
                    </div>

                    <h5 class="mt-3">Billing Details</h5>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>First Name *</label>
                            <input type="text" class="form-control" name="billing_customer_name" required>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Last Name</label>
                            <input type="text" class="form-control" name="billing_last_name">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Address Line 1 *</label>
                        <input type="text" class="form-control" name="billing_address" required>
                    </div>
                    <div class="form-group">
                        <label>Address Line 2</label>
                        <input type="text" class="form-control" name="billing_address_2">
                    </div>
                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>City *</label>
                            <input type="text" class="form-control" name="billing_city" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Pincode *</label>
                            <input type="text" class="form-control" name="billing_pincode" maxlength="6" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>State *</label>
                            <input type="text" class="form-control" name="billing_state" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Email *</label>
                            <input type="email" class="form-control" name="billing_email" required>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Phone *</label>
                            <input type="tel" class="form-control" name="billing_phone" required>
                        </div>
                    </div>

                    <div class="form-group mt-3">
                        <div class="checkbox">
                            <label>
                                <input type="checkbox" name="shipping_is_billing" checked> Shipping Address is same as Billing Address
                            </label>
                        </div>
                    </div>

                    <div id="shipping-details" style="display:none;">
                        <h5 class="mt-3">Shipping Details</h5>
                        <div class="row">
                            <div class="col-md-6 form-group">
                                <label>First Name *</label>
                                <input type="text" class="form-control" name="shipping_customer_name">
                            </div>
                            <div class="col-md-6 form-group">
                                <label>Last Name</label>
                                <input type="text" class="form-control" name="shipping_last_name">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Address Line 1 *</label>
                            <input type="text" class="form-control" name="shipping_address">
                        </div>
                        <div class="form-group">
                            <label>Address Line 2</label>
                            <input type="text" class="form-control" name="shipping_address_2">
                        </div>
                        <div class="row">
                            <div class="col-md-4 form-group">
                                <label>City *</label>
                                <input type="text" class="form-control" name="shipping_city">
                            </div>
                            <div class="col-md-4 form-group">
                                <label>Pincode *</label>
                                <input type="text" class="form-control" name="shipping_pincode" maxlength="6">
                            </div>
                            <div class="col-md-4 form-group">
                                <label>State *</label>
                                <input type="text" class="form-control" name="shipping_state">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 form-group">
                                <label>Email *</label>
                                <input type="email" class="form-control" name="shipping_email">
                            </div>
                            <div class="col-md-6 form-group">
                                <label>Phone *</label>
                                <input type="tel" class="form-control" name="shipping_phone">
                            </div>
                        </div>
                    </div>

                    <h5 class="mt-3">Item Details</h5>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Item Name *</label>
                            <input type="text" class="form-control" name="item_name" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>SKU *</label>
                            <input type="text" class="form-control" name="sku" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Units *</label>
                            <input type="number" class="form-control" name="units" value="1" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Selling Price *</label>
                            <input type="number" class="form-control" name="selling_price" required>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Subtotal *</label>
                            <input type="number" class="form-control" name="sub_total" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-3 form-group">
                            <label>Length (cm) *</label>
                            <input type="number" class="form-control" name="length" value="10" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Breadth (cm) *</label>
                            <input type="number" class="form-control" name="breadth" value="10" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Height (cm) *</label>
                            <input type="number" class="form-control" name="height" value="10" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Weight (kg) *</label>
                            <input type="number" class="form-control" name="weight" value="0.5" step="0.01" required>
                        </div>
                    </div>

                    <div class="form-group mt-3 text-right">
                        <button type="submit" class="btn btn-primary">Create Order</button>
                    </div>
            </form>
        </div>
    </div>
    `;

        $container.html(htmlContent);

        // Toggle Shipping Details
        $container.find('[name="shipping_is_billing"]').on('change', function () {
            if ($(this).is(':checked')) {
                $('#shipping-details').hide();
            } else {
                $('#shipping-details').show();
            }
        });

        $container.find('#order-details-form').on('submit', function (e) {
            e.preventDefault();
            const formData = $(this).serializeArray();
            let data = {};
            formData.forEach(item => data[item.name] = item.value);

            // VALIDATION
            const required = {
                "order_id": "Order ID",
                "order_date": "Order Date",
                "billing_customer_name": "Billing First Name",
                "billing_address": "Billing Address Line 1",
                "billing_city": "Billing City",
                "billing_pincode": "Billing Pincode",
                "billing_state": "Billing State",
                "billing_email": "Billing Email",
                "billing_phone": "Billing Phone",
                "item_name": "Item Name",
                "sku": "SKU",
                "units": "Units",
                "selling_price": "Selling Price",
                "sub_total": "Subtotal",
                "length": "Length",
                "breadth": "Breadth",
                "height": "Height",
                "weight": "Weight"
            };

            for (let key in required) {
                if (!data[key] || String(data[key]).trim() === "") {
                    frappe.msgprint({
                        title: 'Validation Error',
                        message: `Please fill ${required[key]} `,
                        indicator: 'orange'
                    });
                    return;
                }
            }

            if (data.billing_pincode.length !== 6) {
                frappe.msgprint({
                    title: 'Validation Error',
                    message: "Billing Pincode must be 6 digits",
                    indicator: 'orange'
                });
                return;
            }
            if (data.billing_phone.length < 10 || data.billing_phone.length > 15) {
                frappe.msgprint({
                    title: 'Validation Error',
                    message: "Billing Phone must be between 10 and 15 digits",
                    indicator: 'orange'
                });
                return;
            }

            const shipping_is_billing = $container.find('[name="shipping_is_billing"]').is(':checked');

            if (!shipping_is_billing) {
                const shipping_required = {
                    "shipping_customer_name": "Shipping First Name",
                    "shipping_address": "Shipping Address Line 1",
                    "shipping_city": "Shipping City",
                    "shipping_pincode": "Shipping Pincode",
                    "shipping_state": "Shipping State",
                    "shipping_email": "Shipping Email",
                    "shipping_phone": "Shipping Phone"
                };
                for (let key in shipping_required) {
                    if (!data[key] || String(data[key]).trim() === "") {
                        frappe.msgprint({
                            title: 'Validation Error',
                            message: `Please fill ${shipping_required[key]} `,
                            indicator: 'orange'
                        });
                        return;
                    }
                }
                if (data.shipping_pincode.length !== 6) {
                    frappe.msgprint({
                        title: 'Validation Error',
                        message: "Shipping Pincode must be 6 digits",
                        indicator: 'orange'
                    });
                    return;
                }
                if (data.shipping_phone.length < 10 || data.shipping_phone.length > 15) {
                    frappe.msgprint({
                        title: 'Validation Error',
                        message: "Shipping Phone must be between 10 and 15 digits",
                        indicator: 'orange'
                    });
                    return;
                }
            }

            // Construct Payload
            let payload = {
                order_id: data.order_id,
                order_date: data.order_date.replace("T", " ") + ":00", // Add seconds
                pickup_location: data.pickup_location || "work",
                billing_customer_name: data.billing_customer_name,
                billing_last_name: data.billing_last_name,
                billing_address: data.billing_address,
                billing_address_2: data.billing_address_2 || "",
                billing_city: data.billing_city,
                billing_pincode: String(data.billing_pincode), // Ensure string
                billing_state: data.billing_state,
                billing_country: "India",
                billing_email: data.billing_email,
                billing_phone: data.billing_phone,

                shipping_is_billing: shipping_is_billing ? 1 : 0, // Must be INT 1 or 0

                order_items: [{
                    name: data.item_name,
                    sku: data.sku,
                    units: parseInt(data.units) || 1,
                    selling_price: parseFloat(data.selling_price) || 0,
                    discount: 0,
                    tax: 0,
                    hsn: ""
                }],
                payment_method: data.payment_method,
                sub_total: parseFloat(data.sub_total) || 0,
                length: parseFloat(data.length) || 10,
                breadth: parseFloat(data.breadth) || 10,
                height: parseFloat(data.height) || 10,
                weight: parseFloat(data.weight) || 0.5
            };

            if (!shipping_is_billing) {
                payload.shipping_customer_name = data.shipping_customer_name;
                payload.shipping_last_name = data.shipping_last_name;
                payload.shipping_address = data.shipping_address;
                payload.shipping_address_2 = data.shipping_address_2 || "";
                payload.shipping_city = data.shipping_city;
                payload.shipping_pincode = String(data.shipping_pincode); // Ensure string
                payload.shipping_country = "India";
                payload.shipping_state = data.shipping_state;
                payload.shipping_email = data.shipping_email;
                payload.shipping_phone = data.shipping_phone;
            } else {
                // Even if shipping_is_billing is 1, some users report better success sending the fields anyway.
                // But strictly per API, we shouldn't need to. Let's stick to the user's request:
                // "If the buyer’s shipping address is the same as the billing address, set shipping_is_billing to 1 (or "true") and do not send any shipping_* fields."
            }

            console.log("Sending Payload:", payload);

            frappe.call({
                method: "adi_shipment.adi_shipment.page.adi_shiprocket.adi_shiprocket.create_custom_order",
                args: { order_details_str: JSON.stringify(payload) },
                freeze: true,
                freeze_message: "Creating Order...",
                callback: function (r) {
                    if (r.message && !r.message.error) {
                        frappe.msgprint({
                            title: 'Success',
                            message: `Order Created Successfully! < br > Order ID: ${r.message.order_id} <br>Shipment ID: ${r.message.shipment_id}`,
                            indicator: 'green'
                        });
                        // Switch to dashboard to see it
                        $('#dashboard-tab').tab('show');
                        render_dashboard();
                    } else {
                        frappe.msgprint({
                            title: 'Error',
                            message: r.message ? r.message.error : "Unknown Error",
                            indicator: 'red'
                        });
                    }
                }
            });
        });
    }

    // --- Rate Calculator Logic ---
    function render_rate_calc() {
        const $container = $('#rate-calc');

        let htmlContent = `
        <div class="row">
            <div class="col-md-4">
                <form id="rate-calc-form" style="background: #fff; padding: 20px; border: 1px solid #d1d8dd; border-radius: 4px;">
                    <h4>Rate Calculator</h4>
                    <hr>
                        <div class="form-group">
                            <label>Pickup Pincode *</label>
                            <input type="number" class="form-control" name="pickup_postcode" required>
                        </div>
                        <div class="form-group">
                            <label>Delivery Pincode *</label>
                            <input type="number" class="form-control" name="delivery_postcode" required>
                        </div>
                        <div class="form-group">
                            <label>Weight (kg) *</label>
                            <input type="number" class="form-control" name="weight" value="0.5" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>COD (1=Yes, 0=No)</label>
                            <select class="form-control" name="cod">
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Check Rates</button>
                </form>
            </div>
            <div class="col-md-8">
                <div id="rate-results" style="display:none;">
                    <h4>Available Couriers</h4>
                    <div class="table-responsive">
                        <table class="table table-bordered table-striped">
                            <thead>
                                <tr>
                                    <th>Courier</th>
                                    <th>Rating</th>
                                    <th>Est. Days</th>
                                    <th>Chargeable Wt.</th>
                                    <th>Rate</th>
                                </tr>
                            </thead>
                            <tbody id="rate-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        `;

        $container.html(htmlContent);

        $container.find('#rate-calc-form').on('submit', function (e) {
            e.preventDefault();
            const formData = $(this).serializeArray();
            let data = {};
            formData.forEach(item => data[item.name] = item.value);

            frappe.call({
                method: "adi_shipment.adi_shipment.page.adi_shiprocket.adi_shiprocket.get_freight_price_from_dimension",
                args: { freight_details_str: JSON.stringify(data) },
                freeze: true,
                freeze_message: "Fetching Rates...",
                callback: function (r) {
                    if (r.message && r.message.data && r.message.data.available_courier_companies) {
                        const couriers = r.message.data.available_courier_companies;
                        const $tbody = $('#rate-table-body');
                        $tbody.empty();

                        couriers.forEach(c => {
                            $tbody.append(`
                                <tr>
                                    <td>${c.courier_name}</td>
                                    <td>${c.rating}</td>
                                    <td>${c.estimated_delivery_days}</td>
                                    <td>${c.charge_weight} kg</td>
                                    <td>₹ ${c.rate}</td>
                                </tr>
                            `);
                        });
                        $('#rate-results').show();
                    } else {
                        frappe.msgprint({
                            title: 'Error',
                            message: r.message ? (r.message.error || "No couriers found") : "Unknown Error",
                            indicator: 'red'
                        });
                    }
                }
            });
        });
    }

    // Initial Render
    render_dashboard();
    render_create_shipment();
    render_rate_calc();

    // Refresh dashboard when tab is clicked
    $('#dashboard-tab').on('click', function () {
        render_dashboard();
    });
};
