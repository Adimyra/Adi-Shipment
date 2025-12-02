import frappe
import json
import requests
from adi_shipment.api.shiprocket import get_token

def execute():
    token = get_token()
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    print("Fetching Pickup Locations...")
    try:
        url = "https://apiv2.shiprocket.in/v1/external/settings/company/pickup"
        res = requests.get(url, headers=headers)
        print("Pickup Locations:", json.dumps(res.json(), indent=2))
    except Exception as e:
        print("Error fetching pickup locations:", str(e))
