import os
import asyncio
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

TOOLS = [
    {
        "name": "search_custom",
        "description": "Performs a search using Google Custom Search JSON API.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string",
                    "description": "The user's Google email address."
                },
                "q": {
                    "type": "string",
                    "description": "The search query."
                },
                "num": {
                    "type": "integer",
                    "description": "Number of results to return (1-10).",
                    "default": 10
                },
                "start": {
                    "type": "integer",
                    "description": "The index of the first result to return (1-based).",
                    "default": 1
                },
                "safe": {
                    "type": "string",
                    "enum": ["active", "moderate", "off"],
                    "description": "Safe search level.",
                    "default": "off"
                },
                "search_type": {
                    "type": "string",
                    "enum": ["image"],
                    "description": "Search for images if set to 'image'."
                },
                "site_search": {
                    "type": "string",
                    "description": "Restrict search to a specific site/domain."
                },
                "site_search_filter": {
                    "type": "string",
                    "enum": ["e", "i"],
                    "description": "Exclude ('e') or include ('i') site_search results."
                },
                "date_restrict": {
                    "type": "string",
                    "description": "Restrict results by date (e.g., 'd5' for past 5 days, 'm3' for past 3 months)."
                },
                "file_type": {
                    "type": "string",
                    "description": "Filter by file type (e.g., 'pdf', 'doc')."
                },
                "language": {
                    "type": "string",
                    "description": "Language code for results (e.g., 'lang_en')."
                },
                "country": {
                    "type": "string",
                    "description": "Country code for results (e.g., 'countryUS')."
                },
                "sites": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of sites/domains to restrict search to (e.g., ['example.com']). When provided, results are limited to these sites."
                }
            },
            "required": ["user_google_email", "q"]
        }
    },
    {
        "name": "get_search_engine_info",
        "description": "Retrieves metadata about a Programmable Search Engine.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string",
                    "description": "The user's Google email address."
                }
            },
            "required": ["user_google_email"]
        }
    }
]


async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    creds = Credentials(token=access_token)
    service = build("customsearch", "v1", credentials=creds)

    if tool_name == "search_custom":
        user_google_email = arguments.get("user_google_email")
        q = arguments.get("q")
        if not q:
            raise ValueError("Missing required argument: 'q'")
            
        num = arguments.get("num", 10)
        start = arguments.get("start", 1)
        safe = arguments.get("safe", "off")
        search_type = arguments.get("search_type")
        site_search = arguments.get("site_search")
        site_search_filter = arguments.get("site_search_filter")
        date_restrict = arguments.get("date_restrict")
        file_type = arguments.get("file_type")
        language = arguments.get("language")
        country = arguments.get("country")
        sites = arguments.get("sites")

        api_key = os.environ.get("GOOGLE_PSE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_PSE_API_KEY environment variable not set. Please set it to your Google Custom Search API key.")

        cx = os.environ.get("GOOGLE_PSE_ENGINE_ID")
        if not cx:
            raise ValueError("GOOGLE_PSE_ENGINE_ID environment variable not set. Please set it to your Programmable Search Engine ID.")

        if sites:
            site_query = " OR ".join([f"site:{site}" for site in sites])
            q = f"{q} ({site_query})"

        params = {
            "key": api_key,
            "cx": cx,
            "q": q,
            "num": num,
            "start": start,
            "safe": safe,
        }

        if search_type:
            params["searchType"] = search_type
        if site_search:
            params["siteSearch"] = site_search
        if site_search_filter:
            params["siteSearchFilter"] = site_search_filter
        if date_restrict:
            params["dateRestrict"] = date_restrict
        if file_type:
            params["fileType"] = file_type
        if language:
            params["lr"] = language
        if country:
            params["cr"] = country

        result = await asyncio.to_thread(service.cse().list(**params).execute)

        search_info = result.get("searchInformation", {})
        total_results = search_info.get("totalResults", "0")
        search_time = search_info.get("searchTime", 0)

        items = result.get("items", [])

        confirmation_message = (
            f"Search Results for {user_google_email}:\n"
            f"- Query: \"{q}\"\n"
            f"- Search Engine ID: {cx}\n"
            f"- Total Results: {total_results}\n"
            f"- Search Time: {search_time:.3f} seconds\n"
            f"- Results Returned: {len(items)} (showing {start} to {start + len(items) - 1})\n\n"
        )

        if items:
            confirmation_message += "Results:\n"
            for i, item in enumerate(items, start):
                title = item.get("title", "No title")
                link = item.get("link", "No link")
                snippet = item.get("snippet", "No description available").replace("\n", " ")

                confirmation_message += f"\n{i}. {title}\n"
                confirmation_message += f"   URL: {link}\n"
                confirmation_message += f"   Snippet: {snippet}\n"

                if "pagemap" in item:
                    pagemap = item["pagemap"]
                    if "metatags" in pagemap and pagemap["metatags"]:
                        metatag = pagemap["metatags"][0]
                        if "og:type" in metatag:
                            confirmation_message += f"   Type: {metatag['og:type']}\n"
                        if "article:published_time" in metatag:
                            confirmation_message += f"   Published: {metatag['article:published_time'][:10]}\n"
        else:
            confirmation_message += "\nNo results found."

        queries = result.get("queries", {})
        if "nextPage" in queries:
            next_start = queries["nextPage"][0].get("startIndex", 0)
            confirmation_message += f"\n\nTo see more results, search again with start={next_start}"

        return confirmation_message

    elif tool_name == "get_search_engine_info":
        user_google_email = arguments.get("user_google_email")
        api_key = os.environ.get("GOOGLE_PSE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_PSE_API_KEY environment variable not set. Please set it to your Google Custom Search API key.")

        cx = os.environ.get("GOOGLE_PSE_ENGINE_ID")
        if not cx:
            raise ValueError("GOOGLE_PSE_ENGINE_ID environment variable not set. Please set it to your Programmable Search Engine ID.")

        params = {
            "key": api_key,
            "cx": cx,
            "q": "test",
            "num": 1,
        }

        result = await asyncio.to_thread(service.cse().list(**params).execute)

        context = result.get("context", {})
        title = context.get("title", "Unknown")

        confirmation_message = (
            f"Search Engine Information for {user_google_email}:\n"
            f"- Search Engine ID: {cx}\n"
            f"- Title: {title}\n"
        )

        if "facets" in context:
            confirmation_message += "\nAvailable Refinements:\n"
            for facet in context["facets"]:
                for item in facet:
                    label = item.get("label", "Unknown")
                    anchor = item.get("anchor", "Unknown")
                    confirmation_message += f"  - {label} (anchor: {anchor})\n"

        search_info = result.get("searchInformation", {})
        if search_info:
            total_results = search_info.get("totalResults", "Unknown")
            confirmation_message += "\nSearch Statistics:\n"
            confirmation_message += f"  - Total indexed results: {total_results}\n"

        return confirmation_message

    else:
        raise ValueError(f"Unknown tool: {tool_name}")
