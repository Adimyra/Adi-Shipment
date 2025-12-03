# ```python
import frappe
import requests
import json
from frappe.utils import add_to_date, now_datetime, flt

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
def create_shipment_from_dn(dn_name, package_details=None):
    dn = frappe.get_doc("Delivery Note", dn_name)
    token = get_token()
    
    # Parse package details if provided as string (from JS call) or dict
    if isinstance(package_details, str):
        package_details = json.loads(package_details)
    
    pkg = package_details or {}

    url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"

    items = []
    sku_map = {}
    for i in dn.items:
        sku = i.item_code
        if sku in sku_map:
            sku_map[sku]["units"] += i.qty
        else:
            sku_map[sku] = {
                "name": i.item_name,
                "sku": i.item_code,
                "units": i.qty,
                "selling_price": i.rate
            }
    items = list(sku_map.values())

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

    # Clean Phone Number
    import re
    if billing_phone:
        # Remove all non-digit characters
        billing_phone = re.sub(r'\D', '', str(billing_phone))
        # If it starts with 91 and is longer than 10 digits, remove 91
        if len(billing_phone) > 10 and billing_phone.startswith('91'):
            billing_phone = billing_phone[2:]

    # Ensure phone is valid (10 digits)
    if not billing_phone or len(str(billing_phone)) < 10:
        billing_phone = "9999999999"

    # Split address if too long
    billing_address_1 = billing_address[:50]
    billing_address_2 = billing_address[50:100] if len(billing_address) > 50 else ""

    payload = {
        "order_id": dn.name,
        "order_date": str(dn.posting_date),
        "pickup_location": "work", # Updated to match your Shiprocket account
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
        "length": float(pkg.get('length', 10)),
        "breadth": float(pkg.get('breadth', 10)),
        "height": float(pkg.get('height', 10)),
        "weight": float(pkg.get('weight', dn.total_net_weight or 0.5))
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
        
        # Check for HTTP error codes OR API level errors (missing order_id)
        if response.status_code not in [200, 201] or not data.get("order_id"):
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
@frappe.whitelist()
def create_order_from_shipment(shipment_name):
    doc = frappe.get_doc("Shipment", shipment_name)
    token = get_token()
    
    # 1. Gather Items from linked Delivery Notes
    items = []
    sku_map = {}
    total_value = doc.value_of_goods
    
    # If Shipment has no items directly, fetch from linked DNs
    if not items and doc.shipment_delivery_note:
        for link in doc.shipment_delivery_note:
            dn = frappe.get_doc("Delivery Note", link.delivery_note)
            for i in dn.items:
                sku = i.item_code
                if sku in sku_map:
                    sku_map[sku]["units"] += i.qty
                else:
                    sku_map[sku] = {
                        "name": i.item_name,
                        "sku": i.item_code,
                        "units": i.qty,
                        "selling_price": i.rate
                    }
    
    items = list(sku_map.values())
    
    # 2. Address Details
    # Pickup
    pickup_location = "work" # Default
    if doc.pickup_address_name:
        # You might need to map this to Shiprocket Pickup Location Alias
        # For now, defaulting to 'work' or user's default
        pass

    # Delivery
    delivery_address = ""
    delivery_city = ""
    delivery_pincode = ""
    delivery_state = ""
    delivery_phone = ""
    
    delivery_name = doc.delivery_contact_name or "Customer"
    delivery_email = doc.delivery_contact_email or "test@example.com"

    # 1. Try fetching from linked Address Document
    if doc.delivery_address_name:
        try:
            addr = frappe.get_doc("Address", doc.delivery_address_name)
            delivery_address = addr.address_line1 + (" " + addr.address_line2 if addr.address_line2 else "")
            delivery_city = addr.city
            delivery_pincode = addr.pincode
            delivery_state = addr.state
            delivery_phone = addr.phone
        except:
            pass

    # 2. Fallback: Parse from Shipment's 'delivery_address' field (HTML) if Address doc failed or incomplete
    # Example HTML: "SEMAR TOLI, KANKE RANCHI<br>\nRANCHI<br>\nJharkhand<br>India<br>\n<br>\n"
    if (not delivery_address or not delivery_city or not delivery_pincode) and doc.delivery_address:
        import re
        # Replace <br> with newlines and strip HTML tags
        raw_addr = doc.delivery_address.replace("<br>", "\n").replace("<br/>", "\n")
        clean_addr = re.sub('<[^<]+?>', '', raw_addr).strip()
        lines = [line.strip() for line in clean_addr.split('\n') if line.strip()]
        
        # Heuristic Parsing (Assuming standard Frappe address format)
        # Line 1: Address
        # Line 2: City
        # Line 3: State
        # Line 4: Country (maybe)
        # Pincode might be on its own line or mixed
        
        if len(lines) >= 2:
            delivery_address = lines[0]
            
            # Try to find pincode in any line (6 digits)
            for line in lines:
                pin_match = re.search(r'\b\d{6}\b', line)
                if pin_match:
                    delivery_pincode = pin_match.group(0)
                    # If line is just pincode, ignore it for city
                    if line.strip() == delivery_pincode:
                        continue
            
            # City is usually the second line, or the line before state
            # Let's try to find city from lines excluding address and pincode
            potential_cities = [l for l in lines if l != delivery_address and l != delivery_pincode and l.lower() != "india"]
            if potential_cities:
                delivery_city = potential_cities[0]
                if len(potential_cities) > 1:
                    delivery_state = potential_cities[1]

    # Validate Address Data
    if not delivery_address or not delivery_city or not delivery_pincode:
        # Final attempt: Use defaults if strictly necessary to unblock (User requested "find what u want")
        # But better to warn. Let's try to infer from Delivery Note if linked.
        if doc.shipment_delivery_note:
             for link in doc.shipment_delivery_note:
                 dn = frappe.get_doc("Delivery Note", link.delivery_note)
                 # Try parsing DN address display
                 if dn.address_display:
                     # ... (Logic similar to above, or just rely on the heuristic above which works on Shipment too)
                     pass
        
        # If still failing, throw error
        frappe.throw(f"Could not find complete address (Address, City, Pincode) in Shipment or linked Address. <br>Found: {delivery_address}, {delivery_city}, {delivery_pincode}")

    # If phone not found in Address, try to parse from 'delivery_contact' field

    # If phone not found in Address, try to parse from 'delivery_contact' field
    # Format is often: "Name<br>Phone"
    if not delivery_phone and doc.delivery_contact:
        import re
        # Extract all digits from the string
        digits = re.findall(r'\d+', str(doc.delivery_contact))
        # Join them to form a number (in case of spaces)
        potential_phone = "".join(digits)
        # If we found a sequence of 10-12 digits, use it
        if len(potential_phone) >= 10:
             delivery_phone = potential_phone

    # Clean Phone Number
    import re
    if delivery_phone:
        # Remove all non-digit characters
        delivery_phone = re.sub(r'\D', '', str(delivery_phone))
        # If it starts with 91 and is longer than 10 digits, remove 91
        if len(delivery_phone) > 10 and delivery_phone.startswith('91'):
            delivery_phone = delivery_phone[2:]
            
    # Final Fallback to the genuine company number provided
    if not delivery_phone or len(delivery_phone) < 10:
        delivery_phone = "9122331261"
        
    # 3. Parcel Details (Dimensions)
    length, breadth, height, weight = 10, 10, 10, 0.5
    if doc.shipment_parcel:
        # Shiprocket supports multiple packets, but for Adhoc API usually takes one aggregate or list.
        # Let's take the first parcel or aggregate.
        p = doc.shipment_parcel[0]
        length = p.length
        breadth = p.width
        height = p.height
        weight = p.weight

    # 4. Payment Method & Sub Total
    payment_method = "Prepaid"
    sub_total = total_value
    
    # Check Shipment for explicit COD amount or Payment Method
    # Use 'shipment_amount' as COD amount if available
    if doc.get("payment_method") == "COD" or payment_method == "COD":
        payment_method = "COD"
        if doc.shipment_amount and doc.shipment_amount > 0:
            sub_total = doc.shipment_amount
    elif doc.get("cod_amount") and flt(doc.cod_amount) > 0:
        payment_method = "COD"
        sub_total = doc.cod_amount
    elif doc.get("payment_method"):
        payment_method = doc.payment_method
        
    # If still Prepaid, check linked Delivery Note for COD hints
    if payment_method == "Prepaid" and doc.shipment_delivery_note:
        for link in doc.shipment_delivery_note:
            dn = frappe.get_doc("Delivery Note", link.delivery_note)
            # Example: Check if DN has a custom is_cod field or similar
            if dn.get("is_cod") or (dn.get("payment_terms_template") and "COD" in dn.payment_terms_template):
                payment_method = "COD"
                # If COD, we might want to ensure sub_total matches the invoice amount?
                # For now, keeping value_of_goods or shipment_amount
                break

    payload = {
        "order_id": doc.name,
        "order_date": str(doc.creation),
        "pickup_location": "work", # Ensure this matches your Shiprocket Config
        "billing_customer_name": delivery_name,
        "billing_last_name": "",
        "billing_address": delivery_address[:50],
        "billing_address_2": delivery_address[50:100] if len(delivery_address) > 50 else "",
        "billing_city": delivery_city,
        "billing_pincode": delivery_pincode,
        "billing_state": delivery_state,
        "billing_country": "India",
        "billing_email": delivery_email,
        "billing_phone": delivery_phone,
        "shipping_is_billing": True,
        "order_items": items,
        "payment_method": payment_method,
        "sub_total": sub_total,
        "length": float(length),
        "breadth": float(breadth),
        "height": float(height),
        "weight": float(weight)
    }

    url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if response.status_code not in [200, 201] or not data.get("order_id"):
             error_msg = data.get('message', response.text)
             frappe.throw(f"Shiprocket Error: {error_msg}")

        # Success - Save IDs
        # Try to save to shiprocket_order_id if field exists, else just log
        if data.get("order_id"):
            try:
                doc.db_set("shiprocket_order_id", data.get("order_id"))
            except:
                pass # Field might not exist
        
        if data.get("shipment_id"):
            doc.db_set("shipment_id", data.get("shipment_id"))
            
        doc.db_set("carrier", "Shiprocket")
        
        return data

    except Exception as e:
        frappe.log_error(f"Shiprocket Create Order Error: {str(e)}")
        frappe.throw(str(e))

@frappe.whitelist()
def get_courier_serviceability(shipment_name):
    doc = frappe.get_doc("Shipment", shipment_name)
    token = get_token()
    
    # Get Delivery Pincode
    delivery_pincode = "110001"
    if doc.delivery_address_name:
         addr = frappe.get_doc("Address", doc.delivery_address_name)
         delivery_pincode = addr.pincode
    elif doc.delivery_pincode: # Fallback if saved on doc
        delivery_pincode = doc.delivery_pincode

    # Get Weight & Dimensions
    weight = 0.5
    length, breadth, height = 10, 10, 10
    if doc.shipment_parcel:
        p = doc.shipment_parcel[0]
        weight = p.weight
        length = p.length
        breadth = p.width
        height = p.height

    # Pickup Pincode (Defaulting to Ranchi/Work for now, ideally fetch from Pickup Address)
    pickup_pincode = "834001" 
    if doc.pickup_address_name:
         try:
             addr = frappe.get_doc("Address", doc.pickup_address_name)
             if addr.pincode:
                 pickup_pincode = addr.pincode
         except:
             pass

    # Determine Payment Method
    payment_method = doc.payment_method or "Prepaid"

    params = {
        "pickup_postcode": pickup_pincode, 
        "delivery_postcode": delivery_pincode,
        "weight": weight,
        "cod": 1 if payment_method == "COD" else 0
    }
    
    url = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, params=params)
        data = response.json()
        
        # Return context + data
        return {
            "shiprocket_response": data,
            "context": {
                "weight": weight,
                "dimensions": f"{length} x {breadth} x {height}",
                "pickup_pincode": pickup_pincode,
                "delivery_pincode": delivery_pincode,
                "payment_method": payment_method,
                "volumetric_weight": (float(length) * float(breadth) * float(height)) / 5000
            }
        }
    except Exception as e:
        frappe.log_error(f"Serviceability Error: {str(e)}")
        return {"error": str(e)}

@frappe.whitelist()
def assign_awb_for_shipment(shipment_name, courier_company_id):
    doc = frappe.get_doc("Shipment", shipment_name)
    token = get_token()
    
    shipment_id = doc.shipment_id
    if not shipment_id:
        frappe.throw("Shipment ID not found. Please create order first.")

    payload = {
        "shipment_id": shipment_id,
        "courier_id": courier_company_id
    }
    
    url = "https://apiv2.shiprocket.in/v1/external/courier/assign/awb"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(url, json=payload, headers=headers)
    data = response.json()
    
    if data.get("awb_assign_status") == 1:
        resp = data.get("response", {}).get("data", {})
        
        # Update fields even if document is submitted
        # db_set updates the database directly
        doc.db_set("awb_number", resp.get("awb_code"))
        doc.db_set("carrier", resp.get("courier_name"))
        doc.db_set("tracking_url", f"https://shiprocket.co/tracking/{resp.get('awb_code')}")
        doc.db_set("tracking_status", "AWB Assigned")
        
        # Commit to ensure changes are saved immediately
        frappe.db.commit()
        
        return data
    else:
        frappe.throw(f"AWB Assignment Failed: {data.get('message')}")

@frappe.whitelist()
def schedule_pickup_for_shipment(shipment_name):
    doc = frappe.get_doc("Shipment", shipment_name)
    token = get_token()
    
    shipment_id = doc.shipment_id
    if not shipment_id:
         frappe.throw("Shipment ID not found.")

    payload = {"shipment_id": [shipment_id]}
    
    url = "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(url, json=payload, headers=headers)
    data = response.json()
    
    if data.get("pickup_status") == 1:
        return data
    else:
        # Sometimes it returns 200 but with error in response
        frappe.log_error(f"Pickup Schedule Response: {json.dumps(data)}")
        # frappe.throw(f"Pickup Schedule Failed: {json.dumps(data)}")
        return data # Return anyway to show message



def set_payment_method(doc, method):
    """Auto-set payment method based on linked Sales Invoice"""
    if doc.payment_method:
        return # Don't overwrite if already set manually

    payment_method = "Prepaid" # Default
    
    if doc.shipment_delivery_note:
        for link in doc.shipment_delivery_note:
            dn_doc = frappe.get_doc("Delivery Note", link.delivery_note)
            if dn_doc.is_return: continue

            si_name = None
            for item in dn_doc.items:
                if item.against_sales_invoice:
                    si_name = item.against_sales_invoice
                    break
            
            if not si_name:
                si_list = frappe.get_all("Sales Invoice Item", filters={"delivery_note": link.delivery_note}, fields=["parent"])
                if si_list:
                    si_name = si_list[0].parent
            
            if si_name:
                si_status = frappe.db.get_value("Sales Invoice", si_name, "status")
                if si_status in ["Unpaid", "Overdue", "Draft"]:
                    payment_method = "COD"
                elif si_status == "Paid":
                    payment_method = "Prepaid"
                break
    
    doc.payment_method = payment_method

def update_tracking_status_job():
    """Scheduled job to update tracking status for active shipments"""
    # Fetch active shipments (Submitted, has AWB, not in final state)
    shipments = frappe.get_all("Shipment", 
        filters={
            "docstatus": 1,
            "awb_number": ["is", "set"],
            "tracking_status": ["not in", ["Delivered", "Canceled", "RTO Delivered", "Lost", "Damaged"]]
        },
        fields=["name", "awb_number"]
    )
    
    if not shipments:
        return

    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    for s in shipments:
        try:
            url = f"https://apiv2.shiprocket.in/v1/external/courier/track/awb/{s.awb_number}"
            response = requests.get(url, headers=headers)
            data = response.json()
            
            if data.get("tracking_data") and data["tracking_data"].get("track_status"):
                status = data["tracking_data"]["track_status"]
                
                # Update status if changed
                frappe.db.set_value("Shipment", s.name, "tracking_status", status)
                
        except Exception as e:
            frappe.log_error(f"Tracking Update Error for {s.name}: {str(e)}")
            
    frappe.db.commit()

def validate_shiprocket_order(doc, method):
    """Ensure Shiprocket Order is created before submitting Shipment"""
    # If user wants to enforce Shiprocket order creation before submit
    # Check if shipment_id is present
    if not doc.shipment_id:
        frappe.throw("Please create a Shiprocket Order before submitting the Shipment.")
