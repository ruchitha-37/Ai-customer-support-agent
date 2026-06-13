import os
from langchain_core.tools import tool
from database import get_order_by_id, get_order_by_name

# Active logger for capturing reasoning steps in real-time
_current_logs = []

def clear_logs():
    global _current_logs
    _current_logs = []

def add_log(step_name: str, detail: str):
    global _current_logs
    log_entry = {"step": step_name, "detail": detail}
    _current_logs.append(log_entry)
    print(f"[{step_name}] {detail}")

def get_logs():
    return _current_logs

@tool
def get_order_details(query: str) -> str:
    """
    Search the CRM database for order details.
    You can query by customer ID (e.g., 'C001', 'C005') or customer name (e.g., 'John', 'David').
    Returns order details including customer ID, name, order date, product name, product type, amount, damage status, and customization status.
    """
    query = query.strip()
    add_log("Tool Call: get_order_details", f"Searching database for query: '{query}'")
    
    # Try ID first
    order = get_order_by_id(query)
    if not order:
        # Try Name
        order = get_order_by_name(query)
        
    if order:
        damage_str = "Yes (Damaged)" if order['is_damaged'] else "No (Perfect Condition)"
        custom_str = "Yes" if order['custom_made'] else "No"
        result_str = (
            f"Customer ID: {order['customer_id']}\n"
            f"Customer Name: {order['name']}\n"
            f"Order Date: {order['order_date']}\n"
            f"Product Name: {order['product_name']}\n"
            f"Product Type: {order['product_type']}\n"
            f"Amount: ${order['amount']:.2f}\n"
            f"Is Damaged: {damage_str}\n"
            f"Is Custom Made: {custom_str}"
        )
        add_log("Tool Result: get_order_details", f"Found record for {order['name']} (ID: {order['customer_id']})")
        return result_str
    else:
        add_log("Tool Result: get_order_details", f"No record found for query: '{query}'")
        return f"No order found for query: '{query}'. Please verify the Customer ID or Name."

@tool
def read_refund_policy() -> str:
    """
    Read the official company refund policy. 
    Use this to verify the specific conditions under which a refund is allowed.
    """
    add_log("Tool Call: read_refund_policy", "Reading the refund policy document...")
    policy_path = os.path.join(os.path.dirname(__file__), "policy.txt")
    try:
        with open(policy_path, "r") as f:
            content = f.read()
        add_log("Tool Result: read_refund_policy", "Refund policy successfully retrieved.")
        return content
    except Exception as e:
        error_msg = f"Error reading policy: {str(e)}"
        add_log("Tool Result: read_refund_policy", error_msg)
        return error_msg

@tool
def get_current_date() -> str:
    """
    Get the current system date.
    Use this date as the reference point when calculating the days elapsed since the customer's purchase.
    """
    current_date = "2026-06-13" # Setting reference date corresponding to local time metadata
    add_log("Tool Call: get_current_date", f"Checking current date. Reference Date: {current_date}")
    return current_date
