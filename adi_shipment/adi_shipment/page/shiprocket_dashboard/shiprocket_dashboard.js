frappe.pages['shiprocket_dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Shiprocket Dashboard',
        single_column: true
    });

    wrapper.page = page;

    // -- Top Filters --
    let $filter_row = $(`<div class="row filter-row" style="margin-bottom: 20px;"></div>`).appendTo(page.main);

    // 1. Search Filter
    $filter_row.append(`
        <div class="col-md-5">
            <div class="form-group">
                <input type="text" class="form-control input-sm input-search" placeholder="Search Order ID, AWB, Mobile..." style="border-radius: 20px; padding-left: 15px;">
            </div>
        </div>
    `);

    // 2. Date Filter (Last 30 Days default, but we use a date range picker logic if possible, or just two fields)
    // Using standard frappe date fields is easier
    $filter_row.append(`
        <div class="col-md-3">
            <input type="date" class="form-control input-sm input-date-from" placeholder="From Date" style="border-radius: 20px;">
        </div>
        <div class="col-md-3">
            <input type="date" class="form-control input-sm input-date-to" placeholder="To Date" style="border-radius: 20px;">
        </div>
    `);

    // 3. Refresh Button (Icon)
    $filter_row.append(`
        <div class="col-md-1 text-right">
             <button class="btn btn-default btn-refresh btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;"><i class="fa fa-refresh"></i></button>
        </div>
    `);

    // -- Tabs --
    let tabs = ["All", "New", "Ready To Ship", "Pickups", "In Transit", "Delivered", "RTO", "Cancelled"];
    let $tab_nav = $(`<ul class="nav nav-tabs" style="margin-bottom: 20px; border-bottom: 2px solid #ddd;"></ul>`).appendTo(page.main);

    tabs.forEach((tab, index) => {
        let active = index === 0 ? "active" : "";
        $tab_nav.append(`
            <li class="${active}">
                <a href="#" class="tab-link" data-tab="${tab}" style="border:none; background:transparent; font-weight: 500; font-size: 13px;">${tab}</a>
            </li>
        `);
    });

    // -- Content Container --
    let $content = $(`<div class="dashboard-content"></div>`).appendTo(page.main);

    // Bind Events
    wrapper.active_tab = "All";

    $tab_nav.on('click', '.tab-link', function (e) {
        e.preventDefault();
        $tab_nav.find('li').removeClass('active');
        $(this).parent().addClass('active');
        wrapper.active_tab = $(this).data('tab');
        render_dashboard(wrapper);
    });

    $filter_row.find('.input-search').on('change', function () {
        wrapper.search_term = $(this).val();
        render_dashboard(wrapper);
    });

    $filter_row.find('.input-date-from').on('change', function () {
        wrapper.from_date = $(this).val();
        render_dashboard(wrapper);
    });

    $filter_row.find('.input-date-to').on('change', function () {
        wrapper.to_date = $(this).val();
        render_dashboard(wrapper);
    });

    $filter_row.find('.btn-refresh').on('click', function () {
        render_dashboard(wrapper);
    });

    // Custom CSS
    add_custom_css();

    render_dashboard(wrapper);
}

function render_dashboard(wrapper) {
    let $container = wrapper.page.main.find('.dashboard-content');
    $container.empty();

    // Loading State
    $container.append(`
        <div class="flex justify-center align-center" style="height: 300px;">
            <div class="text-center">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2">Fetching Data...</p>
            </div>
        </div>
    `);

    frappe.call({
        method: "adi_shipment.adi_shipment.page.shiprocket_dashboard.shiprocket_dashboard.get_dashboard_data",
        args: {
            search_term: wrapper.search_term || '',
            tab_view: wrapper.active_tab || 'All',
            from_date: wrapper.from_date,
            to_date: wrapper.to_date
        },
        callback: function (r) {
            $container.empty();

            if (r.message) {
                let data = r.message;
                let stats = data.stats;
                let orders = data.orders || [];

                // 1. Stats Cards
                let stats_html = `
                    <div class="row overview-stats-row">
                        ${get_stat_card("Total Orders", stats.total, "blue", "fa fa-shopping-cart")}
                        ${get_stat_card("New / Processing", stats.new, "orange", "fa fa-clock-o")}
                        ${get_stat_card("Pickup Scheduled", stats.pickup_scheduled, "cyan", "fa fa-truck")}
                        ${get_stat_card("In Transit", stats.in_transit, "purple", "fa fa-plane")}
                        ${get_stat_card("Delivered", stats.delivered, "green", "fa fa-check-circle")}
                        ${get_stat_card("Cancelled", stats.cancelled, "red", "fa fa-ban")}
                    </div>
                `;

                // 2. Orders List
                let table_html = `
                    <div class="frappe-card dashboard-list">
                        <div class="frappe-card-head" style="background:#f9f9f9; padding:10px 15px;">
                            <span class="text-muted">Filtered Orders (${orders.length})</span>
                        </div>
                        <div class="frappe-card-body table-responsive">
                            <table class="table table-hover" style="font-size: 13px;">
                                <thead style="background-color: #f1f1f1; color: #555;">
                                    <tr>
                                        <th>Order Details</th>
                                        <th>Customer</th>
                                        <th>Status</th>
                                        <th>Payment</th>
                                        <th>Courier / AWB</th>
                                        <th class="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.length > 0 ? orders.map(order => get_order_row(order)).join('') : '<tr><td colspan="6" class="text-center text-muted p-5">No orders found.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;

                $container.append(`<div class="dashboard-container">${stats_html} ${table_html}</div>`);
            }
        }
    });
}

function get_stat_card(label, value, color, icon) {
    return `
        <div class="col-md-2 col-sm-4 col-xs-6 mb-3">
            <div class="stat-card" style="border-top: 3px solid ${get_color_hex(color)};">
                <div class="flex justify-between"> 
                    <div class="stat-details">
                        <h3 class="text-${color}" style="margin:0; font-weight:700;">${value}</h3>
                        <span class="text-muted" style="font-size:11px; text-transform:uppercase;">${label}</span>
                    </div>
                    <div class="stat-icon text-${color}">
                        <i class="${icon}"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function get_color_hex(color) {
    const colors = {
        'blue': '#4da1ff',
        'orange': '#ffa00a',
        'cyan': '#00d2d3',
        'purple': '#5f27cd',
        'green': '#2ecc71',
        'red': '#ff6b6b'
    };
    return colors[color] || '#ddd';
}

function get_order_row(order) {
    let status_color = get_status_color(order.status);
    let shipment_id = order.shipments && order.shipments.length > 0 ? order.shipments[0].id : null;
    let awb_code = order.display_awb || (order.shipments && order.shipments.length > 0 ? order.shipments[0].awb : null);
    let tracking_url = awb_code ? `https://shiprocket.co/tracking/${awb_code}` : '#';
    let courier_name = order.display_courier || '';

    // Action Buttons Logic
    let actions = '';

    // Status based actions
    let status = (order.status || '').toUpperCase();

    if (status === 'NEW' || status === 'PROCESSING') {
        // Likely needs scheduling or label
        if (shipment_id) {
            actions += `<button class="btn btn-xs btn-primary-soft mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')">Label</button>`;
        }
    } else if (status === 'PICKUP SCHEDULED' || status === 'PICKUP QUEUED') {
        if (shipment_id) {
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'manifest')">Manifest</button>`;
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')">Label</button>`;
        }
    } else if (['SHIPPED', 'IN TRANSIT', 'OUT FOR DELIVERY'].includes(status)) {
        if (awb_code) {
            actions += `<a href="${tracking_url}" target="_blank" class="btn btn-xs btn-info-soft mr-1"><i class="fa fa-map-marker"></i> Track</a>`;
        }
    } else if (status === 'DELIVERED') {
        actions += `<span class="text-muted text-xs">Completed</span>`;
    }

    // Default Fallback if no specific action matched but shipment exists
    if (actions === '' && shipment_id) {
        actions += `<button class="btn btn-xs btn-default" onclick="print_shiprocket_doc('${shipment_id}', 'label')"><i class="fa fa-print"></i></button>`;
    }

    return `
        <tr>
            <td>
                <div class="font-weight-bold text-primary" style="cursor:pointer;" onclick="window.open('https://app.shiprocket.in/orders/processing?search=${order.id}', '_blank')">
                    ${order.channel_order_id || order.id}
                </div>
                <div class="text-muted text-xs">${order.created_at}</div>
            </td>
            <td>
                <div class="font-weight-bold" style="font-size:12px;">${order.customer_name}</div>
                <div class="text-muted text-xs">${order.customer_email || ''}</div>
                <div class="text-muted text-xs">${order.customer_phone || ''}</div>
            </td>
            <td>
                <span class="indicator-pill ${status_color}">${order.status}</span>
            </td>
            <td>
                <div><span class="badge badge-light">${order.payment_method}</span></div>
                <div class="font-weight-bold mt-1">₹ ${order.total}</div>
            </td>
             <td>
                <div class="font-weight-bold text-dark" style="font-size:12px;">${courier_name}</div>
                <div class="text-muted text-xs">${awb_code ? `AWB: ${awb_code}` : '-'}</div>
            </td>
            <td class="text-right">
                <div class="btn-group">
                    ${actions}
                </div>
            </td>
        </tr>
    `;
}

// Global function to be called from onclick
window.print_shiprocket_doc = function (shipment_id, type) {
    if (!shipment_id) return;

    let method = type === 'label' ? 'adi_shipment.api.shiprocket.generate_label' : 'adi_shipment.api.shiprocket.generate_manifest_by_id';

    // We need a wrapper because the existing API takes 'shipment_name' (DocName) not shipment_id directly
    // Wait, the existing API takes 'shipment_name' (Frappe Doc).
    // The dashboard lists Shiprocket orders which might NOT be linked to Frappe "Shipment" docs perfectly 1:1 in all cases or we want to use direct API.
    // However, to reuse the Code, we assume we have a wrapper or we call a new python method.
    // Let's create a new python method in dashboard controller to handle raw IDs.

    frappe.call({
        method: "adi_shipment.adi_shipment.page.shiprocket_dashboard.shiprocket_dashboard.print_shiprocket_artifact",
        args: {
            shipment_id: shipment_id,
            type: type
        },
        freeze: true,
        callback: function (r) {
            if (r.message && r.message.url) {
                window.open(r.message.url, '_blank');
            }
        }
    });
}

function get_status_color(status) {
    status = (status || '').toUpperCase();
    if (['NEW', 'PROCESSING', 'INVOICED', 'AWB ASSIGNED'].includes(status)) return 'orange';
    if (['DELIVERED', 'COMPLETED'].includes(status)) return 'green';
    if (['CANCELED', 'CANCELLED'].includes(status)) return 'red';
    if (['SHIPPED', 'PICKUP SCHEDULED', 'OUT FOR DELIVERY'].includes(status) || status.includes('TRANSIT')) return 'purple';
    if (status.includes('RTO')) return 'red';
    return 'blue';
}

function add_custom_css() {
    $('head').append(`
        <style>
            /* Layout & Background */
            .layout-main-section {
                 background-color: #f4f6f8;
            }
            .dashboard-container {
                padding: 10px;
            }

            /* Filters */
            .filter-row .form-control {
                background: #fff;
                border: 1px solid #dfe1e5;
                font-size: 13px;
                box-shadow: none;
            }
            
            /* Tabs */
            .nav-tabs {
                border-bottom: 2px solid #e0e0e0;
            }
            .nav-tabs > li > a {
                color: #555;
                padding: 10px 15px;
                margin-right: 5px;
                border-bottom: 2px solid transparent;
            }
            .nav-tabs > li.active > a, 
            .nav-tabs > li.active > a:hover, 
            .nav-tabs > li.active > a:focus {
                color: #5f27cd;
                background-color: transparent;
                border: none;
                border-bottom: 2px solid #5f27cd;
            }
            
            /* Stat Cards */
            .stat-card {
                background: #fff;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                height: 100%;
                transition: transform 0.2s;
            }
            .stat-card:hover {
                 transform: translateY(-2px);
                 box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            }
            
            /* Table */
            .dashboard-list {
                background: #fff;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                overflow: hidden;
            }
            .table-hover tbody tr:hover {
                background-color: #f9faff;
            }
            
            /* Buttons */
            .btn-primary-soft {
                background-color: #e8eaf6;
                color: #3f51b5;
                border: none;
            }
            .btn-primary-soft:hover {
                background-color: #c5cae9;
                color: #303f9f;
            }
             .btn-info-soft {
                background-color: #e1f5fe;
                color: #039be5;
                border: none;
            }
            
            /* Indicators */
            .indicator-pill {
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .indicator-pill.orange { background: #fff8e1; color: #ff8f00; }
            .indicator-pill.green { background: #e8f5e9; color: #388e3c; }
            .indicator-pill.purple { background: #f3e5f5; color: #8e24aa; }
            .indicator-pill.red { background: #ffebee; color: #d32f2f; }
            .indicator-pill.blue { background: #e3f2fd; color: #1976d2; }
            
        </style>
    `);
}
