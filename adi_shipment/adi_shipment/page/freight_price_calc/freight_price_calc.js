frappe.pages["freight-price-calc"].on_page_load = function (wrapper) {
  new PageContent(wrapper);
};

PageContent = Class.extend({
  init: function (wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Freight Rate Calculator",
      single_column: true,
    });

    // -- Hide Default Header --
    this.page.set_title_sub('');
    this.page.set_title('');
    $('.page-head').hide();

    // Add Main Padding
    $(this.page.main).css('padding', '20px');

    this.make();
  },

  make: function () {
    let me = this;

    // -- Custom Header --
    let $header = $(`
        <div class="flex justify-between align-center" style="margin-bottom: 25px;">
            <div class="flex align-center">
                <div style="margin-right: 15px;">
                    <div style="width: 50px; height: 50px; background: #e3f2fd; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-calculator text-primary" style="font-size: 20px;"></i>
                    </div>
                </div>
                <div>
                    <h3 class="text-primary" style="margin:0; font-weight:700;">Rate Calculator</h3>
                    <p class="text-muted text-sm" style="margin:5px 0 0 0;">Check shipping rates and serviceability for different couriers.</p>
                </div>
            </div>
            <div>
                 <button class="btn btn-default btn-dashboard btn-sm" style="border-radius: 50%; width: 36px; height: 36px; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" title="Back to Dashboard"><i class="fa fa-home"></i></button>
            </div>
        </div>
    `).appendTo(this.page.main);

    // -- Calculator Form --
    let form_html = `
        <div class="frappe-card" style="margin-bottom: 25px;">
            <div class="frappe-card-head" style="background:#f9f9f9; padding:15px 20px; border-bottom:1px solid #eee;">
                <span class="font-weight-bold">Shipment Details</span>
            </div>
            <div class="frappe-card-body" style="padding: 20px;">
                <form id="freight-details-form">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="text-muted text-xs uppercase">Pickup Pincode</label>
                                <input type="number" class="form-control" name="pickup_postcode" placeholder="Ex: 110001" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label class="text-muted text-xs uppercase">Delivery Pincode</label>
                                <input type="number" class="form-control" name="delivery_postcode" placeholder="Ex: 560001" required>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row" style="margin-top: 10px;">
                         <div class="col-md-3">
                            <div class="form-group">
                                <label class="text-muted text-xs uppercase">Weight (kg)</label>
                                <input type="number" step="0.01" class="form-control" name="weight" value="0.5" required>
                            </div>
                        </div>
                        <div class="col-md-3">
                             <div class="form-group">
                                <label class="text-muted text-xs uppercase">Value (₹)</label>
                                <input type="number" class="form-control" name="declared_value" placeholder="Decl. Value" value="1000">
                            </div>
                        </div>
                       <div class="col-md-6">
                             <div class="form-group">
                                <label class="text-muted text-xs uppercase">Payment Mode</label>
                                <div class="checkbox" style="margin-top:5px;">
                                    <label>
                                        <input type="checkbox" name="cod" value="1"> 
                                        <span class="text-muted">Cash on Delivery (COD)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row" style="margin-top: 10px;">
                        <div class="col-md-12">
                            <label class="text-muted text-xs uppercase" style="margin-bottom:10px; display:block;">Dimensions (cm)</label>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group">
                                <input type="number" class="form-control" name="length" placeholder="Length" value="10">
                                <span class="help-text text-muted text-xs">Length (L)</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group">
                                <input type="number" class="form-control" name="breadth" placeholder="Breadth" value="10">
                                <span class="help-text text-muted text-xs">Breadth (B)</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group">
                                <input type="number" class="form-control" name="height" placeholder="Height" value="10">
                                <span class="help-text text-muted text-xs">Height (H)</span>
                            </div>
                        </div>
                    </div>

                    <div class="row" style="margin-top: 20px;">
                        <div class="col-md-12 text-right">
                            <button type="button" class="btn btn-default btn-clear" style="padding: 8px 20px; margin-right: 10px;">
                                Clear
                            </button>
                            <button type="submit" class="btn btn-primary" style="padding: 8px 30px;">
                                Calculate Rates
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    $(form_html).appendTo(this.page.main);

    // -- Results Container --
    let $results = $(`<div id="results-container" style="display:none;"></div>`).appendTo(this.page.main);

    // Bind Dashboard Button
    $header.find('.btn-dashboard').on('click', function () {
      frappe.set_route('shiprocket_dashboard');
    });

    // Bind Submit
    $('#freight-details-form').on('submit', function (e) {
      e.preventDefault();
      me.calculate_rates($(this));
    });

    // Bind Clear
    $('#freight-details-form').on('click', '.btn-clear', function () {
      $('#freight-details-form')[0].reset();
      $('#results-container').hide().empty();
    });
  },

  calculate_rates: function ($form) {
    let me = this;
    let data = {};

    // Serialize
    $form.serializeArray().forEach(item => {
      data[item.name] = item.value;
    });

    // Formatting defaults
    data['weight'] = parseFloat(data['weight']) || 0.5;
    data['cod'] = $form.find('input[name="cod"]').prop('checked') ? 1 : 0;
    data['declared_value'] = parseFloat(data['declared_value']) || 0;
    data['length'] = parseFloat(data['length']) || 10;
    data['breadth'] = parseFloat(data['breadth']) || 10;
    data['height'] = parseFloat(data['height']) || 10;

    // Loading State
    let $btn = $form.find('button[type="submit"]');
    let original_text = $btn.text();
    $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Checking...');

    let $container = $('#results-container');
    $container.hide().empty();

    frappe.call({
      method: "adi_shipment.adi_shipment.page.freight_price_calc.freight_price_calc.get_freight_price_from_dimension",
      args: {
        freight_details_str: JSON.stringify(data),
      },
      callback: function (r) {
        $btn.prop('disabled', false).text(original_text);

        if (r.message) {
          if (r.message.error) {
            frappe.msgprint({
              title: 'Error',
              message: r.message.error,
              indicator: 'red'
            });
            return;
          }

          let resp = r.message;
          // Shiprocket sometimes puts data in 'data' object
          let couriers = (resp.data && resp.data.available_courier_companies) ? resp.data.available_courier_companies : [];

          // Recommended Courier (if available)
          let recommended = (resp.data && resp.data.recommended_courier_company_id) ? resp.data.recommended_courier_company_id : null;

          me.render_results(couriers, recommended);
        }
      },
      error: function () {
        $btn.prop('disabled', false).text(original_text);
      }
    });
  },

  render_results: function (couriers, recommended_id) {
    let $container = $('#results-container');

    if (!couriers || couriers.length === 0) {
      $container.html(`
             <div class="alert alert-warning">
                <i class="fa fa-warning"></i> No courier partners available for this route/weight combination.
             </div>
          `).show();
      return;
    }

    // Sort by Rate (cheapest first)
    couriers.sort((a, b) => a.rate - b.rate);

    let rows = couriers.map(c => {
      let is_recommended = c.courier_company_id == recommended_id;
      let badge = is_recommended ? '<span class="indicator-pill green">RECOMMENDED</span>' : '';

      return `
            <tr>
                <td style="vertical-align: middle;">
                    <div class="font-weight-bold text-dark">${c.courier_name} ${badge}</div>
                    <div class="text-muted text-xs">Rating: ${c.rating || 'N/A'} / 5</div>
                </td>
                <td style="vertical-align: middle;">
                    <span class="text-dark">${c.estimated_delivery_days ? c.estimated_delivery_days + ' Days' : '-'}</span>
                    <div class="text-muted text-xs">ETD: ${c.etd || ''}</div>
                </td>
                 <td style="vertical-align: middle;">
                    ${c.charge_weight} Kg
                </td>
                <td style="vertical-align: middle;">
                    <span class="font-weight-bold" style="font-size:14px;">₹ ${c.rate}</span>
                </td>
                <td class="text-right" style="vertical-align: middle;">
                    <!-- Action button logic could go here if we were creating orders immediately -->
                     <button class="btn btn-xs btn-default disabled" title="Information Only">View</button>
                </td>
            </tr>
          `;
    }).join('');

    let html = `
        <div class="frappe-card">
             <div class="frappe-card-head" style="background:#fff; padding:15px 20px; border-bottom:1px solid #eee;">
                <span class="font-weight-bold">Available Couriers (${couriers.length})</span>
            </div>
            <div class="table-responsive">
                <table class="table table-hover" style="margin:0;">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="padding-left:20px;">Courier Partner</th>
                            <th>Delivery Time</th>
                            <th>Chargeable Wt.</th>
                            <th>Rate</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
      `;

    $container.html(html).slideDown();
  }
});

// Reuse Custom CSS from Dashboard if possible, or add local style
$('head').append(`
    <style>
        .frappe-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
            border: 1px solid #ebedf0;
        }
        .indicator-pill {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            display: inline-block;
            margin-left: 5px;
        }
        .indicator-pill.green { background: #e8f5e9; color: #388e3c; }
        .text-xs { font-size: 11px; }
        .form-control {
             border-radius: 6px;
             border: 1px solid #d1d8dd;
             box-shadow: none !important;
             font-size: 13px;
        }
        .form-control:focus {
            border-color: #5e64ff;
        }
        label.uppercase {
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
        }
    </style>
`);
