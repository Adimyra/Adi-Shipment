import frappe
import requests
import json
from concurrent.futures import ThreadPoolExecutor
from adi_shipment.api.shiprocket import get_token

SLABS = [
    {"key": "slab_05", "label": "500 Gms", "weight": 0.5, "length": 12, "width": 19, "height": 9},
    {"key": "slab_1",  "label": "1 Kg",    "weight": 1.0, "length": 24, "width": 19, "height": 9},
    {"key": "slab_2",  "label": "2 Kg",    "weight": 2.0, "length": 24, "width": 19, "height": 19},
    {"key": "slab_5",  "label": "5 Kg",    "weight": 5.0, "length": 39, "width": 24, "height": 24},
]

@frappe.whitelist()
def is_so_shipping_rate_enabled():
    """
    Checks if Check Shipping Rate on Sales Order feature is enabled in Shiprocket Settings.
    """
    try:
        if frappe.db.exists("DocType", "Shiprocket Settings"):
            ss = frappe.get_single("Shiprocket Settings")
            return bool(ss.get("enable_sales_order_shipping_rate", 1))
        return True
    except Exception:
        return True

@frappe.whitelist()
def get_sales_order_shipping_rates(delivery_pincode, is_cod=0, custom_weight=0, custom_length=0, custom_width=0, custom_height=0):

    """
    Fetches Shiprocket courier rates for standard weight slabs (0.5kg, 1kg, 2kg, 5kg)
    plus optional custom weight & dimensions for a given delivery pincode.
    Uses Shiprocket Settings token from adi_shipment app.
    """
    pincode_str = str(delivery_pincode or "").strip()
    if not pincode_str or len(pincode_str) != 6 or not pincode_str.isdigit():
        return {"success": False, "message": "Valid 6-digit Delivery Pincode is required"}

    pickup_pincode = get_pickup_pincode()
    if not pickup_pincode:
        return {"success": False, "message": "Pickup Pincode not configured in Company Address or Catalog Settings"}

    # Get fresh authenticated token from adi_shipment API
    try:
        token = get_token()
    except Exception as e:
        frappe.log_error(f"Shiprocket Auth Error: {str(e)}")
        return {"success": False, "message": f"Shiprocket Authentication Failed: {str(e)}"}

    if not token:
        return {"success": False, "message": "Shiprocket Token missing. Please check Shiprocket Settings."}

    # Prepare query slabs
    query_slabs = [dict(s) for s in SLABS]
    c_wt = float(custom_weight or 0)
    if c_wt > 0:
        c_l = float(custom_length or 0) or 10
        c_w = float(custom_width or 0) or 10
        c_h = float(custom_height or 0) or 10
        query_slabs.append({
            "key": "custom",
            "label": f"Custom ({c_wt} Kg)",
            "weight": c_wt,
            "length": c_l,
            "width": c_w,
            "height": c_h,
            "is_custom": True
        })

    url = "https://apiv2.shiprocket.in/v1/external/courier/serviceability/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    def fetch_slab_rate(slab):
        params = {
            "pickup_postcode": pickup_pincode,
            "delivery_postcode": pincode_str,
            "weight": slab["weight"],
            "cod": 1 if int(is_cod) else 0,
            "length": slab["length"],
            "width": slab["width"],
            "height": slab["height"]
        }
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=10)
            data = resp.json()
            if data.get("status") == 200:
                couriers = data.get("data", {}).get("available_courier_companies", [])
                return {"slab": slab, "couriers": couriers, "error": None}
            else:
                msg = data.get("message") or "Not serviceable"
                return {"slab": slab, "couriers": [], "error": msg}
        except Exception as err:
            return {"slab": slab, "couriers": [], "error": str(err)}

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_slab_rate, query_slabs))

    # Aggregate rates by courier across slabs
    courier_map = {}
    detected_zone = "N/A"

    for res in results:
        slab = res["slab"]
        slab_key = slab["key"]
        for c in res["couriers"]:
            c_id = c.get("courier_company_id")
            c_name = c.get("courier_name") or f"Courier #{c_id}"
            rate = float(c.get("rate") or c.get("freight_charge") or 0)
            etd = c.get("etd") or (f"{c.get('estimated_delivery_days')} days" if c.get('estimated_delivery_days') else "N/A")
            c_zone = c.get("zone") or "N/A"
            is_surface = bool(c.get("is_surface"))

            if c_zone != "N/A":
                detected_zone = c_zone

            if c_id not in courier_map:
                courier_map[c_id] = {
                    "courier_id": c_id,
                    "courier_name": c_name,
                    "mode": "Surface" if is_surface else "Air",
                    "etd": etd,
                    "zone": c_zone,
                    "rating": c.get("rating") or 0,
                    "rates": {}
                }
            courier_map[c_id]["rates"][slab_key] = rate

    courier_list = list(courier_map.values())

    # Sort couriers by 1 Kg rate asc (or first available rate)
    def get_sort_key(item):
        r = item["rates"]
        for k in ["slab_1", "slab_05", "slab_2", "slab_5", "custom"]:
            if k in r:
                return r[k]
        return 999999

    courier_list.sort(key=get_sort_key)

    # Format Zone display name
    zone_display = detected_zone
    if detected_zone.lower().endswith("_e") or detected_zone == "E":
        zone_display = "Zone E (North East / J&K / Remote Region)"
    elif detected_zone.lower().endswith("_d") or detected_zone == "D":
        zone_display = "Zone D (Rest of India)"
    elif detected_zone.lower().endswith("_c") or detected_zone == "C":
        zone_display = "Zone C (Metro to Metro)"
    elif detected_zone.lower().endswith("_b") or detected_zone == "B":
        zone_display = "Zone B (Intra-State)"
    elif detected_zone.lower().endswith("_a") or detected_zone == "A":
        zone_display = "Zone A (Intra-City)"

    return {
        "success": True,
        "pickup_pincode": pickup_pincode,
        "delivery_pincode": pincode_str,
        "is_cod": bool(int(is_cod)),
        "zone": zone_display,
        "slabs": query_slabs,
        "couriers": courier_list
    }


@frappe.whitelist()
def get_so_pincode(sales_order_name):
    """
    Extracts the shipping pincode for a given Sales Order.
    Checks:
    1. Shipping Address pincode
    2. Customer Address pincode
    """
    so = frappe.get_doc("Sales Order", sales_order_name)
    pincode = None

    if so.shipping_address_name:
        pincode = frappe.db.get_value("Address", so.shipping_address_name, "pincode")

    if not pincode and so.customer_address:
        pincode = frappe.db.get_value("Address", so.customer_address, "pincode")

    return {
        "sales_order": sales_order_name,
        "customer": so.customer,
        "pincode": pincode or ""
    }


def get_pickup_pincode():
    """
    Fetch the pickup pincode.
    Priority 1: 'pickup_pin_code' from Catalog Settings.
    Priority 2: Default Company Address pincode.
    """
    try:
        if frappe.db.exists("DocType", "Catalog Settings"):
            cs = frappe.get_single("Catalog Settings")
            if cs.pickup_pin_code and len(str(cs.pickup_pin_code)) == 6:
                return str(cs.pickup_pin_code)

        company = frappe.defaults.get_user_default("Company")
        if not company:
            companies = frappe.get_all("Company", limit=1)
            if companies:
                company = companies[0].name

        if not company:
            return None

        address = frappe.db.sql("""
            SELECT a.pincode 
            FROM `tabAddress` a
            JOIN `tabDynamic Link` dl ON dl.parent = a.name
            WHERE dl.link_doctype = 'Company' 
            AND dl.link_name = %s
            AND a.is_your_company_address = 1
            LIMIT 1
        """, (company,), as_dict=True)

        if address and address[0].pincode:
            return address[0].pincode

        return None
    except Exception:
        return None
