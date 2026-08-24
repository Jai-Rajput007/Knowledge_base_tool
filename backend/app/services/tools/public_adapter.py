import asyncio
import json
import os
import httpx
from datetime import datetime
import urllib.parse
from typing import List, Dict, Any
from app.services.tools.base import BaseToolAdapter
from app.core.logging import logger

# Shared Composio client for search_web/search_news/search_local_places/search_local_events.
# Same platform-wide key pattern already used for the "composio" provider in mcp.py —
# one key covers every tenant, same as this codebase already does for Composio elsewhere.
_COMPOSIO_CLIENT = None
_COMPOSIO_SEARCH_USER_ID = os.environ.get("COMPOSIO_SEARCH_USER_ID", "g1-universe-public")


def _get_composio_client():
    global _COMPOSIO_CLIENT
    if _COMPOSIO_CLIENT is None:
        from composio import Composio
        api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")
        _COMPOSIO_CLIENT = Composio(api_key=api_key)
    return _COMPOSIO_CLIENT

PUBLIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Gets current weather for a specific city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name, e.g., Indore or New York."}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weekly_forecast",
            "description": "Gets the 7-day weather forecast for a specific city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_hourly_forecast",
            "description": "Gets the hourly weather timeline for a specific city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_air_quality",
            "description": "Gets the current Air Quality Index (AQI) and pollutants for a city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_uv_index",
            "description": "Gets the current UV index and sunrise/sunset times for a city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_historical_weather",
            "description": "Gets the historical weather for a city on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name"},
                    "date": {"type": "string", "description": "The date in YYYY-MM-DD format"}
                },
                "required": ["city", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_marine_conditions",
            "description": "Gets ocean wave height and marine conditions (only works for coastal areas).",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The coastal city name"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "convert_currency",
            "description": "Converts amounts between different currencies (e.g., USD to INR).",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "The amount to convert"},
                    "from_currency": {"type": "string", "description": "3-letter currency code, e.g., USD"},
                    "to_currency": {"type": "string", "description": "3-letter currency code, e.g., INR"}
                },
                "required": ["amount", "from_currency", "to_currency"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_wikipedia",
            "description": "Searches Wikipedia for an encyclopedia summary of a topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The topic to search for."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Returns the current global UTC time and allows the AI to do timezone math.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_local_places",
            "description": "Searches the web for restaurants, cafes, or businesses. MUST include the location. You MUST extract actual business names from the snippets rather than just returning URLs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to search for. Advise: append words like 'list of names' to get better snippets, e.g., 'names of best Italian restaurants'."},
                    "location": {"type": "string", "description": "The city/location. If the user did not provide one, ASK THEM for their location first before calling this tool."}
                },
                "required": ["query", "location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_local_events",
            "description": "Searches for upcoming events, concerts, festivals, or conferences. MUST include the location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Type of events, e.g., 'live music concerts'."},
                    "location": {"type": "string", "description": "The city/location. If the user did not provide one, ASK THEM for their location first before calling this."},
                    "date": {"type": "string", "enum": ["today", "tomorrow", "week", "weekend", "next_week", "month", "next_month"], "description": "When the event happens. This search engine only supports these relative buckets, not exact calendar dates — pick whichever is closest to what the user asked for. Omit if the user didn't mention timing."}
                },
                "required": ["query", "location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Searches the general web for any query. Use this for general knowledge questions (e.g., 'Where is X?').",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_news",
            "description": "Searches the web specifically for latest news articles on a given topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The topic to find news about."}
                },
                "required": ["query"]
            }
        }
    }
]


# Maps integration name (as stored in DB) to the tool names it provides
INTEGRATION_TOOL_MAP = {
    "Weather": {
        "get_weather", "get_weekly_forecast", "get_hourly_forecast",
        "get_uv_index", "get_air_quality", "get_historical_weather", "get_marine_conditions"
    },
    "Local Search": {"search_local_places", "search_local_events"},
    "News": {"search_news"},
    "Wikipedia": {"search_wikipedia"},
    "Currency Converter": {"convert_currency"},
    "Web search": {"search_web", "get_current_time"},
}


class PublicToolsAdapter(BaseToolAdapter):
    """
    Adapter for 100% free, stateless public tools.
    Requires ZERO API keys.

    Args:
        enabled_integrations: List of integration names (from DB) that are enabled.
            If None, all tools are returned (backwards-compat). If empty list, no tools.
    """

    def __init__(self, enabled_integrations: list = None):
        self._enabled_integrations = enabled_integrations  # None = all

    @property
    def provider_id(self) -> str:
        return "native/public_tools"

    async def get_tools(self, query: str = None) -> List[Dict[str, Any]]:
        # If no filter, return all tools (backwards-compat)
        if self._enabled_integrations is None:
            return PUBLIC_TOOLS

        # Build the set of allowed tool names from the enabled integrations
        allowed_tool_names: set = set()
        for integration_name in self._enabled_integrations:
            allowed_tool_names.update(INTEGRATION_TOOL_MAP.get(integration_name, set()))

        if not allowed_tool_names:
            logger.info("[PublicTools] No tools allowed (all integrations disabled).")
            return []

        filtered = [
            t for t in PUBLIC_TOOLS
            if t.get("function", {}).get("name") in allowed_tool_names
        ]
        logger.info(f"[PublicTools] Filtered to {len(filtered)} tools based on enabled integrations: {self._enabled_integrations}")
        return filtered

    async def execute_tool(self, name: str, arguments: dict) -> str:
        logger.info(f"[PublicTools] Executing '{name}' with args {arguments}")
        try:
            if name == "get_weather":
                return await self._get_weather(arguments.get("city"))
            elif name == "get_weekly_forecast":
                return await self._get_weekly_forecast(arguments.get("city"))
            elif name == "get_hourly_forecast":
                return await self._get_hourly_forecast(arguments.get("city"))
            elif name == "get_air_quality":
                return await self._get_air_quality(arguments.get("city"))
            elif name == "get_uv_index":
                return await self._get_uv_index(arguments.get("city"))
            elif name == "get_historical_weather":
                return await self._get_historical_weather(arguments.get("city"), arguments.get("date"))
            elif name == "get_marine_conditions":
                return await self._get_marine_conditions(arguments.get("city"))
            elif name == "convert_currency":
                return await self._convert_currency(
                    arguments.get("amount"), 
                    arguments.get("from_currency"), 
                    arguments.get("to_currency")
                )
            elif name == "search_wikipedia":
                return await self._search_wikipedia(arguments.get("query"))
            elif name == "get_current_time":
                return f"Current UTC Time: {datetime.utcnow().isoformat()}Z"
            elif name == "search_local_places":
                # COMPOSIO_SEARCH_GOOGLE_MAPS has no separate "location" field at
                # all — confirmed via its real input_parameters schema. Location
                # must be folded into "q" itself, or results drift to a random
                # region (confirmed live: got a Virginia, USA result for
                # "south indian restaurant" + location="Vijaynagar, Indore").
                q_parts = [p for p in (arguments.get("query"), arguments.get("location")) if p]
                return await self._composio_search("COMPOSIO_SEARCH_GOOGLE_MAPS", {
                    "q": " ".join(q_parts),
                })
            elif name == "search_local_events":
                # COMPOSIO_SEARCH_EVENT has no "date" field — date filtering is a
                # separate "htichips" param that only accepts a fixed vocabulary
                # (date:today/tomorrow/week/weekend/next_week/month/next_month),
                # confirmed via its real input_parameters schema. Arbitrary dates
                # silently return zero results rather than erroring.
                composio_args = {
                    "query": arguments.get("query"),
                    "location": arguments.get("location"),
                }
                date_bucket = arguments.get("date")
                if date_bucket:
                    composio_args["htichips"] = f"date:{date_bucket}"

                try:
                    event_data = await self._composio_search_raw("COMPOSIO_SEARCH_EVENT", composio_args)
                except Exception as e:
                    logger.warning(f"[PublicTools] COMPOSIO_SEARCH_EVENT raised, falling back to web search: {e}")
                    event_data = None

                # The Composio SDK wraps the tool's own output under a "data" key
                # (response.data == {"data": {"results": {...}}, "error": ..., "successful": ...}),
                # confirmed by inspecting the raw response — not documented in the tool schema.
                inner = event_data.get("data", {}) if isinstance(event_data, dict) else {}
                results = inner.get("results", {}) if isinstance(inner, dict) else {}
                if isinstance(results, dict) and results.get("events_results"):
                    return json.dumps(event_data)

                # Live-tested: Google's events vertical (ibp=htl;events) returns
                # its bot-block page for this request signature, which SerpApi
                # reports as events_results_state="Fully empty" rather than an
                # error. Composio's own tool description says to treat that as
                # limited coverage and retry via COMPOSIO_SEARCH_WEB instead of
                # retrying COMPOSIO_SEARCH_EVENT. COMPOSIO_SEARCH_WEB (Exa) has
                # no location/date params of its own, so fold them into the
                # query text as natural language.
                events_state = results.get("search_information", {}).get("events_results_state") if isinstance(results, dict) else None
                logger.info(f"[PublicTools] search_local_events: EVENT search empty (state={events_state}), falling back to SEARCH_WEB")

                date_phrases = {
                    "today": "today", "tomorrow": "tomorrow", "week": "this week",
                    "weekend": "this weekend", "next_week": "next week",
                    "month": "this month", "next_month": "next month",
                }
                query_parts = [arguments.get("query"), "in", arguments.get("location")]
                if date_bucket:
                    query_parts.append(date_phrases.get(date_bucket, date_bucket))
                query_parts.append(str(datetime.utcnow().year))
                web_query = " ".join(p for p in query_parts if p)
                return await self._composio_search("COMPOSIO_SEARCH_WEB", {"query": web_query})
            elif name == "search_web":
                return await self._composio_search("COMPOSIO_SEARCH_WEB", {
                    "query": arguments.get("query"),
                })
            elif name == "search_news":
                return await self._composio_search("COMPOSIO_SEARCH_NEWS", {
                    "query": arguments.get("query"),
                })
            else:
                return f"Unknown public tool: {name}"
        except Exception as e:
            logger.error(f"[PublicTools] Execution failed: {e}")
            return f"Error executing {name}: {str(e)}"

    async def _geocode(self, city: str, client: httpx.AsyncClient) -> dict:
        headers = {"User-Agent": "Antigravity/1.0 (admin@g1universe.com)"}
        geo_url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(city)}&format=json&limit=1"
        geo_resp = await client.get(geo_url, headers=headers)
        if geo_resp.status_code != 200:
            raise Exception(f"Geocoding API error (HTTP {geo_resp.status_code}): {geo_resp.text}")
        try:
            geo_data = geo_resp.json()
        except Exception:
            raise Exception("Geocoding API returned invalid JSON.")
        if not geo_data:
            raise Exception(f"Could not find coordinates for city: {city}")
        return {
            "lat": geo_data[0]["lat"],
            "lon": geo_data[0]["lon"],
            "name": geo_data[0]["display_name"].split(",")[0]
        }

    async def _get_weather(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={geo['lat']}&longitude={geo['lon']}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto"
            w_resp = await client.get(weather_url)
            w_data = w_resp.json()
            
            if "current" in w_data and "daily" in w_data:
                c = w_data["current"]
                d = w_data["daily"]
                return (
                    f"Weather in {geo['name']}:\n"
                    f"- Current: {c['temperature_2m']}°C (Feels like {c['apparent_temperature']}°C)\n"
                    f"- Humidity: {c['relative_humidity_2m']}%\n"
                    f"- Wind Speed: {c['wind_speed_10m']} km/h\n"
                    f"- Precipitation: {c['precipitation']} mm\n"
                    f"- Today's Min/Max: {d['temperature_2m_min'][0]}°C / {d['temperature_2m_max'][0]}°C\n"
                    f"- Rain Probability: {d['precipitation_probability_max'][0]}%"
                )
            return "Weather data unavailable."

    async def _get_weekly_forecast(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={geo['lat']}&longitude={geo['lon']}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto"
            w_resp = await client.get(weather_url)
            w_data = w_resp.json()
            
            if "daily" in w_data:
                d = w_data["daily"]
                forecast = f"7-Day Forecast for {geo['name']}:\n"
                for i in range(len(d['time'])):
                    forecast += f"- {d['time'][i]}: Min {d['temperature_2m_min'][i]}°C / Max {d['temperature_2m_max'][i]}°C, Rain Chance: {d['precipitation_probability_max'][i]}%\n"
                return forecast
            return "Weekly forecast data unavailable."

    async def _get_hourly_forecast(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={geo['lat']}&longitude={geo['lon']}&hourly=temperature_2m,precipitation_probability&forecast_hours=12&timezone=auto"
            w_resp = await client.get(weather_url)
            w_data = w_resp.json()
            
            if "hourly" in w_data:
                h = w_data["hourly"]
                forecast = f"12-Hour Forecast for {geo['name']}:\n"
                for i in range(len(h['time'])):
                    forecast += f"- {h['time'][i][-5:]}: {h['temperature_2m'][i]}°C, Rain Chance: {h['precipitation_probability'][i]}%\n"
                return forecast
            return "Hourly forecast data unavailable."

    async def _get_air_quality(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            aqi_url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={geo['lat']}&longitude={geo['lon']}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto"
            resp = await client.get(aqi_url)
            data = resp.json()
            
            if "current" in data:
                c = data["current"]
                return (
                    f"Air Quality in {geo['name']}:\n"
                    f"- European AQI: {c.get('european_aqi', 'N/A')} (0-20=Good, 20-40=Fair, 40-60=Moderate, 60-80=Poor, 80-100=Very Poor, >100=Extremely Poor)\n"
                    f"- PM2.5: {c.get('pm2_5', 'N/A')} μg/m³\n"
                    f"- PM10: {c.get('pm10', 'N/A')} μg/m³\n"
                    f"- Carbon Monoxide: {c.get('carbon_monoxide', 'N/A')} μg/m³\n"
                    f"- Nitrogen Dioxide: {c.get('nitrogen_dioxide', 'N/A')} μg/m³\n"
                    f"- Ozone: {c.get('ozone', 'N/A')} μg/m³"
                )
            return "Air quality data unavailable."

    async def _get_uv_index(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            url = f"https://api.open-meteo.com/v1/forecast?latitude={geo['lat']}&longitude={geo['lon']}&daily=uv_index_max,uv_index_clear_sky_max,sunrise,sunset&timezone=auto"
            resp = await client.get(url)
            data = resp.json()
            
            if "daily" in data:
                d = data["daily"]
                return (
                    f"UV & Sun for {geo['name']} Today:\n"
                    f"- Max UV Index: {d.get('uv_index_max', ['N/A'])[0]}\n"
                    f"- Max UV Index (Clear Sky): {d.get('uv_index_clear_sky_max', ['N/A'])[0]}\n"
                    f"- Sunrise: {d.get('sunrise', ['N/A'])[0][-5:]}\n"
                    f"- Sunset: {d.get('sunset', ['N/A'])[0][-5:]}"
                )
            return "UV data unavailable."

    async def _get_historical_weather(self, city: str, date: str) -> str:
        if not city or not date: return "Error: City and date are required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            # Historical API
            url = f"https://archive-api.open-meteo.com/v1/archive?latitude={geo['lat']}&longitude={geo['lon']}&start_date={date}&end_date={date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto"
            resp = await client.get(url)
            data = resp.json()
            
            if "daily" in data and len(data["daily"].get("time", [])) > 0:
                d = data["daily"]
                return (
                    f"Historical Weather for {geo['name']} on {date}:\n"
                    f"- Min Temp: {d.get('temperature_2m_min', ['N/A'])[0]}°C\n"
                    f"- Max Temp: {d.get('temperature_2m_max', ['N/A'])[0]}°C\n"
                    f"- Precipitation: {d.get('precipitation_sum', ['N/A'])[0]} mm\n"
                    f"- Max Wind Speed: {d.get('wind_speed_10m_max', ['N/A'])[0]} km/h"
                )
            if "error" in data:
                return f"Historical weather error: {data.get('reason')}"
            return "Historical weather data unavailable for that date."

    async def _get_marine_conditions(self, city: str) -> str:
        if not city: return "Error: City is required."
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await self._geocode(city, client)
            # Marine API
            url = f"https://marine-api.open-meteo.com/v1/marine?latitude={geo['lat']}&longitude={geo['lon']}&current=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction&timezone=auto"
            resp = await client.get(url)
            data = resp.json()
            
            if "current" in data:
                c = data["current"]
                # Note: Open-Meteo returns nulls if the coordinates are far inland
                if c.get('wave_height') is None:
                    return f"Marine data is unavailable for {geo['name']}. It is likely too far inland."
                
                return (
                    f"Marine Conditions near {geo['name']}:\n"
                    f"- Wave Height: {c.get('wave_height', 'N/A')} m\n"
                    f"- Wave Direction: {c.get('wave_direction', 'N/A')}°\n"
                    f"- Ocean Current Velocity: {c.get('ocean_current_velocity', 'N/A')} km/h\n"
                    f"- Ocean Current Direction: {c.get('ocean_current_direction', 'N/A')}°"
                )
            if "error" in data:
                return f"Marine API error: {data.get('reason')}"
            return "Marine data unavailable."

    async def _convert_currency(self, amount: float, from_curr: str, to_curr: str) -> str:
        if not amount or not from_curr or not to_curr:
            return "Error: amount, from_currency, and to_currency are required."
        
        from_curr = str(from_curr).upper()
        to_curr = str(to_curr).upper()
        
        url = f"https://api.frankfurter.dev/v1/latest?amount={amount}&base={from_curr}&symbols={to_curr}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return f"Failed to convert currency. Status {resp.status_code}"
            
            data = resp.json()
            rate = data.get("rates", {}).get(to_curr)
            if not rate:
                return f"Exchange rate not found for {from_curr} to {to_curr}."
                
            return f"{amount} {from_curr} = {rate} {to_curr} (as of {data.get('date')})"

    async def _search_wikipedia(self, query: str) -> str:
        if not query: return "Error: query is required."
        url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={urllib.parse.quote(query)}"
        headers = {"User-Agent": "AntigravityAssistant/1.0 (https://antigravity.dev; bot@antigravity.dev) httpx/0.24"}
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return f"Wikipedia search failed with status {resp.status_code}"
            
            try:
                pages = resp.json().get("query", {}).get("pages", {})
                for page_id, page_data in pages.items():
                    if page_id == "-1":
                        return f"No Wikipedia article found for '{query}'"
                    extract = page_data.get("extract", "")
                    return f"Wikipedia Summary for {query}:\n{extract[:1500]}..."
            except Exception as e:
                return f"Error parsing Wikipedia response: {e}"
                
        return "Search failed."

    async def _composio_search_raw(self, slug: str, arguments: dict) -> Any:
        """
        Runs one of Composio's "Composio Search" toolkit actions
        (COMPOSIO_SEARCH_WEB / _NEWS / _GOOGLE_MAPS / _EVENT), using the shared
        platform-wide Composio key — same pattern ComposioAdapter already uses
        for every tenant, not a per-tenant credential.

        Returns the parsed response payload (not stringified) so callers can
        inspect it — e.g. search_local_events checks events_results before
        deciding whether to fall back to a different search action.

        arguments may contain None values (e.g. no location given) — those are
        dropped rather than sent, since Composio's own schema validation should
        decide whether a field is actually required.
        """
        clean_args = {k: v for k, v in arguments.items() if v is not None}
        client = _get_composio_client()
        # client.tools.execute is a blocking SDK call — run off the event
        # loop so one search doesn't stall every other concurrent request.
        response = await asyncio.to_thread(
            client.tools.execute,
            slug=slug,
            arguments=clean_args,
            user_id=_COMPOSIO_SEARCH_USER_ID,
            dangerously_skip_version_check=True,
        )
        return response.data if hasattr(response, "data") else response

    async def _composio_search(self, slug: str, arguments: dict) -> str:
        """Stringified wrapper around _composio_search_raw for tools that just return the raw payload as-is."""
        try:
            data = await self._composio_search_raw(slug, arguments)
            return json.dumps(data)
        except Exception as e:
            logger.error(f"[PublicTools] Composio search '{slug}' failed: {e}")
            return f"Error executing {slug}: {str(e)}"
