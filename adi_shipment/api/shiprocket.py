# ```python
import frappe
import requests
import json
from frappe.utils import add_to_date, now_datetime

def get_token():
    settings = frappe.get_single("Shiprocket Settings")

    from frappe.utils import get_datetime
    
    if settings.token and settings.token_expiry:
        expiry = get_datetime(settings.token_expiry)
        if expiry > now_datetime():
            return settings.token

    url = "https://apiv2.shiprocket.in/v1/external/auth/login"
    if not settings.email or not settings.password:
        frappe.throw("Please set Shiprocket API Email and Password in Shiprocket Settings")

    password = settings.get_password("password")
    if not password:
        frappe.throw("Password not found. Please re-enter the password in Shiprocket Settings.")

    payload = {
        "email": settings.email.strip(),
        "password": password.strip()
    }

    try:
        response = requests.post(url, json=payload)
        if response.status_code != 200:
            frappe.throw(f"Shiprocket Login Failed ({response.status_code}): {response.text}")
        data = response.json()
    except Exception as e:
        frappe.throw(f"Shiprocket Login Error: {str(e)}")

    token = data.get("token")
    settings.token = token
    settings.token_expiry = add_to_date(now_datetime(), hours=23)
    settings.save()

    return token

@frappe.whitelist()
def create_shipment_from_dn(dn_name):
    dn = frappe.get_doc("Delivery Note", dn_name)
    token = get_token()

    url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"

    items = []
    for i in dn.items:
        items.append({
            "name": i.item_name,
            "sku": i.item_code,
            "units": i.qty,
            "selling_price": i.rate
        })

    # Default values
    billing_address = "Address Not Provided"
    billing_city = "City"
    billing_pincode = "110001" # Default valid pincode
    billing_state = "State"
    billing_phone = dn.contact_mobile or "9999999999"
    
    # Try to fetch actual address details if available
    if dn.address_display:
        # Clean up address display
        import re
        clean_address = re.sub('<[^<]+?>', ', ', dn.address_display) # Remove HTML tags
        clean_address = clean_address.replace('\n', ' ').strip()
        billing_address = clean_address[:80] # Shiprocket limit is strict, keep it under 100
        
    # If we have a specific address link, use that for more precision
    if dn.shipping_address_name or dn.customer_address:
        address_name = dn.shipping_address_name or dn.customer_address
        if address_name:
            address = frappe.get_doc("Address", address_name)
            billing_address = address.address_line1 + (" " + address.address_line2 if address.address_line2 else "")
            billing_city = address.city or billing_city
            billing_pincode = address.pincode or billing_pincode
            billing_state = address.state or billing_state
            billing_phone = address.phone or billing_phone

    # Ensure phone is valid (10 digits)
    if not billing_phone or len(str(billing_phone)) < 10:
        billing_phone = "9999999999"

    # Split address if too long
    billing_address_1 = billing_address[:50]
    billing_address_2 = billing_address[50:100] if len(billing_address) > 50 else ""

    payload = {
        "order_id": dn.name,
        "order_date": str(dn.posting_date),
        "pickup_location": "Primary", # Must match a pickup location in Shiprocket
        "billing_customer_name": dn.customer_name,
        "billing_last_name": "",
        "billing_address": billing_address_1,
        "billing_address_2": billing_address_2,
        "billing_city": billing_city,
        "billing_pincode": billing_pincode,
        "billing_state": billing_state,
        "billing_country": "India",
        "billing_email": dn.contact_email or "test@example.com",
        "billing_phone": billing_phone,
        "shipping_is_billing": True,
        "order_items": items,
        "payment_method": "Prepaid",
        "sub_total": dn.total,
        "length": 10,
        "breadth": 10,
        "height": 10,
        "weight": dn.total_net_weight or 1
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    # Debug: Print Payload (Print to console only, don't create Error Log to avoid confusion)
    print(f"Shiprocket Payload: {payload}")

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if response.status_code not in [200, 201]:
             error_msg = data.get('message', response.text)
             if isinstance(error_msg, dict):
                 error_msg = json.dumps(error_msg)
             
             frappe.log_error(f"Shiprocket API Error: {error_msg}\nPayload: {json.dumps(payload)}", "Shiprocket Error")
             frappe.throw(f"Shiprocket Error: {error_msg}")
             
    except Exception as e:
        frappe.log_error(f"Failed to create order: {str(e)}", "Shiprocket Error")
        frappe.throw(f"Failed to create order in Shiprocket: {str(e)}")

    # Save Order ID and Shipment ID
    if data.get("order_id"):
        dn.db_set("shiprocket_order_id", data.get("order_id"))
    if data.get("shipment_id"):
        dn.db_set("shiprocket_shipment_id", data.get("shipment_id"))

    # Generate AWB
    shipment_id = data.get("shipment_id")
    if shipment_id:
        awb_url = "https://apiv2.shiprocket.in/v1/external/courier/assign/awb"
        awb_payload = {"shipment_id": shipment_id}
        try:
            awb_response = requests.post(awb_url, json=awb_payload, headers=headers)
            awb_data = awb_response.json()
            
            if awb_data.get("awb_assign_status") == 1:
                 response_data = awb_data.get("response", {}).get("data", {})
                 awb_code = response_data.get("awb_code")
                 if awb_code:
                     dn.db_set("shiprocket_awb", awb_code)
                     data["awb_code"] = awb_code
        except Exception as e:
            frappe.log_error(f"Failed to generate AWB for {dn.name}: {str(e)}", "Shiprocket AWB Error")

    return data

def create_shipment_after_submit(doc, method):
    try:
        create_shipment_from_dn(doc.name)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Shiprocket Auto Create Failed")
