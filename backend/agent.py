import os
import json
from datetime import datetime
from typing import TypedDict, Annotated, Sequence, Dict, Any, List
from dotenv import load_dotenv

# LangChain / LangGraph imports
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Local imports
from tools import get_order_details, read_refund_policy, get_current_date, add_log, clear_logs, get_logs
from database import get_order_by_id, get_order_by_name

load_dotenv()

# Define the State for the LangGraph
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    decision: Dict[str, Any]  # Stores final structured decision

# SYSTEM PROMPT
SYSTEM_PROMPT = """You are a strict, automated AI Refund Agent for an e-commerce company.
Your goal is to evaluate refund requests and make an absolute decision (Approved, Denied, or Requires Manager Approval).
You must follow the company's Refund Policy strictly without exception ("hold the line").

Process:
1. First, search for the customer's order in the CRM using the 'get_order_details' tool. 
   - You can search using the Customer ID (e.g., C001) or their Name.
   - If no customer/order is found, explain that you could not find the order and stop.
2. Second, read the company's refund policy using the 'read_refund_policy' tool.
3. Third, check the current date using the 'get_current_date' tool to calculate the days elapsed since the purchase.
4. Calculate the days elapsed: (Current Date - Purchase Date).
5. Apply the refund policy rules strictly:
   - Within 30 days: Eligible (if other conditions met).
   - Over 30 days: DENY.
   - Product is damaged (is_damaged = Yes): DENY.
   - Product type is digital: DENY.
   - Product type is custom-made: DENY.
   - Refund amount exceeds $500.00: Return "Requires Manager Approval".
6. Format your final answer. You must output your final decision as a JSON block inside markdown code tags:
```json
{
  "customer_id": "C...",
  "customer_name": "...",
  "product_name": "...",
  "order_date": "YYYY-MM-DD",
  "amount": 0.00,
  "days_elapsed": 0,
  "status": "Approved" | "Denied" | "Requires Manager Approval",
  "reason": "Clear explanation of the decision citing the specific policy rule."
}
```
Make sure you call the tools to retrieve the facts. Do not make up customer details or dates."""

# Helper to check if OpenAI is configured
def is_openai_configured() -> bool:
    api_key = os.getenv("OPENAI_API_KEY")
    return bool(api_key and not api_key.startswith("your_"))

# SIMULATOR FALLBACK (for offline/no-key usage, mimicking LangGraph & Tool calling logs)
def run_simulated_agent(user_query: str) -> Dict[str, Any]:
    add_log("Agent Init", "No OpenAI API key found. Launching simulated LangGraph Agent...")
    
    # 1. Look for a customer ID (C001 - C015) or name in the query
    import re
    id_match = re.search(r'C0[0-1][0-9]', user_query, re.IGNORECASE)
    
    customer_id = None
    customer_name = None
    
    if id_match:
        customer_id = id_match.group(0).upper()
        add_log("Agent Decision", f"Extracted customer ID {customer_id} from user query.")
    else:
        # Search for names in the text
        names = ["john", "sarah", "mike", "emma", "david", "sophia", "james", "olivia", "daniel", "isabella", "liam", "emily", "noah", "ava", "lucas"]
        for name in names:
            if name in user_query.lower():
                customer_name = name.capitalize()
                add_log("Agent Decision", f"Extracted customer name '{customer_name}' from user query.")
                break
    
    if not customer_id and not customer_name:
        add_log("Agent State", "Could not extract a customer ID or name from query.")
        # Try to call tool anyway to log search
        get_order_details.invoke({"query": user_query})
        
        decision = {
            "customer_id": "Unknown",
            "customer_name": "Unknown",
            "product_name": "Unknown",
            "order_date": "N/A",
            "amount": 0.0,
            "days_elapsed": 0,
            "status": "Denied",
            "reason": "Could not identify a valid Customer ID (e.g. C001) or customer name in your request. Please specify which order you would like to refund."
        }
        add_log("Agent Output", "Decision: Refund Denied (Reason: Customer not identified)")
        return decision

    # 2. Call CRM Tool
    query_param = customer_id if customer_id else customer_name
    crm_data_str = get_order_details.invoke({"query": query_param})
    
    # Re-fetch from DB directly for parsing details
    order = None
    if customer_id:
        order = get_order_by_id(customer_id)
    elif customer_name:
        order = get_order_by_name(customer_name)
        
    if not order:
        decision = {
            "customer_id": customer_id or "Unknown",
            "customer_name": customer_name or "Unknown",
            "product_name": "Unknown",
            "order_date": "N/A",
            "amount": 0.0,
            "days_elapsed": 0,
            "status": "Denied",
            "reason": f"Order for customer '{query_param}' could not be found in the CRM database."
        }
        add_log("Agent Output", "Decision: Refund Denied (Reason: Customer not found)")
        return decision
        
    # 3. Call Policy Tool
    policy_str = read_refund_policy.invoke({})
    
    # 4. Call Current Date Tool
    current_date_str = get_current_date.invoke({})
    curr_date = datetime.strptime(current_date_str, "%Y-%m-%d")
    order_date = datetime.strptime(order['order_date'], "%Y-%m-%d")
    days_elapsed = (curr_date - order_date).days
    
    add_log("Agent Analysis", f"Calculating purchase age: Current Date ({current_date_str}) - Order Date ({order['order_date']}) = {days_elapsed} days.")
    
    # Apply rules
    status = "Approved"
    reason = "Refund approved. The order was purchased within the 30-day window, is not damaged, is a physical product, and is under the $500 manager approval limit."
    
    # Rule 1: Refund window (30 days)
    if days_elapsed > 30:
        status = "Denied"
        reason = f"Refund denied. The item was purchased {days_elapsed} days ago, which exceeds the strict 30-day refund window policy."
        add_log("Agent Analysis", "Policy Violation: Order date exceeds the 30-day refund window.")
    
    # Rule 2: Condition check (damaged)
    elif order['is_damaged'] == 1:
        status = "Denied"
        reason = "Refund denied. The product condition is marked as damaged by the customer. According to policy, damaged items are ineligible for a refund."
        add_log("Agent Analysis", "Policy Violation: Item is marked as damaged.")
        
    # Rule 3: Digital product
    elif order['product_type'] == 'digital':
        status = "Denied"
        reason = f"Refund denied. The purchased product '{order['product_name']}' is a digital product. Digital licenses, e-books, and downloads are strictly non-refundable."
        add_log("Agent Analysis", "Policy Violation: Digital products are excluded from refunds.")
        
    # Rule 4: Custom made
    elif order['custom_made'] == 1:
        status = "Denied"
        reason = f"Refund denied. The item '{order['product_name']}' was custom-made/personalized. Custom products are non-refundable."
        add_log("Agent Analysis", "Policy Violation: Custom-made products are excluded from refunds.")
        
    # Rule 5: Amount limit ($500)
    elif order['amount'] > 500.0:
        status = "Requires Manager Approval"
        reason = f"Refund requires manager approval because the purchase amount (${order['amount']:.2f}) exceeds the auto-approval threshold of $500.00."
        add_log("Agent Analysis", "Policy Flag: Refund amount exceeds $500.00, escalating to manager.")

    decision = {
        "customer_id": order['customer_id'],
        "customer_name": order['name'],
        "product_name": order['product_name'],
        "order_date": order['order_date'],
        "amount": order['amount'],
        "days_elapsed": days_elapsed,
        "status": status,
        "reason": reason
    }
    
    add_log("Agent Output", f"Final Decision: {status}. Reason: {reason}")
    return decision

# LANGGRAPH IMPLEMENTATION
def build_langgraph_agent():
    # Define LLM and tools
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    tools = [get_order_details, read_refund_policy, get_current_date]
    llm_with_tools = llm.bind_tools(tools)
    
    # Node 1: Call the LLM
    def call_model(state: AgentState):
        messages = state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}
        
    # Node 2: Define the Tool execution node
    tool_node = ToolNode(tools)
    
    # Conditional edge to check if tool calls are needed
    def should_continue(state: AgentState):
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END
        
    # Build Graph
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)
    
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue)
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()

# Master Function to process Refund Request
def process_refund_request(user_query: str) -> Dict[str, Any]:
    clear_logs()
    add_log("Session Start", f"Received query: '{user_query}'")
    
    if not is_openai_configured():
        return run_simulated_agent(user_query)
        
    try:
        # Build and execute LangGraph agent
        graph = build_langgraph_agent()
        
        # Format conversation messages
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_query)
        ]
        
        add_log("Agent Init", "OpenAI API key detected. Running LangGraph agent graph...")
        
        # Run graph
        result = graph.invoke({"messages": messages, "decision": {}})
        
        # Extract the final AI Response
        last_message = result["messages"][-1]
        content = last_message.content
        
        # Try to parse the JSON block from the LLM content
        import re
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            try:
                decision = json.loads(json_match.group(1))
                add_log("Agent Output", f"Parsed JSON Decision: {decision['status']}.")
                return decision
            except Exception as e:
                add_log("Agent Error", f"Failed to parse decision JSON from LLM: {str(e)}")
        
        # Fallback parser if LLM didn't wrap in markdown json block
        try:
            # Maybe the whole response is json
            decision = json.loads(content)
            add_log("Agent Output", f"Parsed direct JSON Decision: {decision['status']}.")
            return decision
        except:
            pass
            
        # Text analysis fallback if JSON format failed
        add_log("Agent Warning", "LLM response was not structured JSON. Extracting parameters textually...")
        text = content.lower()
        status = "Denied"
        if "approved" in text:
            status = "Approved"
        elif "manager approval" in text or "escalat" in text:
            status = "Requires Manager Approval"
            
        decision = {
            "customer_id": "C_UNKNOWN",
            "customer_name": "Customer",
            "product_name": "E-Commerce Order",
            "order_date": "N/A",
            "amount": 0.0,
            "days_elapsed": 0,
            "status": status,
            "reason": content
        }
        add_log("Agent Output", f"Text-extracted Decision: {status}")
        return decision
        
    except Exception as e:
        add_log("Agent Error", f"LangGraph execution failed: {str(e)}. Falling back to simulator.")
        return run_simulated_agent(user_query)

if __name__ == "__main__":
    # Test cases
    print("=== TEST CASE 1: Refund C005 (David - Eligible) ===")
    res1 = process_refund_request("Refund order C005")
    print(json.dumps(res1, indent=2))
    print("\nLogs:")
    for log in get_logs():
        print(f"  {log['step']}: {log['detail']}")
        
    print("\n=== TEST CASE 2: Refund C010 (Isabella - Denied - Age) ===")
    res2 = process_refund_request("Refund order C010")
    print(json.dumps(res2, indent=2))
    print("\nLogs:")
    for log in get_logs():
        print(f"  {log['step']}: {log['detail']}")
