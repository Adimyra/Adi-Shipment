frappe.pages['shiprocket_dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Shiprocket Dashboard',
        single_column: true
    });

    wrapper.page = page;

    // -- Hide Default Header --
    page.set_title_sub('');
    page.set_title('');
    $('.page-head').hide();

    // Add Main Padding
    $(page.main).css('padding', '20px');

    // -- Custom Header --
    let $header = $(`
        <div class="flex justify-between align-center" style="margin-bottom: 25px;">
            <div class="flex align-center">
                <div style="margin-right: 15px;">
                    <div style="width: 50px; height: 50px; background: #e3f2fd; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-rocket text-primary" style="font-size: 24px;"></i>
                    </div>
                </div>
                <div>
                    <h3 class="text-primary" style="margin:0; font-weight:700;">Shiprocket Dashboard</h3>
                    <p class="text-muted text-sm" style="margin:5px 0 0 0;">Manage your shipments, schedule pickups, and track orders.</p>
                </div>
            </div>
            <div>
                 <button class="btn btn-default btn-calc btn-sm" style="border-radius: 50%; width: 36px; height: 36px; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-right: 10px;" title="Rate Calculator"><i class="fa fa-calculator"></i></button>
                 <button class="btn btn-default btn-refresh btn-sm" style="border-radius: 50%; width: 36px; height: 36px; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"><i class="fa fa-refresh"></i></button>
            </div>
        </div>
    `).appendTo(page.main);

    // -- Top Filters --
    let $filter_row = $(`<div class="row filter-row" style="margin-bottom: 25px;"></div>`).appendTo(page.main);

    // 1. Search Filter
    $filter_row.append(`
        <div class="col-md-5">
            <div class="form-group" style="margin-bottom:0; position:relative;">
                <input type="text" class="form-control input-sm input-search" placeholder="Search Order ID, AWB..." style="border-radius: 20px; padding-left: 15px; padding-right: 30px;">
                <span class="search-clear-btn" style="position: absolute; right: 10px; top: 0; bottom: 0; line-height: 30px; cursor: pointer; display: none; color: #999;">
                    <i class="fa fa-times-circle"></i>
                </span>
            </div>
        </div>
    `);

    // 2. Date Filter
    // Using standard frappe date fields is easier
    $filter_row.append(`
        <div class="col-md-3">
            <input type="date" class="form-control input-sm input-date-from" placeholder="From Date" style="border-radius: 20px;">
        </div>
        <div class="col-md-3">
            <input type="date" class="form-control input-sm input-date-to" placeholder="To Date" style="border-radius: 20px;">
        </div>
    `);

    // -- Tabs --
    let tabs = ["All", "Ready To Ship", "Pickups", "In Transit", "Delivered", "RTO", "Cancelled"];
    let $tab_nav = $(`<ul class="nav nav-tabs" style="margin-bottom: 25px; border-bottom: 2px solid #eaedf2;"></ul>`).appendTo(page.main);

    tabs.forEach((tab, index) => {
        let active = index === 0 ? "active" : "";
        $tab_nav.append(`
            <li class="${active}">
                <a href="#" class="tab-link" data-tab="${tab}" style="border:none; background:transparent; font-weight: 500; font-size: 13px; padding: 10px 20px;">${tab}</a>
            </li>
        `);
    });

    // -- Content Container --
    let $content = $(`<div class="dashboard-content"></div>`).appendTo(page.main);

    // Bind Events
    wrapper.active_tab = "All";

    $tab_nav.on('click', '.tab-link', function (e) {
        e.preventDefault();
        change_tab(wrapper, $(this).data('tab'));
    });

    // Make Stat Cards Clickable
    $content.on('click', '.stat-card', function () {
        let tab = $(this).data('target-tab');
        if (tab) {
            change_tab(wrapper, tab);
        }
    });

    // Bind Phone Toggle
    $content.on('click', '.toggle-phone', function (e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent row clicks if any
        let $this = $(this);
        let phone = $this.data('phone');
        let $display = $this.closest('.phone-container').find('.phone-display');

        if ($this.hasClass('fa-eye')) {
            $display.text(phone);
            $this.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            $display.text('xxxxxxxxxx');
            $this.removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    // Search Logic with Clear Button
    $filter_row.find('.input-search').on('keyup input', function () {
        let val = $(this).val();
        if (val) {
            $filter_row.find('.search-clear-btn').show();
        } else {
            $filter_row.find('.search-clear-btn').hide();
        }
    });

    $filter_row.find('.input-search').on('change', function () {
        wrapper.search_term = $(this).val();
        render_dashboard(wrapper);
    });

    $filter_row.find('.search-clear-btn').on('click', function () {
        $filter_row.find('.input-search').val('').trigger('change').trigger('input');
    });

    $filter_row.find('.input-date-from').on('change', function () {
        wrapper.from_date = $(this).val();
        render_dashboard(wrapper);
    });

    $filter_row.find('.input-date-to').on('change', function () {
        wrapper.to_date = $(this).val();
        render_dashboard(wrapper);
    });

    $header.find('.btn-refresh').on('click', function () {
        render_dashboard(wrapper);
    });

    $header.find('.btn-calc').on('click', function () {
        frappe.set_route('freight-price-calc');
    });

    // Custom CSS
    add_custom_css();

    render_dashboard(wrapper);
}

function change_tab(wrapper, tab_name) {
    wrapper.active_tab = tab_name;

    // Update Tab UI
    let $tab_nav = $(wrapper.page.main).find('.nav-tabs');
    $tab_nav.find('li').removeClass('active');
    $tab_nav.find(`a[data-tab="${tab_name}"]`).parent().addClass('active');

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

                // 1. Stats Cards Section
                let stats_html = `
                    <div class="row overview-stats-row" style="margin-left: -10px; margin-right: -10px;">
                        ${get_stat_card("Total Orders", stats.total, "blue", "fa fa-shopping-cart", "All")}
                        ${get_stat_card("Ready To Ship", stats.new, "orange", "fa fa-clock-o", "Ready To Ship")}
                        ${get_stat_card("Pickup Scheduled", stats.pickup_scheduled, "cyan", "fa fa-truck", "Pickups")}
                        ${get_stat_card("In Transit", stats.in_transit, "purple", "fa fa-plane", "In Transit")}
                        ${get_stat_card("Delivered", stats.delivered, "green", "fa fa-check-circle", "Delivered")}
                        ${get_stat_card("Cancelled", stats.cancelled, "red", "fa fa-ban", "Cancelled")}
                    </div>
                `;

                // 2. Orders List
                let table_html = `
                    <div class="frappe-card dashboard-list">
                        <div class="frappe-card-head" style="background:#f9f9f9; padding:15px 20px;">
                            <span class="text-muted">Filtered Orders (${orders.length})</span>
                        </div>
                        <div class="frappe-card-body table-responsive">
                            <table class="table table-hover" style="font-size: 13px; margin:0;">
                                <thead style="background-color: #f1f1f1; color: #555;">
                                    <tr>
                                        <th style="padding-left:20px;">Order Details</th>
                                        <th>Customer</th>
                                        <th>Status</th>
                                        <th>Payment</th>
                                        <th>Courier / AWB</th>
                                        <th class="text-right" style="padding-right:20px;">Action</th>
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

function get_stat_card(label, value, color, icon, target_tab) {
    return `
        <div class="col-md-2 col-sm-4 col-xs-6 mb-3" style="padding: 0 10px;">
            <div class="stat-card" style="border-top: 3px solid ${get_color_hex(color)}; cursor:pointer;" data-target-tab="${target_tab}">
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

    // Customer Phone Masking Logic
    let raw_phone = order.customer_phone || '';
    let display_phone = raw_phone;
    let is_masked = raw_phone.includes('*') || raw_phone.toLowerCase().includes('x');

    if (!is_masked && raw_phone.length > 4) {
        display_phone = 'xxxxxxxxxx';
    }

    // Using a unique ID for each phone toggle to ensure specific targeting if needed, 
    // but class-based approach in jQuery should work if event delegation is correct.
    // We will ensure the SPAN is targeted correctly.
    let phone_html = `
        <div class="text-muted text-xs flex align-center mt-1 phone-container">
            <span class="phone-display" style="margin-right:5px;">${display_phone}</span>
            <i class="fa ${display_phone.includes('x') ? 'fa-eye' : 'fa-eye-slash'} toggle-phone" 
               data-phone="${raw_phone}" 
               style="cursor:pointer; color:#999;"></i>
        </div>
    `;

    // Action Buttons Logic
    let actions = '';

    // Status based actions
    let status = (order.status || '').toUpperCase();

    // Ready to Ship / AWB Assigned -> Schedule Pickup
    if (['READY TO SHIP', 'AWB ASSIGNED', 'INVOICED', 'MANIFEST GENERATED'].includes(status)) {
        if (shipment_id) {
            // Schedule Pickup
            actions += `<button class="btn btn-xs btn-primary-soft mr-1" onclick="schedule_pickup('${shipment_id}')" title="Schedule Pickup"><i class="fa fa-truck"></i> Pickup</button>`;

            // Label / Manifest
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')" title="Label"><i class="fa fa-print"></i></button>`;
            if (status === 'MANIFEST GENERATED') {
                actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'manifest')" title="Manifest"><i class="fa fa-file-text-o"></i></button>`;
            }
        }
    }
    else if (status === 'NEW' || status === 'PROCESSING') {
        if (shipment_id) {
            actions += `<button class="btn btn-xs btn-primary-soft mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')">Generate Label</button>`;
        }
    }
    else if (status === 'PICKUP SCHEDULED' || status === 'PICKUP QUEUED') {
        if (shipment_id) {
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'manifest')" title="Manifest"><i class="fa fa-file-text-o"></i></button>`;
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')" title="Label"><i class="fa fa-print"></i></button>`;
        }
    }
    else if (['SHIPPED', 'IN TRANSIT', 'OUT FOR DELIVERY', 'PICKUP RESCHEDULED'].includes(status) || status.includes('TRANSIT')) {
        if (awb_code) {
            actions += `<a href="${tracking_url}" target="_blank" class="btn btn-xs btn-info-soft mr-1"><i class="fa fa-map-marker"></i> Track</a>`;
            actions += `<button class="btn btn-xs btn-default mr-1" onclick="print_shiprocket_doc('${shipment_id}', 'label')" title="Label"><i class="fa fa-print"></i></button>`;
        }
    }
    else if (status === 'DELIVERED') {
        actions += `<span class="text-muted text-xs"><i class="fa fa-check"></i> Completed</span>`;
    }

    if (actions === '' && shipment_id) {
        actions += `<button class="btn btn-xs btn-default" onclick="print_shiprocket_doc('${shipment_id}', 'label')"><i class="fa fa-print"></i></button>`;
    }

    // Determine Link: Check channel_order_id vs id. 
    // Usually 'channel_order_id' corresponds to the Frappe Shipment Name (SHIP-XXXX) if created from Frappe.
    // 'id' is Shiprocket's internal ID.
    // We prefer routing to Frappe Shipment if it looks like a Shipment ID.
    let order_display_id = order.channel_order_id || order.id;
    let link_onclick = '';

    if (order.channel_order_id && order.channel_order_id.startsWith('SHIP-')) {
        // It's likely a Frappe Shipment
        link_onclick = `frappe.set_route('Form', 'Shipment', '${order.channel_order_id}')`;
    } else {
        // Fallback to Shiprocket external link if not a local shipment
        link_onclick = `window.open('https://app.shiprocket.in/orders/processing?search=${order.id}', '_blank')`;
    }

    // Format Date to be smaller and simpler (e.g. DD MMM, HH:mm)
    let date_str = order.created_at || '';
    // Optional: format date string if needed, for now just CSS styling

    return `
        <tr>
            <td style="padding-left:20px;">
                <div class="font-weight-bold text-primary" style="cursor:pointer;" onclick="${link_onclick}" title="Track / View">
                    ${order_display_id}
                </div>
                <div class="text-muted text-xs" style="margin-top:2px;">${date_str}</div>
            </td>
            <td>
                <div class="font-weight-bold" style="font-size:12px;">${order.customer_name}</div>
                <div class="text-muted text-xs">${order.customer_email || ''}</div>
                ${phone_html}
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
            <td class="text-right" style="padding-right:20px;">
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

// Global function to be called from onclick
window.schedule_pickup = function (shipment_id) {
    if (!shipment_id) return;

    frappe.confirm('Are you sure you want to schedule pickup for this order?', () => {
        frappe.call({
            method: "adi_shipment.api.shiprocket.schedule_pickup_by_id",
            args: {
                shipment_id: shipment_id
            },
            freeze: true,
            freeze_message: "Scheduling Pickup...",
            callback: function (r) {
                if (r.message) {
                    let data = r.message;
                    if (data.pickup_status == 1) {
                        frappe.show_alert({ message: "Pickup Scheduled Successfully!", indicator: 'green' });
                        // Refresh Dashboard
                        setTimeout(() => {
                            let page = cur_page.page; // Assuming we are on the page
                            render_dashboard({ page: page, from_date: null, to_date: null, active_tab: 'Ready To Ship' }); // Weak refresh
                            // Better to trigger refresh button click if possible or reload page
                            location.reload();
                        }, 1000);
                    } else {
                        frappe.msgprint(`Response: ${data.response ? JSON.stringify(data.response) : 'Error'}`);
                    }
                }
            }
        });
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
