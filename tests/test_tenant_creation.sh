#!/bin/bash
# test_tenant_creation.sh

EMAIL="stark@starkindustries.com"

echo "=== 1. Creating First Tenant (Should Succeed) ==="
RES1=$(curl -s -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stark Industries",
    "host": "Tony Stark",
    "email": "'$EMAIL'"
  }')
echo $RES1

echo -e "\n=== 2. Creating Second Tenant with Same Email (Should Fail) ==="
RES2=$(curl -s -i -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stark Industries Backup",
    "host": "Tony Stark clone",
    "email": "'$EMAIL'"
  }')
echo "$RES2"

echo -e "\n=== Test Complete ==="
echo "The second request should have returned a 400 Bad Request with an error message about the email already existing."
