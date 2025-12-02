frappe.pages["order-page"].on_page_load = function (wrapper) {
  new PageContent(wrapper);
};

PageContent = Class.extend({
  init: function (wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "order-page",
      single_column: true,
    });
    this.make();
  },

  make: function () {
    let htmlContent = `<form id="order-details-form">
    <div class="form-group">
        <label for="order_id">Order ID</label>
        <input type="text" class="form-control" id="order_id" name="order_id" placeholder="Enter Order ID" required>
    </div>
    
    <div class="form-group">
        <label for="order_date">Order Date</label>
        <input type="datetime-local" class="form-control" id="order_date" name="order_date" required>
    </div>
    
    <div class="form-group">
        <label for="pickup_location">Pickup Location</label>
        <input type="text" class="form-control" id="pickup_location" name="pickup_location" placeholder="Enter Pickup Location">
    </div>
    
    <div class="form-group">
        <label for="channel_id">Channel ID</label>
        <input type="text" class="form-control" id="channel_id" name="channel_id" placeholder="Enter Channel ID">
    </div>
    
    <div class="form-group">
        <label for="comment">Comment</label>
        <textarea class="form-control" id="comment" name="comment" placeholder="Enter Comment"></textarea>
    </div>
    
    <h3>Billing Details</h3>
    <div class="form-group">
        <label for="billing_customer_name">Customer Name</label>
        <input type="text" class="form-control" id="billing_customer_name" name="billing_customer_name" required>
    </div>
    <div class="form-group">
        <label for="billing_last_name">Last Name</label>
        <input type="text" class="form-control" id="billing_last_name" name="billing_last_name">
    </div>
    <div class="form-group">
        <label for="billing_address">Address</label>
        <input type="text" class="form-control" id="billing_address" name="billing_address" required>
    </div>
    <div class="form-group">
        <label for="billing_address_2">Address 2</label>
        <input type="text" class="form-control" id="billing_address_2" name="billing_address_2">
    </div>
    <div class="form-group">
        <label for="billing_city">City</label>
        <input type="text" class="form-control" id="billing_city" name="billing_city" required>
    </div>
    <div class="form-group">
        <label for="billing_pincode">Pincode</label>
        <input type="number" class="form-control" id="billing_pincode" name="billing_pincode" required>
    </div>
    <div class="form-group">
        <label for="billing_state">State</label>
        <input type="text" class="form-control" id="billing_state" name="billing_state" required>
    </div>
    <div class="form-group">
        <label for="billing_country">Country</label>
        <input type="text" class="form-control" id="billing_country" name="billing_country" required>
    </div>
    <div class="form-group">
        <label for="billing_email">Email</label>
        <input type="email" class="form-control" id="billing_email" name="billing_email" required>
    </div>
    <div class="form-group">
        <label for="billing_phone">Phone</label>
        <input type="tel" class="form-control" id="billing_phone" name="billing_phone" required>
    </div>
	<div class="form-group">
        <label for="shipping_is_billing">Shipping Is Billing</label>
        <input type="text" class="form-control" id="shipping_is_billing" name="shipping_is_billing" required>
    </div>
	<div class="form-group">
        <label for="shipping_customer_name">Shipping Customer Name</label>
        <input type="text" class="form-control" id="shipping_customer_name" name="shipping_customer_name" required>
    </div>
	<div class="form-group">
        <label for="shipping_last_name">Shipping Last Name</label>
        <input type="text" class="form-control" id="shipping_last_name" name="shipping_last_name" required>
    </div>
	<div class="form-group">
        <label for="shipping_address">Shipping Address</label>
        <input type="text" class="form-control" id="shipping_address" name="shipping_address" required>
    </div>
	<div class="form-group">
        <label for="shipping_address_2">Shipping Address 2</label>
        <input type="text" class="form-control" id="shipping_address_2" name="shipping_address_2" required>
    </div>
	<div class="form-group">
        <label for="shipping_city">Shipping City</label>
        <input type="text" class="form-control" id="shipping_city" name="shipping_city" required>
    </div>
	<div class="form-group">
        <label for="shipping_pincode">Shipping Pincode</label>
        <input type="number" class="form-control" id="shipping_pincode" name="shipping_pincode" required>
    </div>
	<div class="form-group">
        <label for="shipping_country">Shipping Country</label>
        <input type="text" class="form-control" id="shipping_country" name="shipping_country" required>
    </div>
	<div class="form-group">
        <label for="shipping_state">Shipping State</label>
        <input type="text" class="form-control" id="shipping_state" name="shipping_state" required>
    </div>
	<div class="form-group">
        <label for="shipping_email">Shipping Email</label>
        <input type="text" class="form-control" id="shipping_email" name="shipping_email" required>
    </div>
	<div class="form-group">
        <label for="shipping_phone">Shipping Phone</label>
        <input type="tel" class="form-control" id="shipping_phone" name="shipping_phone" required>
    </div>
    
    <h3>Order Items</h3>
    <div class="form-group">
        <label for="item_name">Item Name</label>
        <input type="text" class="form-control" id="item_name" name="item_name" required>
    </div>
    <div class="form-group">
        <label for="sku">SKU</label>
        <input type="text" class="form-control" id="sku" name="sku" required>
    </div>
    <div class="form-group">
        <label for="units">Units</label>
        <input type="number" class="form-control" id="units" name="units" required>
    </div>
    <div class="form-group">
        <label for="selling_price">Selling Price</label>
        <input type="number" class="form-control" id="selling_price" name="selling_price" required>
    </div>
    <div class="form-group">
        <label for="hsn">HSN</label>
        <input type="number" class="form-control" id="hsn" name="hsn" required>
    </div>
    
    <h3>Payment & Shipping</h3>
    <div class="form-group">
        <label for="payment_method">Payment Method</label>
        <input type="text" class="form-control" id="payment_method" name="payment_method" required>
    </div>
    <div class="form-group">
        <label for="shipping_charges">Shipping Charges</label>
        <input type="number" class="form-control" id="shipping_charges" name="shipping_charges">
    </div>
	<div class="form-group">
        <label for="giftwrap_charges">Giftwrap Charges</label>
        <input type="number" class="form-control" id="giftwrap_charges" name="giftwrap_charges">
    </div>
	<div class="form-group">
        <label for="transaction_charges">Transaction Charges</label>
        <input type="number" class="form-control" id="transaction_charges" name="transaction_charges">
    </div>
	<div class="form-group">
        <label for="total_discount">Total Discount</label>
        <input type="number" class="form-control" id="total_discount" name="total_discount">
    </div>
    <div class="form-group">
        <label for="sub_total">Subtotal</label>
        <input type="number" class="form-control" id="sub_total" name="sub_total" required>
    </div>
	 <div class="form-group">
        <label for="length">Length</label>
        <input type="number" class="form-control" id="length" name="length" step="0.01" required>
    </div>
	 <div class="form-group">
        <label for="breadth">Breadth</label>
        <input type="number" class="form-control" id="breadth" name="breadth" step="0.01" required>
    </div>
	 <div class="form-group">
        <label for="height">Height</label>
        <input type="number" class="form-control" id="height" name="height" step="0.01" required>
    </div>
    <div class="form-group">
        <label for="weight">Weight</label>
        <input type="number" class="form-control" id="weight" name="weight" step="0.01" required>
    </div>
    
    <button type="submit" class="btn btn-primary">Submit Order</button>
</form>
	  `;
    $(frappe.render_template(htmlContent, this)).appendTo(this.page.main);

    let createOrder = function (orderPayload) {
      frappe.call({
        method:
          "adi_shipment.adi_shipment.page.order_page.order_page.create_custom_order",
        args: {
          order_details_str: orderPayload,
        },
        callback: function (createOrder) {
          if (createOrder.message.error) {
            console.error("Failed to create order:", createOrder.message.error);
            alert("Order creation failed: " + createOrder.message.error);
          } else {
            console.log("Order created successfully:", createOrder.message);
            window.location.href = `create-shipment?order-id=${createOrder.message.order_id}&shipment-id=${createOrder.message.shipment_id}`;
            alert(
              "Order Created Successfully! Order ID: " +
                createOrder.message.order_id
            );
          }
        },
      });
    };

    function autofillOrderDetails() {
      const orderDetails = {
        order_id: "224-447",
        order_date: "2025-02-24 11:11",
        pickup_location: "Home",
        channel_id: "",
        comment: "Reseller: M/s Goku",
        billing_customer_name: "Naruto",
        billing_last_name: "Uzumaki",
        billing_address: "House 221B, Leaf Village",
        billing_address_2: "Near Hokage House",
        billing_city: "New Delhi",
        billing_pincode: 110002,
        billing_state: "Delhi",
        billing_country: "India",
        billing_email: "naruto@uzumaki.com",
        billing_phone: "9876543210",
        shipping_is_billing: true,
        shipping_customer_name: "Muskan",
        shipping_last_name: "Sindhu",
        shipping_address: "Sunder Nagar",
        shipping_address_2: "ITI",
        shipping_city: "Ranchi",
        shipping_pincode: 834005,
        shipping_country: "India",
        shipping_state: "Jharkhand",
        shipping_email: "muskansindhu.1104@gmail.com",
        shipping_phone: "8293833333",
        payment_method: "Prepaid",
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: 9000,
        length: 10,
        breadth: 15,
        height: 20,
        weight: 2.5,
      };

      const orderItem = {
        item_name: "Kunai",
        sku: "chakra123",
        units: 10,
        selling_price: 900,
        hsn: 441122,
      };

      setTimeout(() => {
        Object.keys(orderDetails).forEach((key) => {
          let input = document.getElementById(key);
          if (input) input.value = orderDetails[key];
        });
        Object.keys(orderItem).forEach((key) => {
          let input = document.getElementById(key);
          if (input) input.value = orderItem[key];
        });
      }, 2000);
    }

    autofillOrderDetails();

    function formatOrderPayload(formData) {
      //   const payload = {
      //     order_id: formData.order_id,
      //     order_date:
      //       moment(formData.order_date).format("YYYY-MM-DD HH:mm") ||
      //       moment().format("YYYY-MM-DD HH:mm"),
      //     pickup_location: formData.pickup_location,
      //     channel_id: formData.channel_id,
      //     comment: formData.comment,
      //     billing_customer_name: formData.billing_customer_name || "Naruto",
      //     billing_last_name: formData.billing_last_name,
      //     billing_address: formData.billing_address,
      //     billing_address_2: formData.billing_address_2,
      //     billing_city: formData.billing_city,
      //     billing_pincode: formData.billing_pincode,
      //     billing_state: formData.billing_state,
      //     billing_country: formData.billing_country,
      //     billing_email: formData.billing_email,
      //     billing_phone: formData.billing_phone,
      //     shipping_is_billing: formData.shipping_is_billing === "on",
      //     shipping_customer_name: formData.shipping_customer_name,
      //     shipping_last_name: formData.shipping_last_name,
      //     shipping_address: formData.shipping_address,
      //     shipping_address_2: formData.shipping_address_2,
      //     shipping_city: formData.shipping_city,
      //     shipping_pincode: formData.shipping_pincode,
      //     shipping_country: formData.shipping_country,
      //     shipping_state: formData.shipping_state,
      //     shipping_email: formData.shipping_email,
      //     shipping_phone: formData.shipping_phone,
      //     order_items: [
      //       {
      //         name: formData.item_name || "Kunai",
      //         sku: formData.sku || "chakra123",
      //         units: parseInt(formData.units || 10),
      //         selling_price: formData.selling_price || "900",
      //         discount: formData.discount || "",
      //         tax: formData.tax || "",
      //         hsn: parseInt(formData.hsn || 441122),
      //       },
      //     ],
      //     payment_method: formData.payment_method,
      //     shipping_charges: parseFloat(formData.shipping_charges),
      //     giftwrap_charges: parseFloat(formData.giftwrap_charges),
      //     transaction_charges: parseFloat(formData.transaction_charges),
      //     total_discount: parseFloat(formData.total_discount),
      //     sub_total: parseFloat(formData.sub_total),
      //     length: parseFloat(formData.length),
      //     breadth: parseFloat(formData.breadth),
      //     height: parseFloat(formData.height),
      //     weight: parseFloat(formData.weight),
      //   };

      const payload = {
        order_id: "123491",
        order_date: "2025-02-24 11:11",
        pickup_location: "Home",
        channel_id: "",
        comment: "Reseller: M/s Goku",
        billing_customer_name: "Naruto",
        billing_last_name: "Uzumaki",
        billing_address: "House 221B, Leaf Village",
        billing_address_2: "Near Hokage House",
        billing_city: "New Delhi",
        billing_pincode: "110002",
        billing_state: "Delhi",
        billing_country: "India",
        billing_email: "naruto@uzumaki.com",
        billing_phone: "9876543210",
        shipping_is_billing: true,
        shipping_customer_name: "",
        shipping_last_name: "",
        shipping_address: "",
        shipping_address_2: "",
        shipping_city: "",
        shipping_pincode: "",
        shipping_country: "",
        shipping_state: "",
        shipping_email: "",
        shipping_phone: "",
        order_items: [
          {
            name: "Kunai",
            sku: "chakra123",
            units: 10,
            selling_price: "900",
            discount: "",
            tax: "",
            hsn: 441122,
          },
        ],
        payment_method: "Prepaid",
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: 9000,
        length: 10,
        breadth: 15,
        height: 20,
        weight: 2.5,
      };

      return payload;
    }

    $(document).ready(function () {
      $("#order-details-form").on("submit", function (event) {
        event.preventDefault();

        var formData = $(this).serialize();

        // var formDataObj = {};
        // formData.split("&").forEach(function (pair) {
        //   var [key, value] = pair.split("=");
        //   formDataObj[decodeURIComponent(key)] = decodeURIComponent(value);
        // });
        console.log(formData);
        var OrderPayload = JSON.stringify(formatOrderPayload(formData));
        console.log("JSON Payload:", OrderPayload);

        createOrder(OrderPayload);
      });
    });
  },
});
