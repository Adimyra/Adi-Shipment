import frappe
import requests
import json
import re
from adi_shipment.api.shiprocket import get_token

@frappe.whitelist()
def get_dashboard_data(search_term=None, tab_view="All", from_date=None, to_date=None):
    token = get_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    data = {
        "orders": [],
        "stats": {
            "total": 0,
            "new": 0,
            "pickup_scheduled": 0,
            "in_transit": 0,
            "delivered": 0,
            "cancelled": 0,
            "rto": 0
        }
    }

    try:
        # Shiprocket API Params
        params = {
            "per_page": 100, 
            "sort": "DESC"
        }
        
        if search_term:
            params["search"] = search_term
        
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        url = "https://apiv2.shiprocket.in/v1/external/orders"
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            res_data = response.json()
            all_orders = res_data.get("data", [])
            
            filtered_orders = []
            
            for order in all_orders:
                status = order.get("status", "").upper()
                
                # --- Stats Calculation ---
                data["stats"]["total"] += 1
                
                # Mapping logic based on Shiprocket status codes/text
                if status in ["NEW", "PROCESSING", "INVOICED", "AWB ASSIGNED"]: 
                    data["stats"]["new"] += 1
                elif status in ["READY TO SHIP", "MANIFEST GENERATED"]:
                    data["stats"]["new"] += 1 # Grouping Ready to Ship with New for this card, or we could add separate
                elif "PICKUP" in status and "SCHEDULED" in status:
                    data["stats"]["pickup_scheduled"] += 1
                elif "TRANSIT" in status or status in ["SHIPPED", "OUT FOR DELIVERY", "REACHED AT DESTINATION HUB"]:
                    data["stats"]["in_transit"] += 1
                elif status == "DELIVERED":
                    data["stats"]["delivered"] += 1
                elif status in ["CANCELED", "CANCELLED"]:
                    data["stats"]["cancelled"] += 1
                elif "RTO" in status:
                    data["stats"]["rto"] += 1

                if not status:
                     continue
                
                # --- Pre-process Data (Name, Phone) ---
                c_name = order.get("customer_name", "")
                if "-" in c_name:
                    parts = c_name.split("-")
                    if len(parts) == 2 and parts[0].strip().lower() == parts[1].strip().lower():
                        c_name = parts[0].strip()
                order["customer_name"] = c_name
                
                # Fetch mobile number from shipment doc
                if order.get('channel_order_id', '').startswith('SHIP-'):
                    try:
                        shipment_name = order.get('channel_order_id')
                        delivery_contact = frappe.db.get_value('Shipment', shipment_name, 'delivery_contact')
                        if delivery_contact:
                            phones = re.findall(r'\b\d{10}\b', str(delivery_contact))
                            if phones:
                                order['customer_phone'] = phones[-1]
                    except Exception:
                        pass
                
                # Extract Shipment Details (AWB, Courier) early for search
                s_awb = ""
                s_courier = ""
                if order.get("shipments"):
                     s_awb = str(order.get("shipments")[0].get("awb", "")).lower()
                     s_courier = str(order.get("shipments")[0].get("courier", "")).lower()
                
                # --- Search Filter ---
                if search_term:
                    term = search_term.lower()
                    # Fields to search in
                    s_id = str(order.get("id", "")).lower()
                    c_id = str(order.get("channel_order_id", "")).lower()
                    c_name_lower = str(order.get("customer_name", "")).lower()
                    c_email = str(order.get("customer_email", "")).lower()
                    c_phone = str(order.get("customer_phone", "")).lower()

                    if (term not in s_id and 
                        term not in c_id and 
                        term not in c_name_lower and 
                        term not in c_email and 
                        term not in c_phone and
                        term not in s_awb and
                        term not in s_courier):
                        continue

                # --- Tab Filtering ---
                include_order = False
                
                if tab_view == "All":
                    include_order = True
                
                elif tab_view == "New":
                    # Pending orders
                    if status in ["NEW", "PROCESSING"]:
                        include_order = True
                        
                elif tab_view == "Ready To Ship":
                    # Invoice Generated / AWB Assigned but not pickup scheduled yet
                    # Merged NEW/PROCESSING here as per user request to remove NEW tab
                    if status in ["NEW", "PROCESSING", "INVOICED", "AWB ASSIGNED", "READY TO SHIP", "MANIFEST GENERATED"]:
                        include_order = True
                        
                elif tab_view == "Pickups":
                    # Pickup scheduled or queued
                    if "PICKUP" in status and ("SCHEDULED" in status or "QUEUED" in status or "RESCHEDULED" in status):
                        include_order = True
                        
                elif tab_view == "In Transit":
                    if "TRANSIT" in status or status in ["SHIPPED", "OUT FOR DELIVERY", "REACHED AT DESTINATION HUB"]:
                        include_order = True
                        
                elif tab_view == "Delivered":
                    if status == "DELIVERED":
                        include_order = True
                        
                elif tab_view == "RTO":
                    if "RTO" in status:
                        include_order = True
                        
                elif tab_view == "Cancelled":
                    if status in ["CANCELED", "CANCELLED"]:
                        include_order = True

                if include_order:
                    # Enrich order object for UI
                    
                    # Payment extraction (sometimes it's in payment_method or others)
                    # No change needed if already working, just standardizing
                    
                    # Extract courier and awb
                    s_details = order.get("shipments")
                    order["display_courier"] = s_details[0].get("courier") if s_details else ""
                    order["display_awb"] = s_details[0].get("awb") if s_details else ""
                    
                    filtered_orders.append(order)
            
            data["orders"] = filtered_orders
                    
        else:
             frappe.log_error(f"Shiprocket Dashboard Error: {response.text}")

    except Exception as e:
        frappe.log_error(f"Shiprocket Dashboard Exception: {str(e)}")
        
    return data

@frappe.whitelist()
def print_shiprocket_artifact(shipment_id, type="label"):
    """
    Generate Label or Manifest directly from Shipment ID (Shiprocket ID).
    """
    token = get_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    url = ""
    payload = {"shipment_id": [shipment_id]}

    if type == "label":
        url = "https://apiv2.shiprocket.in/v1/external/courier/generate/label"
    elif type == "manifest":
        url = "https://apiv2.shiprocket.in/v1/external/manifests/generate"
    else:
        frappe.throw("Invalid Print Type")

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if type == "label":
             if data.get("label_url"):
                 return {"url": data.get("label_url")}
             elif data.get("label_created") == 1 and data.get("response_url"):
                 return {"url": data.get("response_url")}
             else:
                 frappe.throw(f"Could not generate label: {data.get('message', 'Unknown Error')}")
        
        elif type == "manifest":
             if data.get("manifest_url"):
                  return {"url": data.get("manifest_url")}
             else:
                  frappe.throw(f"Could not generate manifest: {data.get('message', 'Unknown Error')}")

    except Exception as e:
        frappe.log_error(f"Print Artifact Error: {str(e)}")
        frappe.throw(str(e))
