"""
Groq Key Rotator
================
Production-grade API key rotation for Groq.
Automatically cycles through all configured keys when one hits its
rate limit or quota. Add more keys to GROQ_API_KEYS in .env at any time
without any code changes.

Usage:
    from app.services.groq_client import get_groq_client, call_with_rotation

    # Option A: Manual client (for simple cases)
    client = get_groq_client()

    # Option B: Auto-rotating call (recommended for production)
    response = call_with_rotation(
        messages=[...], model="llama-3.1-70b-versatile", ...
    )
"""

import threading
from groq import Groq, RateLimitError, AuthenticationError
from app.config import get_settings

settings = get_settings()

# Thread-safe key index
_lock = threading.Lock()
_current_key_index = 0


def _get_keys() -> list[str]:
    """Return all configured Groq API keys."""
    keys = settings.get_groq_keys()
    if not keys:
        raise ValueError(
            "No Groq API keys configured. "
            "Set GROQ_API_KEYS=key1,key2 in .env"
        )
    return keys


def get_groq_client(key_index: int = 0) -> Groq:
    """Get a Groq client for the given key index."""
    keys = _get_keys()
    idx = key_index % len(keys)
    return Groq(api_key=keys[idx])


def call_with_rotation(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 3000,
    response_format: dict | None = None,
) -> str:
    """
    Call Groq with automatic key rotation on quota/rate limit errors.

    Tries each key in sequence. If all keys are exhausted, raises the
    last exception so the caller can handle fallback gracefully.

    Returns the raw response content string.
    """
    global _current_key_index

    keys = _get_keys()
    model_name = model or settings.model_name
    last_error = None

    # Try each key, starting from current index (allows sticky key usage)
    for attempt in range(len(keys)):
        with _lock:
            key_idx = _current_key_index % len(keys)

        current_key = keys[key_idx]
        key_label = f"key[{key_idx + 1}/{len(keys)}] ...{current_key[-6:]}"

        try:
            print(f"[GroqRotator] Using {key_label}")
            client = Groq(api_key=current_key)

            kwargs = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content.strip()
            print(f"[GroqRotator] Success with {key_label}")
            return content

        except (RateLimitError,) as e:
            print(f"[GroqRotator] Rate limit on {key_label}: {e}")
            last_error = e
            # Rotate to next key
            with _lock:
                _current_key_index = (_current_key_index + 1) % len(keys)

        except AuthenticationError as e:
            print(f"[GroqRotator] Auth error on {key_label}: {e}")
            last_error = e
            # Invalid key — skip permanently this session
            with _lock:
                _current_key_index = (_current_key_index + 1) % len(keys)

        except Exception as e:
            # Non-quota errors (model error, network) — do not rotate
            print(f"[GroqRotator] Non-rotatable error on {key_label}: {e}")
            raise

    # All keys exhausted
    print(f"[GroqRotator] All {len(keys)} keys exhausted. Last error: {last_error}")
    raise last_error or RuntimeError("All Groq API keys failed")
