"""
Single integration point for the org's LLMaaS gateway.

We don't yet know its exact wire format, so this assumes the common case:
an internal gateway that proxies to an underlying model behind an
OpenAI-compatible `/chat/completions` and `/embeddings` API (this is how
most internal "LLMaaS" services are built, since it lets every team keep
using the standard OpenAI SDK / LangChain integration).

If that assumption is wrong once you have the real docs, THIS FILE is the
only thing that needs to change. Nothing else in app/agents/ imports
`langchain_openai` directly -- every agent node calls `get_chat_model()` /
`get_embeddings_model()` from here. If the real API is a genuinely custom
REST schema (not OpenAI-shaped), replace the bodies of these two functions
with a small `httpx` client that implements the same LangChain interfaces
(`BaseChatModel` / `Embeddings`), or wrap calls directly inside
app/agents/graph.py nodes instead of going through LangChain at all --
either way, callers don't need to change.
"""
from functools import lru_cache

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.config import get_settings

settings = get_settings()


@lru_cache
def get_chat_model(temperature: float = 0.0) -> ChatOpenAI:
    """Returns a LangChain chat model bound to the LLMaaS gateway. Agent
    nodes call `.bind_tools([...])` on this before invoking it -- see
    app/agents/graph.py."""
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=temperature,
    )


@lru_cache
def get_embeddings_model() -> OpenAIEmbeddings:
    """Used by the duplicate-material similarity tool (app/agents/tools.py)
    to catch near-duplicate descriptions that exact string matching misses
    (anomaly A3)."""
    return OpenAIEmbeddings(
        model=settings.llm_embedding_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
