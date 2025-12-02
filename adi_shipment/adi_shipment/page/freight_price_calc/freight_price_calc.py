import frappe
import requests 
import json

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjYwMTYyNzksInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzQzNzc1MDAzLCJqdGkiOiJwSjBCZndzalJreWZNV0dKIiwiaWF0IjoxNzQyOTExMDAzLCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc0MjkxMTAwMywiY2lkIjo1ODAyNjU3LCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6IiJ9.v6YNSg7MFjEjNE9FQw7Myq64fH7j5hNVF3rQ0cde1Cw"
SHIPROCKET_URL = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"

@frappe.whitelist()
def get_freight_price_from_dimension(freight_details_str):

    freight_details = json.loads(freight_details_str)
    print(freight_details)

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    try:
        res = requests.get(SHIPROCKET_URL, headers=headers, params=freight_details) 
        res.raise_for_status() 
        return res.json()  
    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Shiprocket API Error: {str(e)}")
        return {"error": "Failed to fetch shipment cost"}

