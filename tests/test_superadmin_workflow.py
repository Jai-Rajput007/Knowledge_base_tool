import requests
import time
import psycopg2
import sys

SUPERADMIN_URL = "http://localhost:3001/api/tenants"
SA_DB_URL = "postgresql://super_admin:superadmin_password123@localhost:5434/g1_superadmin"
CLIENT_DB_URL = "postgresql://g1_admin:g1_password123@localhost:5433/g1_universe"

def test_workflow():
    print("🚀 Starting End-to-End Tenant Creation and Deletion Test...")

    # 1. Create a tenant
    payload = {
        "name": "Integration Test Tenant",
        "email": "integration@example.com",
        "host": "Integration Tester"
    }
    print(f"\n[1] Creating tenant via Super Admin API... Payload: {payload}")
    response = requests.post(SUPERADMIN_URL, json=payload)
    if response.status_code != 200:
        print(f"❌ Failed to create tenant: {response.text}")
        sys.exit(1)
    
    data = response.json()
    tenant_id = data["tenant"]["id"]
    print(f"✅ Successfully created tenant. ID: {tenant_id}")

    # 2. Wait for MQTT propagation
    print("\n[2] Waiting 3 seconds for MQTT message to sync downstream...")
    time.sleep(3)

    # 3. Verify in Super Admin DB
    print("\n[3] Verifying tenant in Super Admin Database...")
    sa_conn = psycopg2.connect(SA_DB_URL)
    sa_cur = sa_conn.cursor()
    sa_cur.execute('SELECT id, name FROM "Tenant" WHERE id = %s', (tenant_id,))
    sa_tenant = sa_cur.fetchone()
    if not sa_tenant:
        print("❌ Tenant missing from Super Admin DB!")
        sys.exit(1)
    print(f"✅ Found tenant in Super Admin DB: {sa_tenant}")
    sa_cur.close()
    sa_conn.close()

    # 4. Verify in Client Dashboard DB
    print("\n[4] Verifying tenant and user in Client Dashboard Database...")
    client_conn = psycopg2.connect(CLIENT_DB_URL)
    client_cur = client_conn.cursor()
    
    client_cur.execute('SELECT id, name FROM "Tenant" WHERE id = %s', (tenant_id,))
    client_tenant = client_cur.fetchone()
    if not client_tenant:
        print("❌ Tenant missing from Client DB! MQTT sync failed.")
        sys.exit(1)
    print(f"✅ Found tenant in Client DB: {client_tenant}")

    client_cur.execute('SELECT email, role FROM users WHERE tenant_id = %s', (tenant_id,))
    client_user = client_cur.fetchone()
    if not client_user:
        print("❌ User missing from Client DB! MQTT user sync failed.")
        sys.exit(1)
    print(f"✅ Found synced user in Client DB: {client_user}")

    # 5. Delete the tenant
    print(f"\n[5] Deleting tenant {tenant_id} via Super Admin API...")
    del_res = requests.delete(f"{SUPERADMIN_URL}/{tenant_id}")
    if del_res.status_code != 200:
        print(f"❌ Failed to delete tenant: {del_res.text}")
        sys.exit(1)
    print("✅ Successfully sent DELETE request.")

    # 6. Wait for MQTT propagation
    print("\n[6] Waiting 3 seconds for MQTT deletion message to sync downstream...")
    time.sleep(3)

    # 7. Verify deletion in Client Dashboard DB
    print("\n[7] Verifying deletion in Client Dashboard Database...")
    client_cur.execute('SELECT id FROM "Tenant" WHERE id = %s', (tenant_id,))
    if client_cur.fetchone():
        print("❌ Tenant STILL EXISTS in Client DB after delete!")
        sys.exit(1)
    else:
        print("✅ Tenant successfully deleted from Client DB.")

    client_cur.execute('SELECT email FROM users WHERE tenant_id = %s', (tenant_id,))
    if client_cur.fetchone():
        print("❌ User STILL EXISTS in Client DB after delete!")
        sys.exit(1)
    else:
        print("✅ User successfully deleted from Client DB.")
    
    client_cur.close()
    client_conn.close()

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The architecture is sound.")

if __name__ == "__main__":
    test_workflow()
