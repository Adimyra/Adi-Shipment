import frappe
import requests
import json
from adi_shipment.api.shiprocket import get_token

@frappe.whitelist()
def get_dashboard_data():
    token = get_token()
    if not token:
        return {"error": "Authentication failed. Please check settings."}

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get Orders (Last 50)
    orders_url = "https://apiv2.shiprocket.in/v1/external/orders"
    try:
        orders_res = requests.get(orders_url, headers=headers)
        orders_data = orders_res.json()
    except Exception as e:
        orders_data = {"data": []}
        frappe.log_error(f"Shiprocket Dashboard Error: {str(e)}")

    # 2. Calculate Stats
    stats = {
        "total": 0,
        "new": 0,
        "pickup_scheduled": 0,
        "shipped": 0,
        "delivered": 0
    }
    
    recent_orders = []
    
    if orders_data.get("data"):
        for order in orders_data.get("data", []):
            stats["total"] += 1
            status = order.get("status", "").lower()
            
            if status == "new":
                stats["new"] += 1
            elif "pickup" in status:
                stats["pickup_scheduled"] += 1
            elif status == "shipped":
                stats["shipped"] += 1
            elif status == "delivered":
                stats["delivered"] += 1
                
            recent_orders.append({
                "id": order.get("id"),
                "channel_order_id": order.get("channel_order_id"),
                "customer_name": order.get("customer_name"),
                "status": order.get("status"),
                "total": order.get("total"),
                "payment_method": order.get("payment_method")
            })
            
    return {
        "stats": stats,
        "orders": recent_orders[:50]
    }

@frappe.whitelist()
def create_custom_order(order_details_str):
    token = get_token()
    if not token:
        return {"error": "Authentication failed"}

    order_details = json.loads(order_details_str)
    frappe.errprint(f"Shiprocket Payload: {json.dumps(order_details, indent=2)}")
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc"
    
    try:
        res = requests.post(url, headers=headers, json=order_details) 
        res.raise_for_status() 
        return res.json()  
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket Create Order Error: {str(e)}")
        try:
            error_resp = res.json()
            return {"error": error_resp.get('message', str(e))}
        except:
            return {"error": f"Failed to create order: {str(e)}"}

@frappe.whitelist()
def get_freight_price_from_dimension(freight_details_str):
    token = get_token()
    if not token:
        return {"error": "Authentication failed"}

    freight_details = json.loads(freight_details_str)
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    url = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"
    
    try:
        res = requests.get(url, headers=headers, params=freight_details) 
        res.raise_for_status() 
        return res.json()  
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket Rate Calc Error: {str(e)}")
        return {"error": "Failed to fetch shipment cost"}
