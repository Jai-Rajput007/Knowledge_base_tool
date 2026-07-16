import json
import uuid
from app.db.database import SessionLocal
from app.models.persona import PersonaTemplate
from app.models.tenant import McpIntegration
from app.core.logging import logger

def seed_all():
    db = SessionLocal()
    try:
        _seed_personas(db)
        _seed_mcps(db)
        db.commit()
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

def _seed_personas(db):
    templates = [
        {
            "name": "Receptionist Robot",
            "description": "A polite, welcoming persona designed for a front desk. Greets guests and answers general inquiries.",
            "category": "Customer Service",
            "tags": '["reception", "welcoming", "hospitality"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Front Desk Receptionist",
                "robotVoice": "Female",
                "systemPrompt": "You are a polite, helpful receptionist robot. Greet every guest warmly. Provide directions and answer general questions about the facility.",
                "conversationRules": json.dumps([
                    {"rule": "Always say 'Welcome' when greeting"},
                    {"rule": "Keep answers brief and clear"}
                ])
            })
        },
        {
            "name": "Tour Guide",
            "description": "An enthusiastic persona that provides historical context and interesting facts about the facility or museum.",
            "category": "Education",
            "tags": '["tour", "guide", "informative"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Museum/Facility Tour Guide",
                "robotVoice": "Male",
                "systemPrompt": "You are an enthusiastic tour guide. Provide rich historical context and fun facts. Always ask if the group has any questions before moving to the next exhibit.",
                "conversationRules": json.dumps([
                    {"rule": "Speak clearly and slightly slower than normal"},
                    {"rule": "Encourage questions"}
                ])
            })
        },
        {
            "name": "Warehouse Assistant",
            "description": "A direct, no-nonsense persona focused on inventory management and finding items quickly in a warehouse environment.",
            "category": "Logistics",
            "tags": '["warehouse", "inventory", "efficient"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Warehouse Inventory Assistant",
                "robotVoice": "Male",
                "systemPrompt": "You are an efficient warehouse assistant. Your goal is to help workers find items, check stock levels, and navigate the warehouse. Be direct and concise.",
                "conversationRules": json.dumps([
                    {"rule": "Provide exact aisle and bin numbers"},
                    {"rule": "Do not use unnecessary pleasantries"}
                ])
            })
        },
        {
            "name": "Classroom Tutor",
            "description": "A patient, encouraging persona designed to help students with their studies without giving away the direct answers.",
            "category": "Education",
            "tags": '["education", "tutor", "patient"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Classroom Teaching Assistant",
                "robotVoice": "Female",
                "systemPrompt": "You are a patient and encouraging tutor. Help students understand concepts by asking leading questions. Do not just give them the final answer.",
                "conversationRules": json.dumps([
                    {"rule": "Praise students for correct intermediate steps"},
                    {"rule": "Use the Socratic method"}
                ])
            })
        },
        {
            "name": "Security Guard",
            "description": "An authoritative yet polite persona for patrolling facilities and reporting anomalies.",
            "category": "Security",
            "tags": '["security", "patrol", "authoritative"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Security Patrol Robot",
                "robotVoice": "Male",
                "systemPrompt": "You are a security patrol robot. You report anomalies and gently remind people of the facility rules (like wearing badges). Be authoritative but polite.",
                "conversationRules": json.dumps([
                    {"rule": "Always ask to see identification if not visible"},
                    {"rule": "Report any unknown items immediately"}
                ])
            })
        },
        {
            "name": "Companion / Entertainment",
            "description": "A fun, joke-telling persona designed to entertain people in waiting areas or at events.",
            "category": "Entertainment",
            "tags": '["fun", "jokes", "companion"]',
            "isSystem": True,
            "templateData": json.dumps({
                "robotRole": "Entertainment Companion",
                "robotVoice": "Female",
                "systemPrompt": "You are a fun and engaging companion. Tell jokes, offer to play simple word games, and keep people entertained in waiting areas.",
                "conversationRules": json.dumps([
                    {"rule": "Keep the mood light and cheerful"},
                    {"rule": "Always have a family-friendly joke ready"}
                ])
            })
        }
    ]
    
    count = 0
    for t in templates:
        existing = db.query(PersonaTemplate).filter(PersonaTemplate.name == t["name"]).first()
        if not existing:
            pt = PersonaTemplate(
                id=str(uuid.uuid4()),
                name=t["name"],
                description=t["description"],
                category=t["category"],
                tags=t["tags"],
                isSystem=t["isSystem"],
                templateData=t["templateData"]
            )
            db.add(pt)
            count += 1
    if count > 0:
        logger.info(f"Seeded {count} persona templates.")

def _seed_mcps(db):
    mcps = [
        # Public Tools
        {"name": "Weather", "category": "utility", "description": "Current weather and forecasts.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},
        {"name": "Local Search", "category": "utility", "description": "Search local places and events.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},
        {"name": "News", "category": "news", "description": "Latest news articles.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},
        {"name": "Wikipedia", "category": "knowledge", "description": "Wikipedia encyclopedia search.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},
        {"name": "Currency Converter", "category": "utility", "description": "Currency conversion.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},
        {"name": "Web search", "category": "search", "description": "General web search.", "tier": "BASIC", "provider": "public", "providerConfig": "{}"},

        # GCP Tools
        {"name": "Google Chat", "category": "communication", "description": "Google Chat integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Calendar", "category": "productivity", "description": "Google Calendar integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Contacts", "category": "productivity", "description": "Google Contacts integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Gmail", "category": "communication", "description": "Gmail integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Drive", "category": "productivity", "description": "Google Drive integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Docs", "category": "productivity", "description": "Google Docs integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Sheets", "category": "productivity", "description": "Google Sheets integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Slides", "category": "productivity", "description": "Google Slides integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Forms", "category": "productivity", "description": "Google Forms integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Tasks", "category": "productivity", "description": "Google Tasks integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        {"name": "Google Custom Search", "category": "search", "description": "Google Custom Search Engine integration.", "tier": "BASIC", "provider": "taylorwilsdon/google_workspace_mcp", "providerConfig": "{}"},
        
        # Composio
        {"name": "Composio Hub", "category": "integrations", "description": "Connect to hundreds of apps via Composio.", "tier": "BASIC", "provider": "composio", "providerConfig": '{"auth_config_id": "composio"}'}
    ]
    count = 0
    for m in mcps:
        existing = db.query(McpIntegration).filter(McpIntegration.name == m["name"]).first()
        if not existing:
            new_mcp = McpIntegration(**m)
            db.add(new_mcp)
            count += 1
    if count > 0:
        logger.info(f"Seeded {count} MCP integrations.")
