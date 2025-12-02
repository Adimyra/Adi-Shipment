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
                            <input type="text" class="form-control" name="pickup_location" placeholder="e.g. Primary">
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
                            <input type="number" class="form-control" name="billing_pincode" required>
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

        // Autofill for testing
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        $container.find('[name="order_date"]').val(now.toISOString().slice(0, 16));
        $container.find('[name="order_id"]').val('ORD-' + Math.floor(Math.random() * 10000));
        $container.find('[name="billing_customer_name"]').val('Test Customer');
        $container.find('[name="billing_address"]').val('123 Test Street');
        $container.find('[name="billing_city"]').val('Mumbai');
        $container.find('[name="billing_pincode"]').val('400001');
        $container.find('[name="billing_state"]').val('Maharashtra');
        $container.find('[name="billing_email"]').val('test@example.com');
        $container.find('[name="billing_phone"]').val('9999999999');
        $container.find('[name="item_name"]').val('Test Item');
        $container.find('[name="sku"]').val('TEST-SKU-001');
        $container.find('[name="selling_price"]').val('100');
        $container.find('[name="sub_total"]').val('100');

        $container.find('#order-details-form').on('submit', function (e) {
            e.preventDefault();
            const formData = $(this).serializeArray();
            let data = {};
            formData.forEach(item => data[item.name] = item.value);

            // Construct Payload
            const payload = {
                order_id: data.order_id,
                order_date: data.order_date.replace("T", " "),
                pickup_location: data.pickup_location || "Primary",
                billing_customer_name: data.billing_customer_name,
                billing_last_name: data.billing_last_name,
                billing_address: data.billing_address,
                billing_address_2: data.billing_address_2 || "",
                billing_city: data.billing_city,
                billing_pincode: data.billing_pincode,
                billing_state: data.billing_state,
                billing_country: "India",
                billing_email: data.billing_email,
                billing_phone: data.billing_phone,

                shipping_is_billing: 1,

                order_items: [{
                    name: data.item_name,
                    sku: data.sku,
                    units: parseInt(data.units) || 1,
                    selling_price: parseFloat(data.selling_price) || 0,
                    discount: "",
                    tax: "",
                    hsn: ""
                }],
                payment_method: data.payment_method,
                sub_total: parseFloat(data.sub_total) || 0,
                length: parseFloat(data.length) || 10,
                breadth: parseFloat(data.breadth) || 10,
                height: parseFloat(data.height) || 10,
                weight: parseFloat(data.weight) || 0.5
            };

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
                            message: `Order Created Successfully!<br>Order ID: ${r.message.order_id}<br>Shipment ID: ${r.message.shipment_id}`,
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
}
