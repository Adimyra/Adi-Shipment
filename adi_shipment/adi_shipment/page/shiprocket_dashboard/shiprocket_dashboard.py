import frappe
import requests
from adi_shipment.api.shiprocket import get_token

@frappe.whitelist()
def get_dashboard_data():
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
            "shipped": 0,
            "delivered": 0,
            "cancelled": 0
        }
    }

    try:
        # Fetch Orders (Last 50)
        url = "https://apiv2.shiprocket.in/v1/external/orders?per_page=50"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            res_data = response.json()
            orders = res_data.get("data", [])
            data["orders"] = orders
            
            # Calculate Stats
            for order in orders:
                status = order.get("status", "").upper()
                data["stats"]["total"] += 1
                
                if status == "NEW":
                    data["stats"]["new"] += 1
                elif status == "PICKUP SCHEDULED":
                    data["stats"]["pickup_scheduled"] += 1
                elif status == "SHIPPED":
                    data["stats"]["shipped"] += 1
                elif status == "DELIVERED":
                    data["stats"]["delivered"] += 1
                elif status == "CANCELLED":
                    data["stats"]["cancelled"] += 1
                    
        else:
             frappe.log_error(f"Shiprocket Dashboard Error: {response.text}")

    except Exception as e:
        frappe.log_error(f"Shiprocket Dashboard Exception: {str(e)}")
        
    return data
