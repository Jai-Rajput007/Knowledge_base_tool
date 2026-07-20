import httpx
import sys

def test_telemetry_endpoint():
    url = "http://127.0.0.1:8000/api/v1/health/telemetry"
    print(f"Testing telemetry endpoint at {url}...")
    
    try:
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        data = response.json()
        
        # Verify structure
        assert "g1_chassis" in data, "Missing g1_chassis data"
        assert "agx_orin" in data, "Missing agx_orin data"
        
        print("\n✅ Endpoint reached successfully!")
        print("-" * 40)
        print("G1 Chassis Data:")
        for k, v in data["g1_chassis"].items():
            print(f"  {k}: {v}")
            
        print("\nAGX Orin Data:")
        for k, v in data["agx_orin"].items():
            print(f"  {k}: {v}")
        print("-" * 40)
        print("✅ All tests passed. The frontend can now safely consume this telemetry.")
        
    except httpx.ConnectError:
        print("❌ ERROR: Connection failed. Is the backend running on port 8000?")
        sys.exit(1)
    except httpx.HTTPStatusError as e:
        print(f"❌ ERROR: HTTP error {e.response.status_code}")
        sys.exit(1)
    except AssertionError as e:
        print(f"❌ ERROR: Data structure mismatch: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_telemetry_endpoint()
