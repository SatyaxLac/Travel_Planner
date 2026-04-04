import json
import os
from pathlib import Path

try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:
    _load_dotenv = None

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
_SUPPORTED_LLM_PROVIDERS = ("openai", "anthropic", "google")
_DEFAULT_OPENAI_MODEL = "gpt-4o"
_DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
_DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash"
_PLACEHOLDER_VALUES = {
    "your_openai_api_key_here",
    "your_anthropic_api_key_here",
    "your_google_api_key_here",
    "your_openai_model_here",
    "your_anthropic_model_here",
    "your_google_model_here",
    "your_amadeus_api_key_here",
    "your_amadeus_api_secret_here",
    "rzp_test_your_razorpay_key_id_here",
    "your_razorpay_key_secret_here",
    "your_razorpay_webhook_secret_here",
    "sk_test_your_stripe_secret_key_here",
    "pk_test_your_stripe_publishable_key_here",
    "whsec_your_webhook_secret_here",
    "sk-lf-your_secret_key_here",
    "pk-lf-your_public_key_here",
}
_ENV_BOOTSTRAP_ATTEMPTED = False
_DOTENV_WARNING_EMITTED = False


def bootstrap_environment():
    """Load the project .env file once, if python-dotenv is available."""
    global _ENV_BOOTSTRAP_ATTEMPTED, _DOTENV_WARNING_EMITTED

    if _ENV_BOOTSTRAP_ATTEMPTED:
        return _ENV_PATH

    _ENV_BOOTSTRAP_ATTEMPTED = True
    if _load_dotenv is None:
        if not _DOTENV_WARNING_EMITTED:
            print(
                "Warning: python-dotenv is not installed, so .env could not be loaded. "
                "Use the repo-local venv and run "
                "`venv\\Scripts\\python.exe -m pip install -r requirements.txt`."
            )
            _DOTENV_WARNING_EMITTED = True
        return _ENV_PATH

    _load_dotenv(_ENV_PATH)
    return _ENV_PATH


def _normalize_env_value(value):
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def is_placeholder_value(value):
    normalized = _normalize_env_value(value)
    if normalized is None:
        return False
    return normalized in _PLACEHOLDER_VALUES


def get_env_value(name, default=None, allow_placeholder=False):
    """Read an environment variable after bootstrapping and sanitizing it."""
    bootstrap_environment()
    value = _normalize_env_value(os.getenv(name))
    if value is None:
        return default
    if not allow_placeholder and is_placeholder_value(value):
        return default
    return value


class Config:
    """Configuration management for the Travel Agent."""

    ENV_PATH = _ENV_PATH
    DOTENV_AVAILABLE = _load_dotenv is not None

    # Populated by refresh() at import time and before runtime checks.
    LLM_PROVIDER = "openai"
    OPENAI_MODEL = _DEFAULT_OPENAI_MODEL
    ANTHROPIC_MODEL = _DEFAULT_ANTHROPIC_MODEL
    GOOGLE_MODEL = _DEFAULT_GOOGLE_MODEL
    OPENAI_API_KEY = None
    ANTHROPIC_API_KEY = None
    GOOGLE_API_KEY = None
    FLIGHT_API_KEY = None
    FLIGHT_API_SECRET = None
    WEATHER_API_KEY = None
    RAZORPAY_KEY_ID = None
    RAZORPAY_KEY_SECRET = None
    RAZORPAY_WEBHOOK_SECRET = None
    STRIPE_SECRET_KEY = None
    STRIPE_PUBLISHABLE_KEY = None
    STRIPE_WEBHOOK_SECRET = None
    LANGFUSE_SECRET_KEY = None
    LANGFUSE_PUBLIC_KEY = None
    LANGFUSE_HOST = "https://cloud.langfuse.com"

    @classmethod
    def refresh(cls):
        """Reload sanitized configuration values from the environment."""
        bootstrap_environment()

        provider_name = get_env_value("LLM_PROVIDER", "openai", allow_placeholder=True)
        provider_name = provider_name.lower() if provider_name else "openai"
        if provider_name not in _SUPPORTED_LLM_PROVIDERS:
            provider_name = "openai"

        cls.LLM_PROVIDER = provider_name
        cls.OPENAI_MODEL = get_env_value("OPENAI_MODEL", _DEFAULT_OPENAI_MODEL)
        cls.ANTHROPIC_MODEL = get_env_value("ANTHROPIC_MODEL", _DEFAULT_ANTHROPIC_MODEL)
        cls.GOOGLE_MODEL = get_env_value("GOOGLE_MODEL", _DEFAULT_GOOGLE_MODEL)
        cls.OPENAI_API_KEY = get_env_value("OPENAI_API_KEY")
        cls.ANTHROPIC_API_KEY = get_env_value("ANTHROPIC_API_KEY")
        cls.GOOGLE_API_KEY = get_env_value("GOOGLE_API_KEY")

        cls.FLIGHT_API_KEY = get_env_value("FLIGHT_API_KEY")
        cls.FLIGHT_API_SECRET = get_env_value("FLIGHT_API_SECRET")
        cls.WEATHER_API_KEY = get_env_value("WEATHER_API_KEY")

        cls.RAZORPAY_KEY_ID = get_env_value(
            "RAZORPAY_KEY_ID",
            get_env_value("STRIPE_PUBLISHABLE_KEY"),
        )
        cls.RAZORPAY_KEY_SECRET = get_env_value(
            "RAZORPAY_KEY_SECRET",
            get_env_value("STRIPE_SECRET_KEY"),
        )
        cls.RAZORPAY_WEBHOOK_SECRET = get_env_value(
            "RAZORPAY_WEBHOOK_SECRET",
            get_env_value("STRIPE_WEBHOOK_SECRET"),
        )

        # Legacy aliases retained so any remaining callers still resolve.
        cls.STRIPE_SECRET_KEY = cls.RAZORPAY_KEY_SECRET
        cls.STRIPE_PUBLISHABLE_KEY = cls.RAZORPAY_KEY_ID
        cls.STRIPE_WEBHOOK_SECRET = cls.RAZORPAY_WEBHOOK_SECRET

        cls.LANGFUSE_SECRET_KEY = get_env_value("LANGFUSE_SECRET_KEY")
        cls.LANGFUSE_PUBLIC_KEY = get_env_value("LANGFUSE_PUBLIC_KEY")
        cls.LANGFUSE_HOST = get_env_value(
            "LANGFUSE_HOST",
            "https://cloud.langfuse.com",
            allow_placeholder=True,
        )
        return cls

    @classmethod
    def get_provider_key_map(cls):
        cls.refresh()
        return {
            "openai": cls.OPENAI_API_KEY,
            "anthropic": cls.ANTHROPIC_API_KEY,
            "google": cls.GOOGLE_API_KEY,
        }

    @classmethod
    def get_provider_model(cls, provider_name):
        cls.refresh()
        return {
            "openai": cls.OPENAI_MODEL,
            "anthropic": cls.ANTHROPIC_MODEL,
            "google": cls.GOOGLE_MODEL,
        }.get(provider_name.lower())

    @classmethod
    def resolve_llm_provider(cls):
        """
        Resolve the configured provider to a usable provider/key pair.

        Returns:
            dict: provider_name, api_key, used_fallback, warning
        """
        cls.refresh()

        raw_provider = get_env_value("LLM_PROVIDER", "openai", allow_placeholder=True)
        raw_provider = raw_provider.lower() if raw_provider else "openai"
        provider_name = raw_provider if raw_provider in _SUPPORTED_LLM_PROVIDERS else "openai"
        warning = None

        if raw_provider not in _SUPPORTED_LLM_PROVIDERS:
            warning = (
                f"Unsupported LLM_PROVIDER '{raw_provider}'. "
                "Falling back to the default provider selection."
            )

        provider_map = cls.get_provider_key_map()
        api_key = provider_map.get(provider_name)
        if api_key:
            return {
                "provider_name": provider_name,
                "api_key": api_key,
                "used_fallback": False,
                "warning": warning,
            }

        missing_key_warning = (
            f"Preferred provider '{provider_name}' does not have a usable API key configured."
        )
        warning = f"{warning} {missing_key_warning}".strip() if warning else missing_key_warning

        for fallback_name, fallback_key in provider_map.items():
            if fallback_key:
                return {
                    "provider_name": fallback_name,
                    "api_key": fallback_key,
                    "used_fallback": fallback_name != provider_name,
                    "warning": warning,
                }

        return {
            "provider_name": provider_name,
            "api_key": None,
            "used_fallback": False,
            "warning": warning,
        }

    @classmethod
    def validate(cls):
        """Check for missing critical keys."""
        cls.refresh()
        if any(cls.get_provider_key_map().values()):
            return True

        print("Warning: No usable LLM API key found.")
        print("Placeholder values from .env.example are treated as missing.")
        print("Please update .env with a real OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.")
        return False


Config.refresh()

def setup_logging(level="INFO"):
    """Configure structured JSON logging."""
    import logging
    import sys
    
    # Create a handler that writes to stdout
    handler = logging.StreamHandler(sys.stdout)
    
    # Use a custom formatter for JSON output
    class JsonFormatter(logging.Formatter):
        def format(self, record):
            log_record = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "message": record.getMessage(),
                "module": record.module,
                "function": record.funcName,
            }
            if hasattr(record, "request_id"):
                log_record["request_id"] = record.request_id
            return json.dumps(log_record)

    handler.setFormatter(JsonFormatter())
    
    # Configure root logger
    root = logging.getLogger()
    root.setLevel(level)
    # Remove existing handlers to avoid duplication
    if root.handlers:
        for h in root.handlers:
            root.removeHandler(h)
    root.addHandler(handler)
