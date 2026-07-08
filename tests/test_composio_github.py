import os
import json
from composio import Composio

def test_github_integration():
    print("Testing Composio GitHub Integration...")
    
    api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")
    try:
        client = Composio(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize Composio client: {e}")
        return

    user_id = "31125d2e-e777-498b-8423-d40c5854a36a"
    print(f"Using user_id: {user_id}")

    # 1. Check if user already has an active GitHub connection
    print("\n1. Checking existing connected accounts...")
    
    entity = client.get_entity(id=user_id)
    print(f"Entity fetched: {entity.id}")
    
    try:
        # Try to get the GitHub connection for this entity
        github_connection = entity.get_connection(app="github")
        print(f"GitHub connection found! Status: {github_connection.status}")
        
        if github_connection.status == "ACTIVE":
            print("\n2. Executing a tool to verify the connection works...")
            # Execute a simple action: GITHUB_STARRED_REPOS
            try:
                response = entity.execute(
                    action="GITHUB_STARRED_REPOS", 
                    params={},
                    text="Get my starred repositories on github" # fallback
                )
                print("Tool Execution Successful!")
                print(json.dumps(response, indent=2)[:500] + "\n... (truncated)")
            except Exception as e:
                print(f"Failed to execute tool: {e}")
        else:
            print("Connection is not active. Please authenticate via the UI.")
            
    except Exception as e:
        print(f"No active GitHub connection found for {user_id}. Error: {e}")
        
        print("\n3. Generating a fallback Connect Link for testing...")
        try:
            # Let's generate a link using auth_config_id="ac_IuvdHGKBfu90"
            req = client.connected_accounts.link(
                user_id=user_id,
                auth_config_id="ac_IuvdHGKBfu90",
                allow_multiple=True
            )
            print(f"Generated Connect Link: {req.redirect_url}")
            print("Please click this link in your browser to authenticate, then re-run this test.")
        except Exception as ex:
            print(f"Failed to generate connect link: {ex}")

if __name__ == "__main__":
    test_github_integration()
