class DummyServer:
    def __init__(self):
        self.tools = {}
    def tool(self, title=None, annotations=None):
        def decorator(func):
            self.tools[func.__name__] = func
            return func
        return decorator

server = DummyServer()
