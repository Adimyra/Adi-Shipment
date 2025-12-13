import frappe
import requests
import json
from adi_shipment.api.shiprocket import get_token

SHIPROCKET_URL = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"

@frappe.whitelist()
def get_freight_price_from_dimension(freight_details_str):
    freight_details = json.loads(freight_details_str)
    
    # Ensure token is fresh
    try:
        token = get_token()
    except Exception as e:
        frappe.log_error(f"Token Error: {str(e)}")
        return {"error": "Failed to authenticate with Shiprocket. Check settings."}

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    # Ensure numeric values are correct types for API if needed, 
    # though requests params usually handle strings/floats fine.
    # We just pass the dictionary as params.
    
    try:
        res = requests.get(SHIPROCKET_URL, headers=headers, params=freight_details)
        data = res.json()
        
        if res.status_code != 200:
             # Return error message from provider if available
             return {"error": data.get("message", "Unknown Error from Shiprocket")}
             
        return data
        
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket API Error: {str(e)}")
        return {"error": "Failed to connect to Shiprocket API"}

