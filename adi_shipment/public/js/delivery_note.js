// frappe.ui.form.on('Delivery Note', {
//     refresh(frm) {
//         if (frm.doc.docstatus === 1) {
//             if (!frm.doc.shiprocket_shipment_id) {
//                 frm.add_custom_button("Create Shiprocket Shipment", () => {
//                     // Open Dialog to ask for Package Details
//                     let d = new frappe.ui.Dialog({
//                         title: 'Enter Package Details',
//                         fields: [
//                             {
//                                 label: 'Length (cm)',
//                                 fieldname: 'length',
//                                 fieldtype: 'Float',
//                                 default: 10,
//                                 reqd: 1
//                             },
//                             {
//                                 label: 'Breadth (cm)',
//                                 fieldname: 'breadth',
//                                 fieldtype: 'Float',
//                                 default: 10,
//                                 reqd: 1
//                             },
//                             {
//                                 label: 'Height (cm)',
//                                 fieldname: 'height',
//                                 fieldtype: 'Float',
//                                 default: 10,
//                                 reqd: 1
//                             },
//                             {
//                                 label: 'Weight (kg)',
//                                 fieldname: 'weight',
//                                 fieldtype: 'Float',
//                                 default: 0.5,
//                                 reqd: 1
//                             }
//                         ],
//                         primary_action_label: 'Create Shipment',
//                         primary_action(values) {
//                             frappe.call({
//                                 method: "adi_shipment.api.shiprocket.create_shipment_from_dn",
//                                 args: {
//                                     dn_name: frm.doc.name,
//                                     package_details: values
//                                 },
//                                 freeze: true,
//                                 freeze_message: "Creating Shipment...",
//                                 callback(r) {
//                                     if (!r.exc) {
//                                         d.hide();
//                                         frappe.msgprint("Shipment created successfully!");
//                                         frm.reload_doc();

//                                         // Redirect to tracking page or AWB page
//                                         if (r.message && r.message.awb_code) {
//                                             window.open("https://app.shiprocket.in/tracking/" + r.message.awb_code, "_blank");
//                                         } else {
//                                             window.open("https://app.shiprocket.in/user/shipments", "_blank");
//                                         }
//                                     }
//                                 }
//                             });
//                         }
//                     });
//                     d.show();
//                 }).addClass("btn-primary");
//             } else {
//                 // Add Track Shipment button if shipment already exists
//                 frm.add_custom_button("Track Shipment", () => {
//                     if (frm.doc.shiprocket_awb) {
//                         window.open("https://app.shiprocket.in/tracking/" + frm.doc.shiprocket_awb, "_blank");
//                     } else {
//                         window.open("https://app.shiprocket.in/user/shipments", "_blank");
//                     }
//                 });
//             }
//         }
//     }
// });
