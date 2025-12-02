frappe.pages['shiprocket_dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Shiprocket Dashboard',
        single_column: true
    });

    page.set_primary_action('Refresh', () => render_dashboard(page));

    render_dashboard(page);
}

function render_dashboard(page) {
    $(page.body).empty();

    // Loading State
    $(page.body).append('<div class="text-center text-muted" style="padding: 50px;">Loading Dashboard...</div>');

    frappe.call({
        method: "adi_shipment.adi_shipment.page.shiprocket_dashboard.shiprocket_dashboard.get_dashboard_data",
        callback: function (r) {
            $(page.body).empty();

            if (r.message) {
                let data = r.message;
                let stats = data.stats;

                // 1. Stats Cards
                let stats_html = `
                    <div class="row" style="margin-bottom: 30px;">
                        ${get_card_html("Total Orders", stats.total, "blue")}
                        ${get_card_html("New", stats.new, "orange")}
                        ${get_card_html("Pickup Scheduled", stats.pickup_scheduled, "cyan")}
                        ${get_card_html("Shipped", stats.shipped, "purple")}
                        ${get_card_html("Delivered", stats.delivered, "green")}
                    </div>
                `;

                // 2. Orders Table
                let table_html = `
                    <div class="frappe-card">
                        <div class="frappe-card-head">
                            <h5>Recent Shiprocket Orders</h5>
                        </div>
                        <div class="frappe-card-body">
                            <table class="table table-bordered table-hover">
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Date</th>
                                        <th>Customer</th>
                                        <th>Status</th>
                                        <th>Payment</th>
                                        <th>Total</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.orders.map(order => `
                                        <tr>
                                            <td>${order.channel_order_id || order.id}</td>
                                            <td>${order.created_at}</td>
                                            <td>${order.customer_name}<br><small class="text-muted">${order.customer_email}</small></td>
                                            <td><span class="indicator ${get_status_color(order.status)}">${order.status}</span></td>
                                            <td>${order.payment_method}</td>
                                            <td>₹ ${order.total}</td>
                                            <td>
                                                <button class="btn btn-xs btn-default" onclick="window.open('https://app.shiprocket.in/orders/processing?search=${order.id}', '_blank')">
                                                    View in Shiprocket
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;

                $(page.body).append(`<div class="container-fluid" style="padding-top: 20px;">${stats_html} ${table_html}</div>`);
            }
        }
    });
}

function get_card_html(label, value, color) {
    return `
        <div class="col-sm-2">
            <div class="widget-box">
                <div class="widget-title text-muted">${label}</div>
                <div class="widget-body text-${color}" style="font-size: 24px; font-weight: bold;">${value}</div>
            </div>
        </div>
    `;
}

function get_status_color(status) {
    status = status.toUpperCase();
    if (status === 'NEW') return 'orange';
    if (status === 'DELIVERED') return 'green';
    if (status === 'CANCELLED') return 'red';
    if (status === 'SHIPPED') return 'purple';
    return 'blue';
}

// Add some basic styles
$('head').append(`
    <style>
        .widget-box {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 15px;
            text-align: center;
            margin-bottom: 15px;
        }
        .frappe-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            margin-bottom: 20px;
        }
        .frappe-card-head {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .frappe-card-body {
            padding: 0;
        }
        .frappe-card-body table {
            margin: 0;
            border: none;
        }
    </style>
`);
