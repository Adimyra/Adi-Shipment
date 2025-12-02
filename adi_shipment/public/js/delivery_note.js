frappe.ui.form.on("Delivery Note", {
    refresh(frm) {
        if (frm.doc.docstatus === 1) {
            if (!frm.doc.shiprocket_shipment_id) {
                frm.add_custom_button("Create Shiprocket Shipment", () => {
                    frappe.call({
                        method: "adi_shipment.api.shiprocket.create_shipment_from_dn",
                        args: { dn_name: frm.doc.name },
                        freeze: true,
                        freeze_message: "Creating Shipment...",
                        callback(r) {
                            if (!r.exc) {
                                frappe.msgprint("Shipment created successfully!");
                                frm.reload_doc();

                                // Redirect to tracking page or AWB page
                                if (r.message && r.message.awb_code) {
                                    window.open("https://app.shiprocket.in/tracking/" + r.message.awb_code, "_blank");
                                } else {
                                    window.open("https://app.shiprocket.in/user/shipments", "_blank");
                                }
                            }
                        }
                    });
                }).addClass("btn-primary");
            } else {
                // Maybe add a button to track?
                frm.add_custom_button("Track Shipment", () => {
                    if (frm.doc.shiprocket_awb) {
                        window.open("https://app.shiprocket.in/tracking/" + frm.doc.shiprocket_awb, "_blank");
                    } else {
                        window.open("https://app.shiprocket.in/user/shipments", "_blank");
                    }
                });
            }
        }
    }
});
