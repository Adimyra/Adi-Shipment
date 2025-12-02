frappe.pages["freight-price-calc"].on_page_load = function (wrapper) {
  new PageContent(wrapper);
};

PageContent = Class.extend({
  init: function (wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Freight-Price-Calc",
      single_column: true,
    });
    this.make();
  },

  make: function () {
    let htmlContent = `
	<form id="freight-deatils-form">
	<div class="form-group">
		<label for="pickup_postcode">Pickup Postcode</label>
		<input type="number" class="form-control" id="pickup_postcode" name="pickup_postcode" placeholder="Enter pickup postcode" required>
	</div>
	<div class="form-group">
		<label for="delivery_postcode">Delivery Postcode</label>
		<input type="number" class="form-control" id="delivery_postcode" name="delivery_postcode" placeholder="Enter delivery postcode" required>
	</div>
	<div class="form-group">
		<label for="weight">Weight</label>
		<input type="text" class="form-control" id="weight" name="weight" placeholder="Enter weight" required>
	</div>
	<div class="form-group">
		<label for="cod">COD</label>
  		<input type="checkbox" name="cod" value="true" id="cod">
	</div>
	<button type="submit" class="btn btn-primary">Submit</button>
	</form>
	
	<h2 id="frieght-price"></h2>

	<!-- Loading spinner -->
      <div id="loader" style="display: none; text-align: center;">
        <img src="https://i.gifer.com/YCZH.gif" alt="Loading..." />
    </div>
	
	<!-- Table to display Freight Price data -->
	<table id="freight-price-table" class="table table-bordered" style="display: none;">
		<thead>
			<tr>
				<th>Courier Partner</th>
				<th>Rating</th>
				<th>Estimated Delivery Date</th>
				<th>Chargeable Weight</th>
        <th>Shipment Rate</th>
        <th>Action</th>
			</tr>
		</thead>
		<tbody id="freight-price-table-body">
			<!-- Dynamic rows will be appended here -->
		</tbody>
	</table>
	
	`;

    let freightPrice = function (freightPayload) {
      $("#loader").show();
      frappe.call({
        method:
          "adi_shipment.adi_shipment.page.freight_price_calc.freight_price_calc.get_freight_price_from_dimension",
        args: {
          freight_details_str: freightPayload,
        },
        callback: function (freightPrice) {
          console.log(freightPrice);
          $("#freight-price-table-body").empty();
          if (
            freightPrice.message.data &&
            freightPrice.message.data.available_courier_companies
          ) {
            $("#loader").hide();
            $("#freight-price-table").show();

            freightPrice.message.data.available_courier_companies.forEach(
              function (courier) {
                let row = `
              <tr>
                <td>${courier.courier_name}</td>
                <td>${courier.rating}</td>
                <td>${courier.estimated_delivery_days}</td>
                <td>${courier.charge_weight}</td>
                <td>${courier.rate}</td>
                <td><button class="create-shipment-btn" data-courier="${courier.courier_name}">Create Shipment</button></td>
              </tr>
              `;
                // Append the row to the table body
                $("#freight-price-table-body").append(row);
                $(document).on("click", ".create-shipment-btn", function () {
                  let courierName = $(this).data("courier");
                  window.location.href = `/app/order-page`;
                });
              }
            );
          } else {
            // If no courier data is available, show a message
            let row = `
            <tr>
              <td colspan="5" class="text-center">No available freight data</td>
            </tr>
            `;
            $("#loader").hide();
            $("#freight-price-table-body").append(row);
          }
        },
      });
    };

    $(frappe.render_template(htmlContent, this)).appendTo(this.page.main);

    $(document).ready(function () {
      $("#freight-deatils-form").on("submit", function (event) {
        event.preventDefault();

        var formData = $(this).serialize();

        var formDataObj = {};
        formData.split("&").forEach(function (pair) {
          var [key, value] = pair.split("=");
          formDataObj[decodeURIComponent(key)] = decodeURIComponent(value);
        });

        var isChecked = $("#cod").prop("checked");
        formDataObj["cod"] = isChecked ? 1 : 0;

        console.log("Payload:", formDataObj);

        var frieghtPayload = JSON.stringify(formDataObj);
        console.log("JSON Payload:", frieghtPayload);

        freightPrice(frieghtPayload);
      });
    });
  },
});
