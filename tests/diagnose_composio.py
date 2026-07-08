"""
Full diagnostic test for the Composio GitHub integration pipeline.
Checks the complete flow: auth config → connected account → tool list → execution
"""
import sys
import os
import json

COMPOSIO_API_KEY = "ak_HlT2qEnTnTXF1OGcHMEG"

# ── The user ID the mcp-credentials endpoint is sending to the backend ──────
# (from the curl output above)
CREDENTIALS_USER_ID = "f8906e2a-92e1-439e-9a48-7e0c39edc622"

# ── The user ID that actually authorized GitHub (from the backend warning log)
AUTHORIZED_USER_ID  = "f33cdc1a-4b20-4212-a47d-09c7fec4b169"

from composio import Composio

client = Composio(api_key=COMPOSIO_API_KEY)

print("=" * 65)
print("STEP 1 — Auth Configs in this project")
print("=" * 65)
res = client.auth_configs.list()
for item in res.items:
    print(f"  id={item.id}  app={item.toolkit.slug}  status={item.status}")

print()
print("=" * 65)
print("STEP 2 — All connected accounts in this project")
print("=" * 65)
all_accounts = client.connected_accounts.list()
accounts_data = getattr(all_accounts, 'items', all_accounts)
if not accounts_data:
    print("  ⚠  NO connected accounts found at all!")
else:
    for acct in accounts_data:
        print(f"  id={acct.id}  user={acct.user_id}  app={getattr(acct, 'app_name', getattr(acct, 'toolkit', {}))}  status={acct.status}")

print()
print("=" * 65)
print(f"STEP 3 — Tools for credentials_user_id  ({CREDENTIALS_USER_ID})")
print("         (this is the user the chat backend is using)")
print("=" * 65)
try:
    tools = client.tools.get(user_id=CREDENTIALS_USER_ID, toolkits=["github"], limit=10)
    print(f"  Tools returned: {len(tools)}")
    for t in tools[:3]:
        name = t.get("function", {}).get("name") if isinstance(t, dict) else getattr(t, "name", "?")
        print(f"    • {name}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 65)
print(f"STEP 4 — Tools for authorized_user_id  ({AUTHORIZED_USER_ID})")
print("         (this is the user who actually clicked Authorize in the UI)")
print("=" * 65)
try:
    tools2 = client.tools.get(user_id=AUTHORIZED_USER_ID, toolkits=["github"], limit=10)
    print(f"  Tools returned: {len(tools2)}")
    for t in tools2[:3]:
        name = t.get("function", {}).get("name") if isinstance(t, dict) else getattr(t, "name", "?")
        print(f"    • {name}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 65)
print("STEP 5 — What does tools.get() return if we pass NO user_id?")
print("=" * 65)
try:
    tools3 = client.tools.get(toolkits=["github"], limit=5)
    print(f"  Tools returned: {len(tools3)}")
    for t in tools3[:3]:
        name = t.get("function", {}).get("name") if isinstance(t, dict) else getattr(t, "name", "?")
        print(f"    • {name}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 65)
print("STEP 6 — help(client.tools.get) to see all parameters")
print("=" * 65)
import inspect
sig = inspect.signature(client.tools.get)
print(f"  Signature: {sig}")
