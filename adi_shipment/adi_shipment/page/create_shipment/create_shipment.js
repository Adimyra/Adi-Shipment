PageContent = Class.extend({
  init: function (wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Create Shipment",
      single_column: true,
    });

    const urlParams = new URLSearchParams(window.location.search);
    this.order_id = urlParams.get("order-id") || "N/A";
    this.shipment_id = urlParams.get("shipment-id") || "N/A";

    this.make();
    this.getCourierDetails(); // Fetch courier details after rendering the page
  },

  make: function () {
    let htmlContent = `
		<div class="shipment-container">
		  <p><strong>Order ID:</strong> ${this.order_id}</p>
		  <p><strong>Shipment ID:</strong> ${this.shipment_id}</p>
		  
		  <h3>Available Couriers</h3>
		  <table class="table table-bordered" id="courierTable">
			<thead>
			  <tr>
				<th>Courier Name</th>
				<th>Courier ID</th>
				<th>Actions</th>
			  </tr>
			</thead>
			<tbody>
			  <!-- Courier data will be inserted here -->
			</tbody>
		  </table>
		</div>
	  `;

    $(htmlContent).appendTo(this.page.main);
  },

  getCourierDetails: function () {
    frappe.call({
      method:
        "adi_shipment.adi_shipment.page.create_shipment.create_shipment.get_courier_details",
      args: {},
      callback: (response) => {
        if (response.message.error) {
          console.error(
            "Failed to fetch courier details:",
            response.message.error
          );
        } else {
          console.log(
            "Fetched courier details successfully:",
            response.message
          );
          this.populateCourierTable(response.message.courier_data);
        }
      },
    });
  },

  populateCourierTable: function (courierData) {
    let tableBody = $("#courierTable tbody");
    tableBody.empty();

    if (!courierData || courierData.length === 0) {
      tableBody.append("<tr><td colspan='3'>No couriers available</td></tr>");
      return;
    }

    courierData.forEach((courier) => {
      let row = `<tr>
					<td>${courier.name}</td>
					<td>${courier.id}</td>
					<td><button class="create-shipment-btn btn btn-primary" 
						data-courier="${courier.id}">Generate AWB</button></td>
				  </tr>`;
      tableBody.append(row);
    });

    this.attachGenerateAWBListeners();
  },

  attachGenerateAWBListeners: function () {
    $(".create-shipment-btn").click((event) => {
      let courierId = $(event.currentTarget).data("courier");
      this.generateAWB(courierId);
    });
  },

  generateAWB: function (courierId) {
    console.log("Generating AWB for Courier ID:", courierId);
    shipment_details_payload = {
      courier_id: courierId,
      shipment_id: this.shipment_id,
    };

    frappe.call({
      method:
        "adi_shipment.adi_shipment.page.create_shipment.create_shipment.generate_awb",
      args: {
        shipment_details_str: shipment_details_payload,
      },
      callback: (response) => {
        if (response.message.error) {
          console.error("Failed to generate AWB:", response.message.error);
        } else {
          console.log("AWB generated successfully:", response.message);
        }
      },
    });
  },
});

frappe.pages["create-shipment"].on_page_load = function (wrapper) {
  new PageContent(wrapper);
};
