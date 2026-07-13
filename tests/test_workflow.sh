#!/bin/bash
set -e

SUPERADMIN_URL="http://localhost:3001/api/tenants"
SA_DB="postgresql://super_admin:superadmin_password123@localhost:5434/g1_superadmin"
CLIENT_DB="postgresql://g1_admin:g1_password123@localhost:5433/g1_universe"

echo "🚀 Starting End-to-End Tenant Creation and Deletion Test..."

# 1. Create a tenant
echo -e "\n[1] Creating tenant via Super Admin API..."
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"name": "Bash Test Tenant", "email": "bash@example.com", "host": "Bash Tester"}' \
  $SUPERADMIN_URL)

TENANT_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo "❌ Failed to create tenant: $RESPONSE"
  exit 1
fi
echo "✅ Successfully created tenant. ID: $TENANT_ID"

# 2. Wait for MQTT propagation
echo -e "\n[2] Waiting 4 seconds for MQTT message to sync downstream..."
sleep 4

# 3. Verify in Super Admin DB
echo -e "\n[3] Verifying tenant in Super Admin Database..."
SA_RES=$(psql $SA_DB -t -c "SELECT name FROM \"Tenant\" WHERE id = '$TENANT_ID';" | xargs)
if [ "$SA_RES" != "Bash Test Tenant" ]; then
  echo "❌ Tenant missing from Super Admin DB!"
  exit 1
fi
echo "✅ Found tenant in Super Admin DB"

# 4. Verify in Client Dashboard DB
echo -e "\n[4] Verifying tenant and user in Client Dashboard Database..."
CLIENT_TENANT=$(psql $CLIENT_DB -t -c "SELECT name FROM \"Tenant\" WHERE id = '$TENANT_ID';" | xargs)
if [ "$CLIENT_TENANT" != "Bash Test Tenant" ]; then
  echo "❌ Tenant missing from Client DB! MQTT sync failed."
  exit 1
fi
echo "✅ Found tenant in Client DB"

CLIENT_USER=$(psql $CLIENT_DB -t -c "SELECT role FROM users WHERE tenant_id = '$TENANT_ID';" | xargs)
if [ "$CLIENT_USER" != "admin" ]; then
  echo "❌ User missing from Client DB or incorrect role! MQTT user sync failed."
  exit 1
fi
echo "✅ Found synced admin user in Client DB"

# 5. Delete the tenant
echo -e "\n[5] Deleting tenant $TENANT_ID via Super Admin API..."
DEL_RES=$(curl -s -X DELETE $SUPERADMIN_URL/$TENANT_ID)
echo "✅ Successfully sent DELETE request. Response: $DEL_RES"

# 6. Wait for MQTT propagation
echo -e "\n[6] Waiting 4 seconds for MQTT deletion message to sync downstream..."
sleep 4

# 7. Verify deletion in Client Dashboard DB
echo -e "\n[7] Verifying deletion in Client Dashboard Database..."
DEL_CLIENT_TENANT=$(psql $CLIENT_DB -t -c "SELECT name FROM \"Tenant\" WHERE id = '$TENANT_ID';" | xargs)
if [ -n "$DEL_CLIENT_TENANT" ]; then
  echo "❌ Tenant STILL EXISTS in Client DB after delete!"
  exit 1
fi
echo "✅ Tenant successfully deleted from Client DB."

DEL_CLIENT_USER=$(psql $CLIENT_DB -t -c "SELECT email FROM users WHERE tenant_id = '$TENANT_ID';" | xargs)
if [ -n "$DEL_CLIENT_USER" ]; then
  echo "❌ User STILL EXISTS in Client DB after delete!"
  exit 1
fi
echo "✅ User successfully deleted from Client DB."

echo -e "\n🎉 ALL TESTS PASSED SUCCESSFULLY! The architecture is sound."
