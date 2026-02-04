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
    
    # 0. Get balance
    balance = 0
    try:
        balance_url = "https://apiv2.shiprocket.in/v1/external/account/details/wallet-balance"
        balance_res = requests.get(balance_url, headers=headers)
        balance_data = balance_res.json()
        balance = balance_data.get("data", {}).get("wallet_balance", 0)
    except Exception as e:
        frappe.log_error(f"Shiprocket Balance Error: {str(e)}")
    
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
        "orders": recent_orders[:50],
        "balance": balance
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
        response_data = res.json()

        # Check for API level errors (missing order_id) even if status is 200
        if not response_data.get('order_id'):
             error_msg = response_data.get('message', 'Unknown Error')
             if isinstance(error_msg, dict):
                 error_msg = json.dumps(error_msg)
             return {"error": error_msg}

        # Save to Shiprocket Order DocType
        if response_data.get('order_id'):
            # Attempt to Generate AWB immediately
            shipment_id = response_data.get('shipment_id')
            if shipment_id:
                awb_url = "https://apiv2.shiprocket.in/v1/external/courier/assign/awb"
                awb_payload = {"shipment_id": shipment_id}
                try:
                    awb_response = requests.post(awb_url, json=awb_payload, headers=headers)
                    awb_data = awb_response.json()
                    
                    if awb_data.get("awb_assign_status") == 1:
                         awb_resp_data = awb_data.get("response", {}).get("data", {})
                         # Update response_data with AWB details so frontend sees it
                         response_data["awb_code"] = awb_resp_data.get("awb_code")
                         response_data["courier_name"] = awb_resp_data.get("courier_name")
                         response_data["courier_company_id"] = awb_resp_data.get("courier_company_id")
                         response_data["shipment_id"] = awb_resp_data.get("shipment_id") or shipment_id
                except Exception as e:
                    frappe.log_error(f"Failed to auto-generate AWB: {str(e)}", "Shiprocket AWB Error")

            try:
                doc = frappe.get_doc({
                    "doctype": "Shiprocket Order",
                    "order_id": str(response_data.get('order_id')),
                    "shipment_id": str(response_data.get('shipment_id')),
                    "status": response_data.get('status', 'Created'),
                    "courier_name": response_data.get('courier_name'),
                    "awb_code": response_data.get('awb_code'),
                    "pickup_location": order_details.get('pickup_location'),
                    "customer_name": order_details.get('billing_customer_name'),
                    "customer_email": order_details.get('billing_email'),
                    "customer_phone": order_details.get('billing_phone'),
                    "full_payload": json.dumps(order_details, indent=2),
                    "api_response": json.dumps(response_data, indent=2)
                })
                doc.insert(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Failed to save Shiprocket Order: {str(e)}")

        return response_data
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

@frappe.whitelist()
def cancel_order(order_id):
    token = get_token()
    if not token:
        return {"error": "Authentication failed"}

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # 1. Fetch order details to check for AWB/Shipment
    try:
        show_url = f"https://apiv2.shiprocket.in/v1/external/orders/show/{order_id}"
        show_res = requests.get(show_url, headers=headers)
        order_data = show_res.json().get("data", {})
        
        # Check if AWB exists in shipments
        awb_number = None
        if order_data.get("shipments"):
            awb_number = order_data["shipments"][0].get("awb")
        
        # 2. If AWB exists, cancel AWB first
        if awb_number:
            cancel_awb_url = "https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awb"
            requests.post(cancel_awb_url, headers=headers, json={"awbs": [awb_number]})
            
    except Exception as e:
        frappe.log_error(f"Pre-cancel fetch error: {str(e)}")

    # 3. Cancel the actual order
    url = "https://apiv2.shiprocket.in/v1/external/orders/cancel"
    payload = {"ids": [order_id]}

    try:
        res = requests.post(url, headers=headers, json=payload)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        frappe.log_error(f"Shiprocket Cancel Error: {str(e)}")
        try:
            return {"error": res.json().get('message', str(e))}
        except:
            return {"error": str(e)}
