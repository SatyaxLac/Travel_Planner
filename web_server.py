import importlib.util
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent / "Agentic-Travel-Planner"
PROJECT_WEB_SERVER = PROJECT_DIR / "web_server.py"

spec = importlib.util.spec_from_file_location(
    "_agentic_travel_planner_web_server",
    PROJECT_WEB_SERVER,
)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

app = module.app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
