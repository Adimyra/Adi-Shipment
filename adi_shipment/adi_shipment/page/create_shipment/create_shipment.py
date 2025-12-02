import frappe
import requests 
import json

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwMTYyNzksInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzQzNzc1MDAzLCJqdGkiOiJwSjBCZndzalJreWZNV0dKIiwiaWF0IjoxNzQyOTExMDAzLCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc0MjkxMTAwMywiY2lkIjo1ODAyNjU3LCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6IiJ9.v6YNSg7MFjEjNE9FQw7Myq64fH7j5hNVF3rQ0cde1Cw"
SHIPROCKET_URL = "https://apiv2.shiprocket.in/v1/external/courier/courierListWithCounts"
SHIPROCKET_AWB_URL = "https://apiv2.shiprocket.in/v1/external/courier/assign/awb"


@frappe.whitelist()
def get_courier_details():

    headers = {
        'Authorization': f'Bearer {token}'
    }
    try:
        res = requests.get(SHIPROCKET_URL, headers=headers) 
        res.raise_for_status() 
        return res.json()  
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket API Error: {str(e)}")
        return {"error": f"Failed to get courier details {str(e)}"}

@frappe.whitelist()
def generate_awb(shipment_details_str):
    shipment_details = json.loads(shipment_details_str)

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    try:
        print(shipment_details)
        res = requests.post(SHIPROCKET_AWB_URL, headers=headers, json=shipment_details) 
        res.raise_for_status() 
        print(res.json())
        return res.json()  
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket API Error: {str(e)}")
        return {"error": f"Failed to generate AWB {str(e)}"}

