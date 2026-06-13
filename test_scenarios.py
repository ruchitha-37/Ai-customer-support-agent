import urllib.request
import json

BASE = 'http://127.0.0.1:8000'

cases = [
    ("C005 - Approved (David, Leather Jacket, 10 days)",      "Refund order C005",                     "Approved"),
    ("C010 - Denied: Age (Isabella, Handbag, 45 days)",        "Can I get a refund for order C010?",    "Denied"),
    ("C007 - Denied: Damaged (James, Earbuds)",                "I want to refund order C007",           "Denied"),
    ("C003 - Denied: Digital (Mike, AI Photo Editor)",         "Refund order C003 please",              "Denied"),
    ("C006 - Manager Approval (Sophia, Tablet, $799)",         "Is order C006 eligible for a refund?",  "Requires Manager Approval"),
]

all_pass = True

print("=" * 72)
print("  AI REFUND AGENT - FULL SCENARIO VALIDATION")
print("  Assignment Data Compliance Check")
print("=" * 72)
print()

for label, query, expected_status in cases:
    body = json.dumps({"message": query}).encode()
    req = urllib.request.Request(
        BASE + "/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        d = data.get("decision", {})
        logs = data.get("logs", [])
        actual_status = d.get("status", "UNKNOWN")
        passed = (actual_status == expected_status)
        if not passed:
            all_pass = False

        status_icon = "PASS" if passed else "FAIL"
        print(f"[{status_icon}] {label}")
        print(f"        Customer    : {d.get('customer_name','?')} ({d.get('customer_id','?')})")
        print(f"        Product     : {d.get('product_name','?')}")
        print(f"        Amount      : ${d.get('amount', 0):.2f}")
        print(f"        Order Date  : {d.get('order_date','?')}")
        print(f"        Days Elapsed: {d.get('days_elapsed', 0)} days")
        print(f"        Expected    : {expected_status}")
        print(f"        Got         : {actual_status}")
        reason = d.get("reason", "")
        print(f"        Reason      : {reason[:120]}")
        print()
        print("        --- Agent Reasoning Logs ---")
        for i, log in enumerate(logs, 1):
            step = log.get("step", "")
            detail = log.get("detail", "")[:85]
            print(f"        Step {i:02d}: [{step}] {detail}")
        print()
        print("-" * 72)
        print()

    except Exception as e:
        all_pass = False
        print(f"[FAIL] {label} - ERROR: {e}")
        print()

print("=" * 72)
if all_pass:
    print("  RESULT: ALL 5 SCENARIOS PASSED ✅  - Agent complies with assignment data")
else:
    print("  RESULT: SOME TESTS FAILED ❌  - Check agent logic above")
print("=" * 72)
