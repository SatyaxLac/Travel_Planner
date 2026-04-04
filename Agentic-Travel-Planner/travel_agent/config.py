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
_SUPPORTED_FLIGHT_PROVIDERS = ("local", "serpapi", "amadeus", "duffel", "mock")
_SUPPORTED_HOTEL_PROVIDERS = ("local", "serpapi")
_SUPPORTED_TRAIN_PROVIDERS = ("local", "rapidapi", "mock")
_DEFAULT_OPENAI_MODEL = "gpt-4o"
_DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
_DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash"
_DEFAULT_DUFFEL_BASE_URL = "https://api.duffel.com"
_DEFAULT_DUFFEL_VERSION = "v2"
_DEFAULT_DUFFEL_TIMEOUT_SECONDS = 15
_DEFAULT_AMADEUS_ENV = "test"
_DEFAULT_FLIGHT_PROVIDER = "local"
_DEFAULT_HOTEL_PROVIDER = "local"
_DEFAULT_TRAIN_PROVIDER = "local"
_DEFAULT_SERPAPI_BASE_URL = "https://serpapi.com/search.json"
_DEFAULT_SERPAPI_TIMEOUT_SECONDS = 20
_DEFAULT_SERPAPI_GL = "in"
_DEFAULT_SERPAPI_HL = "en"
_DEFAULT_SERPAPI_CURRENCY = "INR"
_DEFAULT_TRAIN_API_BASE_URL = "https://irctc1.p.rapidapi.com"
_DEFAULT_TRAIN_RAPIDAPI_HOST = "irctc1.p.rapidapi.com"
_DEFAULT_TRAIN_SEARCH_PATH = "/api/v3/trainBetweenStations"
_DEFAULT_TRAIN_STATION_SEARCH_PATH = "/api/v1/searchStation"
_DEFAULT_TRAIN_TIMEOUT_SECONDS = 15
_DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"
_DEFAULT_ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128"
_PLACEHOLDER_VALUES = {
    "your_openai_api_key_here",
    "your_anthropic_api_key_here",
    "your_google_api_key_here",
    "your_openai_model_here",
    "your_anthropic_model_here",
    "your_google_model_here",
    "your_amadeus_api_key_here",
    "your_amadeus_api_secret_here",
    "your_duffel_api_token_here",
    "your_serpapi_api_key_here",
    "your_train_api_key_here",
    "your_rapidapi_key_here",
    "your_elevenlabs_api_key_here",
    "your_elevenlabs_voice_id_here",
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


def bootstrap_environment(force=False):
    """Load the project .env file, reloading when requested."""
    global _ENV_BOOTSTRAP_ATTEMPTED, _DOTENV_WARNING_EMITTED

    if _ENV_BOOTSTRAP_ATTEMPTED and not force:
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

    _load_dotenv(_ENV_PATH, override=force)
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


def get_int_env_value(name, default, min_value=None, max_value=None):
    """Read and clamp an integer environment variable."""
    raw_value = get_env_value(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return default

    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def get_float_env_value(name, default, min_value=None, max_value=None):
    """Read and clamp a float environment variable."""
    raw_value = get_env_value(name)
    if raw_value is None:
        return default

    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return default

    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def get_bool_env_value(name, default=False):
    """Read a boolean environment variable."""
    raw_value = get_env_value(name, allow_placeholder=True)
    if raw_value is None:
        return default

    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


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
    FLIGHT_PROVIDER = _DEFAULT_FLIGHT_PROVIDER
    FLIGHT_API_KEY = None
    FLIGHT_API_SECRET = None
    DUFFEL_API_TOKEN = None
    DUFFEL_API_BASE_URL = _DEFAULT_DUFFEL_BASE_URL
    DUFFEL_VERSION = _DEFAULT_DUFFEL_VERSION
    DUFFEL_TIMEOUT_SECONDS = _DEFAULT_DUFFEL_TIMEOUT_SECONDS
    AMADEUS_ENV = _DEFAULT_AMADEUS_ENV
    HOTEL_PROVIDER = _DEFAULT_HOTEL_PROVIDER
    SERPAPI_API_KEY = None
    SERPAPI_BASE_URL = _DEFAULT_SERPAPI_BASE_URL
    SERPAPI_TIMEOUT_SECONDS = _DEFAULT_SERPAPI_TIMEOUT_SECONDS
    SERPAPI_GL = _DEFAULT_SERPAPI_GL
    SERPAPI_HL = _DEFAULT_SERPAPI_HL
    SERPAPI_CURRENCY = _DEFAULT_SERPAPI_CURRENCY
    TRAIN_PROVIDER = _DEFAULT_TRAIN_PROVIDER
    TRAIN_API_KEY = None
    TRAIN_API_BASE_URL = None
    TRAIN_RAPIDAPI_HOST = _DEFAULT_TRAIN_RAPIDAPI_HOST
    TRAIN_SEARCH_PATH = _DEFAULT_TRAIN_SEARCH_PATH
    TRAIN_STATION_SEARCH_PATH = _DEFAULT_TRAIN_STATION_SEARCH_PATH
    TRAIN_TIMEOUT_SECONDS = _DEFAULT_TRAIN_TIMEOUT_SECONDS
    ELEVENLABS_API_KEY = None
    ELEVENLABS_VOICE_ID = None
    ELEVENLABS_MODEL_ID = _DEFAULT_ELEVENLABS_MODEL_ID
    ELEVENLABS_OUTPUT_FORMAT = _DEFAULT_ELEVENLABS_OUTPUT_FORMAT
    ELEVENLABS_STABILITY = 0.45
    ELEVENLABS_SIMILARITY_BOOST = 0.8
    ELEVENLABS_STYLE = 0.35
    ELEVENLABS_SPEED = 1.0
    ELEVENLABS_USE_SPEAKER_BOOST = True
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
        bootstrap_environment(force=True)

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

        cls.DUFFEL_API_TOKEN = get_env_value("DUFFEL_API_TOKEN")
        preferred_flight_provider = get_env_value(
            "FLIGHT_PROVIDER",
            _DEFAULT_FLIGHT_PROVIDER,
            allow_placeholder=True,
        )
        if preferred_flight_provider:
            preferred_flight_provider = preferred_flight_provider.lower()
        else:
            preferred_flight_provider = _DEFAULT_FLIGHT_PROVIDER
        if preferred_flight_provider not in _SUPPORTED_FLIGHT_PROVIDERS:
            preferred_flight_provider = _DEFAULT_FLIGHT_PROVIDER

        cls.FLIGHT_PROVIDER = preferred_flight_provider
        cls.FLIGHT_API_KEY = get_env_value("FLIGHT_API_KEY")
        cls.FLIGHT_API_SECRET = get_env_value("FLIGHT_API_SECRET")
        cls.DUFFEL_API_BASE_URL = get_env_value(
            "DUFFEL_API_BASE_URL",
            _DEFAULT_DUFFEL_BASE_URL,
            allow_placeholder=True,
        )
        cls.DUFFEL_VERSION = get_env_value(
            "DUFFEL_VERSION",
            _DEFAULT_DUFFEL_VERSION,
            allow_placeholder=True,
        )
        cls.DUFFEL_TIMEOUT_SECONDS = get_int_env_value(
            "DUFFEL_TIMEOUT_SECONDS",
            _DEFAULT_DUFFEL_TIMEOUT_SECONDS,
            min_value=2,
            max_value=60,
        )
        cls.AMADEUS_ENV = get_env_value(
            "AMADEUS_ENV",
            _DEFAULT_AMADEUS_ENV,
            allow_placeholder=True,
        )
        hotel_provider = get_env_value(
            "HOTEL_PROVIDER",
            _DEFAULT_HOTEL_PROVIDER,
            allow_placeholder=True,
        )
        hotel_provider = hotel_provider.lower() if hotel_provider else _DEFAULT_HOTEL_PROVIDER
        if hotel_provider not in _SUPPORTED_HOTEL_PROVIDERS:
            hotel_provider = _DEFAULT_HOTEL_PROVIDER
        cls.HOTEL_PROVIDER = hotel_provider
        cls.SERPAPI_API_KEY = get_env_value("SERPAPI_API_KEY")
        cls.SERPAPI_BASE_URL = get_env_value(
            "SERPAPI_BASE_URL",
            _DEFAULT_SERPAPI_BASE_URL,
            allow_placeholder=True,
        )
        cls.SERPAPI_TIMEOUT_SECONDS = get_int_env_value(
            "SERPAPI_TIMEOUT_SECONDS",
            _DEFAULT_SERPAPI_TIMEOUT_SECONDS,
            min_value=2,
            max_value=60,
        )
        cls.SERPAPI_GL = get_env_value(
            "SERPAPI_GL",
            _DEFAULT_SERPAPI_GL,
            allow_placeholder=True,
        )
        cls.SERPAPI_HL = get_env_value(
            "SERPAPI_HL",
            _DEFAULT_SERPAPI_HL,
            allow_placeholder=True,
        )
        cls.SERPAPI_CURRENCY = get_env_value(
            "SERPAPI_CURRENCY",
            _DEFAULT_SERPAPI_CURRENCY,
            allow_placeholder=True,
        )
        train_provider = get_env_value("TRAIN_PROVIDER", _DEFAULT_TRAIN_PROVIDER, allow_placeholder=True)
        train_provider = train_provider.lower() if train_provider else _DEFAULT_TRAIN_PROVIDER
        if train_provider not in _SUPPORTED_TRAIN_PROVIDERS:
            train_provider = _DEFAULT_TRAIN_PROVIDER
        elif train_provider == _DEFAULT_TRAIN_PROVIDER and get_env_value("TRAIN_API_KEY"):
            train_provider = "rapidapi"
        cls.TRAIN_PROVIDER = train_provider
        cls.TRAIN_API_KEY = get_env_value("TRAIN_API_KEY")
        cls.TRAIN_API_BASE_URL = get_env_value(
            "TRAIN_API_BASE_URL",
            _DEFAULT_TRAIN_API_BASE_URL,
            allow_placeholder=True,
        )
        cls.TRAIN_RAPIDAPI_HOST = get_env_value(
            "TRAIN_RAPIDAPI_HOST",
            _DEFAULT_TRAIN_RAPIDAPI_HOST,
            allow_placeholder=True,
        )
        cls.TRAIN_SEARCH_PATH = get_env_value(
            "TRAIN_SEARCH_PATH",
            _DEFAULT_TRAIN_SEARCH_PATH,
            allow_placeholder=True,
        )
        cls.TRAIN_STATION_SEARCH_PATH = get_env_value(
            "TRAIN_STATION_SEARCH_PATH",
            _DEFAULT_TRAIN_STATION_SEARCH_PATH,
            allow_placeholder=True,
        )
        cls.TRAIN_TIMEOUT_SECONDS = get_int_env_value(
            "TRAIN_TIMEOUT_SECONDS",
            _DEFAULT_TRAIN_TIMEOUT_SECONDS,
            min_value=2,
            max_value=60,
        )
        cls.ELEVENLABS_API_KEY = get_env_value("ELEVENLABS_API_KEY")
        cls.ELEVENLABS_VOICE_ID = get_env_value("ELEVENLABS_VOICE_ID")
        cls.ELEVENLABS_MODEL_ID = get_env_value(
            "ELEVENLABS_MODEL_ID",
            _DEFAULT_ELEVENLABS_MODEL_ID,
            allow_placeholder=True,
        )
        cls.ELEVENLABS_OUTPUT_FORMAT = get_env_value(
            "ELEVENLABS_OUTPUT_FORMAT",
            _DEFAULT_ELEVENLABS_OUTPUT_FORMAT,
            allow_placeholder=True,
        )
        cls.ELEVENLABS_STABILITY = get_float_env_value(
            "ELEVENLABS_STABILITY",
            0.45,
            min_value=0.0,
            max_value=1.0,
        )
        cls.ELEVENLABS_SIMILARITY_BOOST = get_float_env_value(
            "ELEVENLABS_SIMILARITY_BOOST",
            0.8,
            min_value=0.0,
            max_value=1.0,
        )
        cls.ELEVENLABS_STYLE = get_float_env_value(
            "ELEVENLABS_STYLE",
            0.35,
            min_value=0.0,
            max_value=1.0,
        )
        cls.ELEVENLABS_SPEED = get_float_env_value(
            "ELEVENLABS_SPEED",
            1.0,
            min_value=0.7,
            max_value=1.2,
        )
        cls.ELEVENLABS_USE_SPEAKER_BOOST = get_bool_env_value(
            "ELEVENLABS_USE_SPEAKER_BOOST",
            True,
        )
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
