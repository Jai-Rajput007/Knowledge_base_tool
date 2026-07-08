class UserInputError(Exception): pass
GOOGLE_API_WRITE_RETRIES = 3

def handle_http_errors(*args, **kwargs):
    def decorator(func):
        return func
    return decorator

def extract_office_xml_text(file_bytes, mime_type):
    return None
