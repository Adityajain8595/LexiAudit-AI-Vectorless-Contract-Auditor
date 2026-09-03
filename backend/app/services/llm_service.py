import re
from typing import List, Type, TypeVar, Dict, Optional
from pydantic import BaseModel
from langchain_groq import ChatGroq
from app.core import settings

T = TypeVar("T", bound=BaseModel)

class GroqLLMService:
    """
    Enterprise High-Throughput LLM Engine powered exclusively by Groq.
    - Primary Model: openai/gpt-oss-120b (Deep legal reasoning, grounded RAG synthesis, and comprehensive contract audits)
    - Fast / Fallback Model: openai/gpt-oss-20b (Tree search, query rewrite, follow-ups, guardrails, and sub-second fallback)
    """
    def __init__(self):
        self._clients: Dict[str, ChatGroq] = {}

    def get_llm(self, model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> ChatGroq:
        model_name = model or settings.PRIMARY_GROQ_MODEL
        cache_key = f"{model_name}_{temperature}_{max_tokens}"
        if cache_key not in self._clients:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is not configured in settings.")
            self._clients[cache_key] = ChatGroq(
                model=model_name,
                api_key=settings.GROQ_API_KEY,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        return self._clients[cache_key]

    @staticmethod
    def _extract_json(text: str) -> str:
        raw = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
        if match:
            raw = match.group(1).strip()
        else:
            s = raw.find("{")
            e = raw.rfind("}")
            if s != -1 and e != -1 and e > s:
                raw = raw[s:e+1]
        raw = raw.strip().strip("`").strip()
        if "{" in raw and not raw.startswith("{"):
            raw = raw[raw.find("{"):]
        if "}" in raw and not raw.endswith("}"):
            raw = raw[:raw.rfind("}")+1]
        return raw

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None
    ) -> str:
        primary_model = model or settings.PRIMARY_GROQ_MODEL
        fallback_model = settings.FAST_GROQ_MODEL

        try:
            llm = self.get_llm(model=primary_model, temperature=temperature, max_tokens=max_tokens)
            response = await llm.ainvoke(messages)
            return str(response.content).strip()
        except Exception as err:
            if primary_model != fallback_model:
                print(f"Groq chat on {primary_model} failed: {err}, falling back to {fallback_model}...")
                fallback_llm = self.get_llm(model=fallback_model, temperature=temperature, max_tokens=max_tokens)
                response = await fallback_llm.ainvoke(messages)
                return str(response.content).strip()
            raise err

    async def structured(
        self,
        messages: List[Dict[str, str]],
        pydantic_cls: Type[T],
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None
    ) -> T:
        primary_model = model or settings.PRIMARY_GROQ_MODEL
        fallback_model = settings.FAST_GROQ_MODEL

        # Enforce json keyword for Groq json_mode
        json_messages = list(messages)
        if not any("json" in m.get("content", "").lower() for m in json_messages):
            json_messages.insert(0, {
                "role": "system",
                "content": "You are a legal AI assistant. Output strictly in valid JSON format conforming to the requested schema."
            })

        # Attempt 1: json_mode with primary model
        try:
            llm = self.get_llm(model=primary_model, temperature=temperature, max_tokens=max_tokens)
            structured_llm = llm.with_structured_output(pydantic_cls, method="json_mode")
            result = await structured_llm.ainvoke(json_messages)
            if isinstance(result, pydantic_cls):
                return result
            if isinstance(result, dict):
                return pydantic_cls.model_validate(result)
        except Exception as err:
            err_str = str(err)
            if "{" in err_str and "}" in err_str:
                try:
                    cleaned_json = self._extract_json(err_str)
                    return pydantic_cls.model_validate_json(cleaned_json)
                except Exception:
                    pass

        # Attempt 2: Direct invoke with primary model
        try:
            llm_primary = self.get_llm(model=primary_model, temperature=temperature, max_tokens=max_tokens)
            resp = await llm_primary.ainvoke(json_messages)
            raw_content = str(resp.content)
            cleaned = self._extract_json(raw_content)
            if cleaned:
                return pydantic_cls.model_validate_json(cleaned)
        except Exception:
            pass

        # Attempt 3: json_mode with fallback model
        try:
            fallback_llm = self.get_llm(model=fallback_model, temperature=temperature, max_tokens=max_tokens)
            structured_fallback = fallback_llm.with_structured_output(pydantic_cls, method="json_mode")
            result = await structured_fallback.ainvoke(json_messages)
            if isinstance(result, pydantic_cls):
                return result
            if isinstance(result, dict):
                return pydantic_cls.model_validate(result)
        except Exception as err2:
            err_str2 = str(err2)
            if "{" in err_str2 and "}" in err_str2:
                try:
                    cleaned_json = self._extract_json(err_str2)
                    return pydantic_cls.model_validate_json(cleaned_json)
                except Exception:
                    pass

        # Attempt 4: Direct invoke with fallback model
        try:
            llm_direct = self.get_llm(model=fallback_model, temperature=temperature, max_tokens=max_tokens)
            resp = await llm_direct.ainvoke(messages)
            raw_content = str(resp.content)

            # RAGFollowUpOutput list parsing
            if pydantic_cls.__name__ == "RAGFollowUpOutput" and "{" not in raw_content:
                lines = [line.strip().strip("*").strip() for line in raw_content.split("\n") if line.strip()]
                queries = []
                for line in lines:
                    cleaned_q = re.sub(r"^(?:\d+[\.\)]|\*|-)\s*", "", line).strip()
                    cleaned_q = re.sub(r"^\*\*[^*]+\*\*\s*:?\s*", "", cleaned_q).strip()
                    if cleaned_q and len(cleaned_q) > 8:
                        queries.append(cleaned_q)
                if queries:
                    return pydantic_cls.model_validate({"suggested_queries": queries[:3]})

            cleaned = self._extract_json(raw_content)
            if cleaned:
                return pydantic_cls.model_validate_json(cleaned)
        except Exception:
            pass

        # Attempt 5: Safe default instantiation
        try:
            return pydantic_cls()
        except Exception:
            try:
                return pydantic_cls.model_validate({})
            except Exception as final_err:
                raise RuntimeError(f"Failed to produce structured output for {pydantic_cls.__name__}: {final_err}")

_groq_engine = GroqLLMService()

async def llm_chat(messages: List[Dict[str, str]], model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> str:
    return await _groq_engine.chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)

async def llm_structured(messages: List[Dict[str, str]], pydantic_cls: Type[T], model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> T:
    return await _groq_engine.structured(messages, pydantic_cls, model=model, temperature=temperature, max_tokens=max_tokens)
