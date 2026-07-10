import httpx
import json
import time

def test_deploy():
    base_url = "http://localhost:8000/api/v1/personas"
    
    print("1. Creating a new test persona via API...")
    payload = {
        "name": "Test Script Persona",
        "robotName": "TestBot",
        "robotRole": "Automated Tester",
        "robotCompany": "G1",
        "robotLocation": "Test Lab",
        "robotVoice": "Female",
        "wakeWord": "test_jarvis",
        "systemPrompt": "You are a test persona.",
        "conversationRules": json.dumps(["Always say test.", "Never break character."]),
        "isTemplate": False,
        "isActive": False
    }
    
    r = httpx.post(f"{base_url}/", json=payload)
    if r.status_code != 200:
        print(f"Failed to create persona: {r.text}")
        return
        
    created = r.json()
    persona_id = created["id"]
    print(f"Created Persona ID: {persona_id}")
    
    print(f"\n2. Deploying persona {persona_id} to robot_sync...")
    deploy_url = f"{base_url}/{persona_id}/deploy"
    r = httpx.post(deploy_url)
    
    if r.status_code != 200:
        print(f"Failed to deploy persona: {r.text}")
        return
        
    deploy_result = r.json()
    print(f"Deploy Result: {json.dumps(deploy_result, indent=2)}")
    
    if not deploy_result.get("robot_synced"):
        print("ERROR: robot_synced was False in the deploy response!")
        return
        
    print("\n3. Verifying persona.json on the filesystem...")
    # The file should be updated by robot_sync running on port 9000
    file_path = "/home/jai/g1-universe/g1-nlp/config/persona.json"
    try:
        with open(file_path, "r") as f:
            persona_json = json.load(f)
            print("Contents of persona.json:")
            print(json.dumps(persona_json, indent=2))
            
            # Assertions
            assert persona_json["identity"]["name"] == "TestBot"
            assert persona_json["identity"]["voice"] == "Female"
            assert persona_json["system_prompt"] == "You are a test persona."
            print("\nSUCCESS: persona.json is verified!")
            
    except Exception as e:
        print(f"ERROR reading persona.json: {e}")
        
    print("\n4. Cleaning up (Deleting test persona)...")
    httpx.delete(f"{base_url}/{persona_id}")
    print("Done.")

if __name__ == "__main__":
    test_deploy()
