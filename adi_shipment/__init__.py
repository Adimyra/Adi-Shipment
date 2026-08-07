__version__ = "0.0.1"

# Monkeypatch Shipment doctype class to disable auto-calculation of value_of_goods in backend
try:
    from erpnext.stock.doctype.shipment.shipment import Shipment
    Shipment.set_value_of_goods = lambda self: None
except ImportError:
    pass
