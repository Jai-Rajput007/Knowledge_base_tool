#!/bin/bash
# test_auth_pipeline.sh

TENANT_ID="11111111-1111-1111-1111-111111111111"
USER_EMAIL="tony@stark.com"
FIRST_PASSWORD="changeme123"
NEW_PASSWORD="IronMan!2026"

echo "=== 1. Super Admin creates user and pushes downstream ==="
curl -s -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "'$TENANT_ID'",
    "email": "'$USER_EMAIL'",
    "name": "Tony Stark",
    "password": "'$FIRST_PASSWORD'"
  }'

echo -e "\nWaiting 3 seconds for MQTT to sync downstream to Client DB..."
sleep 3

echo "=== 2. Client logs in with First Password ==="
# We extract the cookie header using grep/awk if needed, but for simplicity we will just show the login response.
LOGIN_RES=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$USER_EMAIL'",
    "password": "'$FIRST_PASSWORD'"
  }')

echo "$LOGIN_RES"

# Extract g1_session cookie
SESSION_COOKIE=$(echo "$LOGIN_RES" | grep -i "Set-Cookie:" | awk -F'g1_session=' '{print $2}' | awk -F';' '{print $1}')

if [ -z "$SESSION_COOKIE" ]; then
  echo "Failed to get session cookie. Aborting."
  exit 1
fi

echo -e "\n=== 3. Client changes password (Upstream Sync) ==="
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: g1_session=$SESSION_COOKIE" \
  -d '{
    "oldPassword": "'$FIRST_PASSWORD'",
    "newPassword": "'$NEW_PASSWORD'"
  }'

echo -e "\nWaiting 3 seconds for MQTT to sync upstream to Super Admin DB..."
sleep 3

echo -e "\n=== 4. Test Complete! ==="
echo "Check your Super Admin and Client Database. The user's password hash should be updated and requiresPasswordChange should be false!"
