from app.services.gcp_modules.docs_impl.core.server import server

def create_comment_tools(item_type: str, id_field_name: str):
    @server.tool(title=f"List {item_type.capitalize()} Comments")
    async def list_comments(user_google_email: str, **kwargs) -> str:
        """List all comments on an item."""
        return "Not implemented locally"

    @server.tool(title=f"Manage {item_type.capitalize()} Comment")
    async def manage_comment(user_google_email: str, action: str, comment_content: str = None, comment_id: str = None, **kwargs) -> str:
        """Create, reply to, or resolve a comment."""
        return "Not implemented locally"

    return {
        "list_comments": list_comments,
        "manage_comment": manage_comment
    }
