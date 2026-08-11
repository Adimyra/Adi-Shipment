frappe.ui.form.on('Sales Order', {
    refresh: function (frm) {
        frappe.call({
            method: "adi_shipment.api.sales_order_shipping_rate.is_so_shipping_rate_enabled",
            callback: function (r) {
                if (r.message) {
                    frm.add_custom_button(__('Check Shipping Rate 🚚'), function () {
                        openShippingRateModal(frm);
                    });
                }
            }
        });
    }
});

function openShippingRateModal(frm) {
    frappe.call({
        method: "adi_shipment.api.sales_order_shipping_rate.get_so_pincode",
        args: { sales_order_name: frm.doc.name },
        callback: function (r) {
            const data = r.message || {};
            const initialPincode = (data.pincode || "").toString().trim();
            const isCOD = frm.doc.custom_cod ? 1 : 0;
            showShippingRateDialog(frm, initialPincode, isCOD);
        }
    });
}

function showShippingRateDialog(frm, initialPincode, isCOD) {
    const paymentLabel = isCOD ? "COD" : "Prepaid";

    const dialog = new frappe.ui.Dialog({
        title: __('🚚 Check Shipping Rate & Serviceability'),
        size: 'extra-large',
        fields: [
            {
                fieldname: 'sec_inputs',
                fieldtype: 'Section Break',
                label: __('Delivery & Payment Details')
            },
            {
                label: __('Delivery Pincode'),
                fieldname: 'delivery_pincode',
                fieldtype: 'Data',
                default: initialPincode,
                read_only: 1,
                description: __('Destination pincode from Sales Order')
            },
            {
                fieldname: 'col_break_inputs',
                fieldtype: 'Column Break'
            },
            {
                label: __('Payment Type'),
                fieldname: 'payment_type_text',
                fieldtype: 'Data',
                default: paymentLabel,
                read_only: 1,
                description: __('Derived from Sales Order COD checkbox')
            },
            {
                fieldname: 'sec_custom',
                fieldtype: 'Section Break',
                label: __('⚡ Custom Weight & Box Sizer (Click to Expand)'),
                collapsible: 1,
                collapsed: 1
            },
            {
                label: __('Custom Weight (Kg)'),
                fieldname: 'custom_weight',
                fieldtype: 'Float',
                default: 0,
                description: __('Enter weight in kg to test custom rate')
            },
            {
                fieldname: 'col_break_custom',
                fieldtype: 'Column Break'
            },
            {
                label: __('Dimensions (L × W × H cm)'),
                fieldname: 'custom_dims',
                fieldtype: 'Data',
                placeholder: 'e.g. 30 x 20 x 15',
                description: __('Length × Width × Height in cm')
            },
            {
                fieldname: 'sec_calc_btn',
                fieldtype: 'Section Break'
            },
            {
                fieldname: 'rates_html',
                fieldtype: 'HTML'
            }
        ],
        primary_action_label: __('Calculate Rates'),
        primary_action: function () {
            const currentCOD = frm.doc.custom_cod ? 1 : 0;
            fetchAndRenderRates(dialog, initialPincode, currentCOD);
        }
    });

    const style = document.createElement('style');
    style.id = 'adi-shipment-rate-modal-styles';
    style.textContent = `
        .sr-rate-modal-wrap { font-family: 'Inter', sans-serif; padding: 6px 0; }
        .sr-info-bar { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .sr-info-badge {
            padding: 8px 14px; background: #eef2ff; color: #3730a3;
            border-radius: 6px; font-size: 0.83rem; font-weight: 600; border: 1px solid #c7d2fe;
        }
        .sr-info-badge.zone-e { background: #fff3e0; color: #e65100; border-color: #ffe0b2; }
        .sr-info-badge.pickup { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
        
        /* View Toggle Tabs */
        .sr-view-tabs { display: flex; gap: 8px; margin-bottom: 14px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
        .sr-tab-btn {
            padding: 6px 16px; border-radius: 6px; background: #f1f5f9; color: #475569;
            font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; transition: all 0.2s;
        }
        .sr-tab-btn.active { background: #4f46e5; color: #fff; border-color: #4338ca; }
        .sr-tab-btn:hover:not(.active) { background: #e2e8f0; }

        /* Collapsible Reference Details */
        .sr-collapse-ref {
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
            padding: 10px 14px; margin-bottom: 14px; transition: all 0.2s;
        }
        .sr-collapse-ref summary {
            font-weight: 700; font-size: 0.85rem; color: #334155; cursor: pointer;
            outline: none; user-select: none;
        }
        .sr-collapse-ref summary:hover { color: #4f46e5; }

        /* Reference Table */
        .sr-dim-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.8rem; }
        .sr-dim-table th { background: #cbd5e1; color: #1e293b; padding: 6px 12px; text-align: left; border: 1px solid #94a3b8; }
        .sr-dim-table td { padding: 6px 12px; border: 1px solid #e2e8f0; background: #fff; }

        /* Matrix Table View */
        .sr-matrix-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); font-size: 0.83rem; }
        .sr-matrix-table th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; }
        .sr-matrix-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
        .sr-matrix-table tr:hover td { background: #f8fafc; }
        .rate-cell { font-weight: 600; color: #0f172a; text-align: right; }
        .badge-mode { padding: 2px 8px; border-radius: 12px; font-size: 0.73rem; font-weight: 600; }
        .badge-mode.air { background: #e0f2fe; color: #0369a1; }
        .badge-mode.surface { background: #fef3c7; color: #b45309; }
        .no-service { color: #94a3b8; font-style: italic; font-size: 0.78rem; text-align: right; }

        /* Courier Cards List View */
        .sr-card-list { max-height: 55vh; overflow-y: auto; padding-right: 4px; }
        .sr-card {
            display: flex; align-items: center; background: #fff; border: 1px solid #e2e8f0;
            border-radius: 8px; padding: 14px 18px; margin-bottom: 10px; transition: all 0.2s;
        }
        .sr-card:hover { border-color: #4f46e5; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); }
        .sr-logo {
            width: 42px; height: 42px; background: #eef2ff; border-radius: 8px; display: flex;
            align-items: center; justify-content: center; font-weight: 700; color: #4338ca;
            margin-right: 16px; font-size: 17px; border: 1px solid #c7d2fe;
        }
        .sr-info { flex: 2; }
        .sr-name { font-weight: 600; font-size: 0.92rem; color: #1e293b; margin-bottom: 2px; }
        .sr-meta { font-size: 0.78rem; color: #64748b; }
        .sr-metric { flex: 1; text-align: center; }
        .sr-metric-val { font-weight: 600; font-size: 0.85rem; color: #0f172a; }
        .sr-metric-lbl { font-size: 0.72rem; color: #64748b; }
        .sr-price { font-size: 1.1rem; font-weight: 700; color: #059669; margin-right: 10px; text-align: right; }
        .sr-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; margin-left: 6px; }
        .bg-blue { background: #dbeafe; color: #1e40af; }
        .bg-green { background: #d1fae5; color: #065f46; }
        .bg-yellow { background: #fffbeb; color: #b45309; }

        /* Header Title Refresh Icon Button */
        .sr-title-refresh-btn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 28px; height: 28px; margin-left: 10px; border-radius: 6px;
            background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;
            cursor: pointer; transition: all 0.2s; vertical-align: middle;
        }
        .sr-title-refresh-btn:hover { background: #e2e8f0; color: #4f46e5; border-color: #4f46e5; }
        .sr-title-refresh-btn i { font-size: 13px; }

        /* Mode Filter Checkboxes */
        .sr-mode-filters { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .sr-filter-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .sr-filter-label input[type="checkbox"] { display: none; }
        .sr-filter-chip {
            padding: 5px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
            border: 2px solid transparent; transition: all 0.18s; opacity: 0.45;
        }
        .sr-filter-label input[type="checkbox"]:checked + .sr-filter-chip { opacity: 1; }
        .sr-filter-chip.surface { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
        .sr-filter-label input[type="checkbox"]:checked + .sr-filter-chip.surface { border-color: #f59e0b; box-shadow: 0 0 0 2px #fde68a; }
        .sr-filter-chip.air { background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; }
        .sr-filter-label input[type="checkbox"]:checked + .sr-filter-chip.air { border-color: #38bdf8; box-shadow: 0 0 0 2px #bae6fd; }
    `;
    if (!document.getElementById('adi-shipment-rate-modal-styles')) {
        document.head.appendChild(style);
    }

    dialog.show();

    // Render HTML wrapper inside dialog first
    renderReferenceTable(dialog);

    // Append icon-only Refresh button to Modal Title
    const $titleEl = dialog.$wrapper.find('.modal-title');
    if ($titleEl.length && !$titleEl.find('.sr-title-refresh-btn').length) {
        const $refreshBtn = $(`
            <button class="sr-title-refresh-btn" type="button" title="${__('Refresh Rates')}">
                <i class="fa fa-refresh"></i>
            </button>
        `);
        $refreshBtn.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $icon = $(this).find('i');
            $icon.addClass('fa-spin');
            frappe.call({
                method: "adi_shipment.api.sales_order_shipping_rate.get_so_pincode",
                args: { sales_order_name: frm.doc.name },
                callback: function (r) {
                    const freshData = r.message || {};
                    const freshPin = (freshData.pincode || initialPincode || "").toString().trim();
                    const freshCOD = frm.doc.custom_cod ? 1 : 0;
                    dialog.set_value('delivery_pincode', freshPin);
                    dialog.set_value('payment_type_text', freshCOD ? "COD" : "Prepaid");
                    fetchAndRenderRates(dialog, freshPin, freshCOD);
                    setTimeout(() => $icon.removeClass('fa-spin'), 600);
                }
            });
        });
        $titleEl.append($refreshBtn);
    }

    // Always trigger rates fetch automatically on modal open
    setTimeout(() => {
        const pinToUse = (dialog.get_value('delivery_pincode') || initialPincode || "").toString().trim();
        const codToUse = frm.doc.custom_cod ? 1 : 0;
        fetchAndRenderRates(dialog, pinToUse, codToUse);
    }, 100);
}

function renderReferenceTable(dialog) {
    const html = `
        <div class="sr-rate-modal-wrap">
            <details class="sr-collapse-ref">
                <summary>📦 Standard Box Dimension Slabs Reference <span style="font-weight:normal; font-size:0.78rem; color:#64748b;">(Click to Expand / Collapse)</span></summary>
                <table class="sr-dim-table">
                    <thead>
                        <tr>
                            <th>Weight Slab</th>
                            <th>Length (cm)</th>
                            <th>Width (cm)</th>
                            <th>Height (cm)</th>
                            <th>Volumetric Wt (Kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><b>500 Gms</b> (0.5 Kg)</td><td>12</td><td>19</td><td>9</td><td>0.41 Kg</td></tr>
                        <tr><td><b>1 Kg</b></td><td>24</td><td>19</td><td>9</td><td>0.82 Kg</td></tr>
                        <tr><td><b>2 Kg</b></td><td>24</td><td>19</td><td>19</td><td>1.73 Kg</td></tr>
                        <tr><td><b>5 Kg</b></td><td>39</td><td>24</td><td>24</td><td>4.49 Kg</td></tr>
                    </tbody>
                </table>
            </details>

            <div id="sr-rates-result" style="margin-top:12px;">
                <p style="color:#64748b; font-size:0.85rem; font-style:italic;">Click <b>"Calculate Rates"</b> to check live Shiprocket courier rates for this location.</p>
            </div>
        </div>
    `;
    const $wrapper = dialog.fields_dict.rates_html.$wrapper;
    $wrapper.html(html);
}

function fetchAndRenderRates(dialog, fallbackPincode = "", fallbackCOD = 0) {
    const $wrapper = dialog.fields_dict.rates_html.$wrapper;
    let $resultContainer = $wrapper.find('#sr-rates-result');
    if (!$resultContainer.length) {
        renderReferenceTable(dialog);
        $resultContainer = $wrapper.find('#sr-rates-result');
    }

    const rawVal = dialog.get_value('delivery_pincode');
    const pincode = (rawVal || fallbackPincode || "").toString().trim();

    if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
        frappe.msgprint(__('Please enter a valid 6-digit Delivery Pincode'));
        return;
    }

    const is_cod = fallbackCOD;
    const custom_weight = dialog.get_value('custom_weight') || 0;
    const custom_dims = dialog.get_value('custom_dims') || '';

    let cL = 0, cW = 0, cH = 0;
    if (custom_dims) {
        const parts = custom_dims.replace(/[^0-9.]+/g, ' ').trim().split(/\s+/);
        if (parts.length >= 3) {
            cL = parseFloat(parts[0]) || 0;
            cW = parseFloat(parts[1]) || 0;
            cH = parseFloat(parts[2]) || 0;
        }
    }

    $resultContainer.html('<div style="text-align:center; padding:35px; color:#64748b; font-weight:600;">⏳ Fetching live Shiprocket rates across couriers & weight slabs…</div>');

    frappe.call({
        method: "adi_shipment.api.sales_order_shipping_rate.get_sales_order_shipping_rates",
        args: {
            delivery_pincode: pincode,
            is_cod: is_cod,
            custom_weight: custom_weight,
            custom_length: cL,
            custom_width: cW,
            custom_height: cH
        },
        callback: function (r) {
            if (!r.message || !r.message.success) {
                $resultContainer.html(`
                    <div style="padding:16px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; color:#991b1b; font-size:0.85rem;">
                        ❌ ${r.message ? r.message.message : "Failed to fetch rates."}
                    </div>
                `);
                return;
            }

            const data = r.message;
            window._lastRateData = data;
            renderRateViews(dialog, data, 'matrix');
        }
    });
}

function renderRateViews(dialog, data, activeTab = 'matrix') {
    const $wrapper = dialog.fields_dict.rates_html.$wrapper;
    const $resultContainer = $wrapper.find('#sr-rates-result');
    const isZoneE = data.zone && data.zone.includes("Zone E");

    let html = `
        <div class="sr-info-bar">
            <div class="sr-info-badge pickup">🏬 Pickup: <b>${data.pickup_pincode}</b></div>
            <div class="sr-info-badge">📍 Delivery: <b>${data.delivery_pincode}</b></div>
            <div class="sr-info-badge">💳 Type: <b>${data.is_cod ? 'COD' : 'Prepaid'}</b></div>
            <div class="sr-info-badge ${isZoneE ? 'zone-e' : ''}">🏷️ ${data.zone}</div>
        </div>

        <div class="sr-mode-filters">
            <label class="sr-filter-label">
                <input type="checkbox" id="sr-filter-surface" checked />
                <span class="sr-filter-chip surface">🟡 Surface</span>
            </label>
            <label class="sr-filter-label">
                <input type="checkbox" id="sr-filter-air" />
                <span class="sr-filter-chip air">🔵 Air</span>
            </label>
        </div>

        <div class="sr-view-tabs">
            <button class="sr-tab-btn ${activeTab === 'matrix' ? 'active' : ''}" onclick="window.switchRateView('matrix')">
                📊 Weight Slab Matrix View
            </button>
            <button class="sr-tab-btn ${activeTab === 'cards' ? 'active' : ''}" onclick="window.switchRateView('cards')">
                🚚 Courier Cards List View
            </button>
        </div>

        <div id="sr-view-content"></div>
    `;

    $resultContainer.html(html);

    // Helper: get active mode filters from checkboxes
    function getActiveFilters() {
        const filters = [];
        if ($wrapper.find('#sr-filter-surface').is(':checked')) filters.push('surface');
        if ($wrapper.find('#sr-filter-air').is(':checked')) filters.push('air');
        return filters;
    }

    // Helper: re-render the currently active tab view with current filters
    function reRenderCurrentView() {
        const filters = getActiveFilters();
        const isMatrix = $wrapper.find('.sr-tab-btn:contains("Matrix")').hasClass('active');
        if (isMatrix) {
            renderMatrixView(dialog, data, filters);
        } else {
            renderCardsView(dialog, data, filters);
        }
    }

    // Wire filter checkboxes
    $wrapper.find('#sr-filter-surface, #sr-filter-air').on('change', function () {
        reRenderCurrentView();
    });

    window.switchRateView = function (tab) {
        $wrapper.find('.sr-tab-btn').removeClass('active');
        const filters = getActiveFilters();
        if (tab === 'matrix') {
            $wrapper.find('.sr-tab-btn:contains("Matrix")').addClass('active');
            renderMatrixView(dialog, data, filters);
        } else {
            $wrapper.find('.sr-tab-btn:contains("Cards")').addClass('active');
            renderCardsView(dialog, data, filters);
        }
    };

    // Initial render — Surface only by default
    const initialFilters = ['surface'];
    if (activeTab === 'matrix') {
        renderMatrixView(dialog, data, initialFilters);
    } else {
        renderCardsView(dialog, data, initialFilters);
    }
}

function renderMatrixView(dialog, data, activeFilters = ['surface', 'air']) {
    const $wrapper = dialog.fields_dict.rates_html.$wrapper;
    const hasCustom = data.slabs.some(s => s.key === "custom");

    // Filter couriers by selected modes
    const filteredCouriers = (data.couriers || []).filter(c => {
        const modeClass = (c.mode || "").toLowerCase() === "air" ? "air" : "surface";
        return activeFilters.includes(modeClass);
    });

    let html = `
        <table class="sr-matrix-table">
            <thead>
                <tr>
                    <th>Courier Company</th>
                    <th style="text-align:center;">Mode</th>
                    <th>ETD</th>
                    <th style="text-align:right;">500 Gms</th>
                    <th style="text-align:right;">1 Kg</th>
                    <th style="text-align:right;">2 Kg</th>
                    <th style="text-align:right;">5 Kg</th>
    `;

    if (hasCustom) {
        const customSlab = data.slabs.find(s => s.key === "custom");
        html += `<th style="text-align:right; color:#a855f7;">${customSlab.label}</th>`;
    }

    html += `
                </tr>
            </thead>
            <tbody>
    `;

    if (filteredCouriers.length === 0) {
        html += `<tr><td colspan="${hasCustom ? 8 : 7}" style="text-align:center; padding:20px; color:#94a3b8;">No couriers match the selected mode filter.</td></tr>`;
    } else {
        filteredCouriers.forEach(c => {
            const modeClass = (c.mode || "").toLowerCase() === "air" ? "air" : "surface";
            html += `
                <tr>
                    <td><b>${c.courier_name}</b></td>
                    <td style="text-align:center;"><span class="badge-mode ${modeClass}">${c.mode}</span></td>
                    <td style="color:#64748b;">${c.etd}</td>
            `;

            ["slab_05", "slab_1", "slab_2", "slab_5"].forEach(sKey => {
                const val = c.rates[sKey];
                if (val !== undefined) {
                    html += `<td class="rate-cell">₹${val.toFixed(2)}</td>`;
                } else {
                    html += `<td class="no-service">—</td>`;
                }
            });

            if (hasCustom) {
                const val = c.rates["custom"];
                if (val !== undefined) {
                    html += `<td class="rate-cell" style="color:#a855f7; font-weight:700;">₹${val.toFixed(2)}</td>`;
                } else {
                    html += `<td class="no-service">—</td>`;
                }
            }

            html += `</tr>`;
        });
    }

    html += `
            </tbody>
        </table>
        <p style="margin-top:10px; font-size:0.75rem; color:#94a3b8; font-style:italic;">* Rates are dynamic freight charges fetched live from Shiprocket API.</p>
    `;

    $wrapper.find('#sr-view-content').html(html);
}

function renderCardsView(dialog, data, activeFilters = ['surface', 'air']) {
    const $wrapper = dialog.fields_dict.rates_html.$wrapper;

    // Filter couriers by selected modes
    const filteredCouriers = (data.couriers || []).filter(c => {
        const modeClass = (c.mode || "").toLowerCase() === "air" ? "air" : "surface";
        return activeFilters.includes(modeClass);
    });

    if (filteredCouriers.length === 0) {
        $wrapper.find('#sr-view-content').html('<div style="text-align:center; padding:30px; color:#94a3b8;">No couriers match the selected mode filter.</div>');
        return;
    }

    let minRate = Math.min(...filteredCouriers.map(c => c.rates['slab_1'] || c.rates['slab_05'] || 99999));

    let html = `<div class="sr-card-list">`;

    filteredCouriers.forEach(c => {
        let logo = c.courier_name.charAt(0).toUpperCase();
        let rate1kg = c.rates['slab_1'] || c.rates['slab_05'] || 0;
        let isCheapest = rate1kg > 0 && rate1kg === minRate;
        let modeClass = (c.mode || "").toLowerCase() === "air" ? "air" : "surface";

        let badges = '';
        if (isCheapest) badges += `<span class="sr-badge bg-green">Cheapest</span>`;
        if (modeClass === "air") badges += `<span class="sr-badge bg-blue">Air Fast</span>`;

        html += `
            <div class="sr-card">
                <div class="sr-logo">${logo}</div>
                <div class="sr-info">
                    <div class="sr-name">${c.courier_name} ${badges}</div>
                    <div class="sr-meta">ID: ${c.courier_id} | <span class="badge-mode ${modeClass}">${c.mode}</span></div>
                </div>
                <div class="sr-metric">
                    <div class="sr-metric-val">${c.etd}</div>
                    <div class="sr-metric-lbl">Estimated Delivery</div>
                </div>
                <div class="sr-metric">
                    <div class="sr-metric-val">
                        <span class="sr-badge bg-yellow" style="margin:0;">★ ${c.rating || '4.0'}</span>
                    </div>
                    <div class="sr-metric-lbl">Rating</div>
                </div>
                <div class="sr-price">₹${rate1kg.toFixed(2)} <span style="font-size:0.7rem; color:#64748b; font-weight:normal;">(1kg)</span></div>
            </div>
        `;
    });

    html += `</div>`;
    $wrapper.find('#sr-view-content').html(html);
}
