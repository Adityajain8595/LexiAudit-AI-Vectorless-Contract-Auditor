import time
from typing import Optional, Dict, Any, List
from .config import settings
from langfuse import Langfuse

class NullSpan:
    """Mock span for zero-overhead local development or offline fallback."""
    def __init__(self, name: str = ""):
        self.name = name
    def end(self, *args, **kwargs):
        pass
    def update(self, *args, **kwargs):
        pass
    def span(self, *args, **kwargs):
        return self
    def generation(self, *args, **kwargs):
        return self
    def event(self, *args, **kwargs):
        pass

class NullTrace(NullSpan):
    """Mock trace."""
    id = "mock-trace-id"
    def score(self, *args, **kwargs):
        pass

class SpanWrapper:
    """Universal adapter for Langfuse spans and observations across SDK versions."""
    def __init__(self, raw_span: Any, name: str = ""):
        self._raw = raw_span
        self.name = name
        self.id = getattr(raw_span, "id", getattr(raw_span, "trace_id", "mock-span-id"))

    def end(self, output: Any = None, **kwargs):
        if hasattr(self._raw, "update") and output is not None:
            try:
                self._raw.update(output=output)
            except Exception:
                pass
        if hasattr(self._raw, "end"):
            try:
                self._raw.end()
            except Exception:
                pass

    def update(self, *args, **kwargs):
        if hasattr(self._raw, "update"):
            try:
                self._raw.update(*args, **kwargs)
            except Exception:
                pass

    def span(self, name: str, input: Optional[Any] = None, metadata: Optional[Dict[str, Any]] = None, **kwargs):
        return _telemetry_manager.create_span(self._raw, name, input_data=input, metadata=metadata)

    def generation(self, name: str, model: str = "", input: Any = None, output: Any = None, **kwargs):
        return _telemetry_manager.log_generation_event(self._raw, name, model=model, prompt=input, completion=output, **kwargs)

    def start_observation(self, *args, **kwargs):
        if hasattr(self._raw, "start_observation"):
            try:
                return SpanWrapper(self._raw.start_observation(*args, **kwargs))
            except Exception:
                pass
        return NullSpan()

class TelemetryManager:
    """
    Enterprise Observability & Tracing Manager for Langfuse.
    """
    def __init__(self):
        self._client = None
        self._initialized = False

    def get_client(self):
        if not self._initialized:
            if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
                try:
                    self._client = Langfuse(
                        public_key=settings.LANGFUSE_PUBLIC_KEY,
                        secret_key=settings.LANGFUSE_SECRET_KEY,
                        host=settings.langfuse_server_url
                    )
                except Exception as e:
                    print(f"Langfuse init note: {e}")
                    self._client = None
            self._initialized = True
        return self._client

    def create_trace(
        self,
        name: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ):
        client = self.get_client()
        if not client:
            return NullTrace(name)
        try:
            meta = {
                **(metadata or {}),
                "tags": tags or ["production", "legal-contract-auditor"]
            }
            if session_id:
                meta["session_id"] = session_id
            if user_id:
                meta["user_id"] = user_id

            if hasattr(client, "trace"):
                trace_obj = client.trace(
                    name=name,
                    session_id=session_id,
                    user_id=user_id,
                    metadata=meta,
                    tags=tags or ["production", "legal-contract-auditor"]
                )
                return SpanWrapper(trace_obj, name)
            elif hasattr(client, "start_observation"):
                obs = client.start_observation(
                    name=name,
                    as_type="span",
                    metadata=meta
                )
                return SpanWrapper(obs, name)
        except Exception as e:
            print(f"Langfuse trace creation note: {e}")
        return NullTrace(name)

    def create_span(
        self,
        trace_or_parent,
        name: str,
        input_data: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        if not trace_or_parent or isinstance(trace_or_parent, NullSpan):
            return NullSpan(name)
        raw = getattr(trace_or_parent, "_raw", trace_or_parent)
        try:
            if hasattr(raw, "start_observation"):
                obs = raw.start_observation(
                    name=name,
                    as_type="span",
                    input=input_data,
                    metadata=metadata or {}
                )
                return SpanWrapper(obs, name)
            elif hasattr(raw, "span"):
                return raw.span(
                    name=name,
                    input=input_data,
                    metadata=metadata or {},
                    start_time=time.time()
                )
        except Exception as e:
            print(f"Langfuse create_span error: {e}")
        return NullSpan(name)

    def log_generation_event(
        self,
        trace_or_parent,
        name: str,
        model: str,
        prompt: Any,
        completion: Any,
        usage: Optional[Dict[str, int]] = None,
        model_parameters: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        if not trace_or_parent or isinstance(trace_or_parent, NullSpan):
            return NullSpan(name)
        raw = getattr(trace_or_parent, "_raw", trace_or_parent)
        try:
            if hasattr(raw, "start_observation"):
                gen = raw.start_observation(
                    name=name,
                    as_type="generation",
                    model=model,
                    input=prompt,
                    output=completion,
                    model_parameters=model_parameters or {},
                    metadata=metadata or {}
                )
                if hasattr(gen, "update"):
                    gen.update(output=completion, usage_details=usage or {})
                if hasattr(gen, "end"):
                    gen.end()
                return SpanWrapper(gen, name)
            elif hasattr(raw, "generation"):
                return raw.generation(
                    name=name,
                    model=model,
                    input=prompt,
                    output=completion,
                    usage=usage or {},
                    model_parameters=model_parameters or {},
                    metadata=metadata or {}
                )
        except Exception as e:
            print(f"Langfuse generation error: {e}")
        return NullSpan(name)

    def submit_score(
        self,
        trace_id: str,
        score: float,
        comment: Optional[str] = None,
        name: str = "eval_score"
    ):
        client = self.get_client()
        if not client or trace_id == "mock-trace-id":
            return
        try:
            if hasattr(client, "create_score"):
                client.create_score(
                    name=name,
                    value=score,
                    trace_id=trace_id,
                    comment=comment
                )
            elif hasattr(client, "score"):
                client.score(
                    trace_id=trace_id,
                    name=name,
                    value=score,
                    comment=comment
                )
        except Exception as e:
            print(f"Error logging eval score to Langfuse: {e}")

    def flush(self):
        client = self.get_client()
        if client:
            try:
                client.flush()
            except Exception:
                pass

_telemetry_manager = TelemetryManager()

def get_langfuse():
    return _telemetry_manager.get_client()

def start_trace(name: str, session_id: Optional[str] = None, user_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, tags: Optional[List[str]] = None):
    return _telemetry_manager.create_trace(name, session_id, user_id, metadata, tags)

def start_span(trace_or_parent, name: str, input_data: Optional[Any] = None, metadata: Optional[Dict[str, Any]] = None):
    return _telemetry_manager.create_span(trace_or_parent, name, input_data, metadata)

def log_generation(trace_or_parent, name: str, model: str, prompt: Any, completion: Any, usage: Optional[Dict[str, int]] = None, model_parameters: Optional[Dict[str, Any]] = None, metadata: Optional[Dict[str, Any]] = None):
    return _telemetry_manager.log_generation_event(trace_or_parent, name, model, prompt, completion, usage, model_parameters, metadata)

def log_eval_score(trace_id: str, score: float, comment: Optional[str] = None, name: str = "eval_score"):
    return _telemetry_manager.submit_score(trace_id, score, comment, name)

def get_prompt_template(prompt_name: str, fallback_template: str) -> str:
    client = _telemetry_manager.get_client()
    if not client:
        return fallback_template
    try:
        prompt_obj = client.get_prompt(prompt_name)
        if prompt_obj and prompt_obj.prompt:
            return prompt_obj.prompt
    except Exception:
        pass
    return fallback_template

def flush_telemetry():
    _telemetry_manager.flush()
