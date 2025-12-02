# Adi Shipment

Adi Shipment is a Frappe App for seamless integration with Shiprocket.

## Features

- **Shiprocket Settings**: Manage your API credentials and auto-generate tokens.
- **Delivery Note Integration**: Automatically create Shiprocket orders directly from Delivery Notes.
- **Auto-Fetch Details**: Fetches customer address, phone, and email automatically.
- **Shiprocket Dashboard**: View live order stats and recent shipments directly within Frappe.
- **AWB Generation**: Automatically generates and saves AWB numbers and Shipment IDs.

## Installation

```bash
bench get-app https://github.com/Adimyra/Adi-Shipment.git
bench --site [your-site-name] install-app adi_shipment
bench --site [your-site-name] migrate
```

## Setup

1.  Go to **Adi Shipment** Workspace.
2.  Open **Shiprocket Settings**.
3.  Enter your **Shiprocket API User Email** and **Password**.
    *   *Note: Create a dedicated API User in Shiprocket Settings -> API -> Create API User.*
4.  Click **Generate Token**.

## Usage

1.  Create a **Delivery Note**.
2.  Ensure the Customer has a valid Address and Phone Number.
3.  Click **Create Shiprocket Shipment** button (or Submit the document if auto-create is enabled).
4.  The system will create the order in Shiprocket and save the **Order ID**, **Shipment ID**, and **AWB** in the Delivery Note.

## License

MIT