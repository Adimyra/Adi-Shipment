app_name = "adi_shipment"
app_title = "Adi Shipment"
app_publisher = "Adimyra Systems Pvt Ltd"
app_description = "Shiprocket"
app_email = "admin@adimyra.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "adi_shipment",
# 		"logo": "/assets/adi_shipment/logo.png",
# 		"title": "Adi Shipment",
# 		"route": "/adi_shipment",
# 		"has_permission": "adi_shipment.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/adi_shipment/css/adi_shipment.css"
# app_include_js = "/assets/adi_shipment/js/adi_shipment.js"

# include js, css files in header of web template
# web_include_css = "/assets/adi_shipment/css/adi_shipment.css"
# web_include_js = "/assets/adi_shipment/js/adi_shipment.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "adi_shipment/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {"Delivery Note": "public/js/delivery_note.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "adi_shipment/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "adi_shipment.utils.jinja_methods",
# 	"filters": "adi_shipment.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "adi_shipment.install.before_install"
after_install = "adi_shipment.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "adi_shipment.uninstall.before_uninstall"
# after_uninstall = "adi_shipment.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "adi_shipment.utils.before_app_install"
# after_app_install = "adi_shipment.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "adi_shipment.utils.before_app_uninstall"
# after_app_uninstall = "adi_shipment.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "adi_shipment.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Delivery Note": {
		"on_submit": "adi_shipment.api.shiprocket.create_shipment_after_submit"
	}
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"adi_shipment.tasks.all"
# 	],
# 	"daily": [
# 		"adi_shipment.tasks.daily"
# 	],
# 	"hourly": [
# 		"adi_shipment.tasks.hourly"
# 	],
# 	"weekly": [
# 		"adi_shipment.tasks.weekly"
# 	],
# 	"monthly": [
# 		"adi_shipment.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "adi_shipment.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "adi_shipment.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "adi_shipment.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["adi_shipment.utils.before_request"]
# after_request = ["adi_shipment.utils.after_request"]

# Job Events
# ----------
# before_job = ["adi_shipment.utils.before_job"]
# after_job = ["adi_shipment.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"adi_shipment.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

