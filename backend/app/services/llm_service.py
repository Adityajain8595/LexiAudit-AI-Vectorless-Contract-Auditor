import re
import json
from typing import List, Type, TypeVar, Dict, Optional, Any
from pydantic import BaseModel
from langchain_groq import ChatGroq
from app.core import settings

T = TypeVar("T", bound=BaseModel)

# Groq LLM inference service
class GroqLLMService:
    def __init__(self):
        self._clients: Dict[str, ChatGroq] = {}
        self._usage: Dict[str, int] = {}

    def _record_usage(self, response: Any):
        try:
            meta = getattr(response, "response_metadata", {}) or {}
            usage = getattr(response, "usage_metadata", None) or meta.get("token_usage", {})
            if usage:
                inp = usage.get("input_tokens") or usage.get("prompt_tokens", 0)
                out = usage.get("output_tokens") or usage.get("completion_tokens", 0)
                tot = usage.get("total_tokens") or (inp + out)
                self._usage = {"input": int(inp), "output": int(out), "total": int(tot)}
        except Exception:
            pass

    def get_last_usage(self) -> Dict[str, int]:
        return dict(self._usage)

    # Instantiate or reuse cached client
    def get_llm(self, model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> ChatGroq:
        name = model or settings.PRIMARY_GROQ_MODEL
        key = f"{name}_{temperature}_{max_tokens}"
        if key not in self._clients:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is not configured in settings.")
            self._clients[key] = ChatGroq(
                model=name,
                api_key=settings.GROQ_API_KEY,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        return self._clients[key]

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

    # Chat completion with model fallback
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None
    ) -> str:
        primary = model or settings.PRIMARY_GROQ_MODEL
        fallback = settings.FAST_GROQ_MODEL

        try:
            llm = self.get_llm(model=primary, temperature=temperature, max_tokens=max_tokens)
            res = await llm.ainvoke(messages)
            self._record_usage(res)
            return str(res.content).strip()
        except Exception:
            llm = self.get_llm(model=fallback, temperature=temperature, max_tokens=max_tokens)
            res = await llm.ainvoke(messages)
            self._record_usage(res)
            return str(res.content).strip()

    @classmethod
    def _coerce_schema(cls, json_str: str, schema_cls: Type[T]) -> T:
        try:
            data = json.loads(json_str)
        except Exception:
            return schema_cls.model_validate_json(json_str)

        if isinstance(data, dict):
            # Normalize missing clause objects
            missing = data.get("missing_clauses")
            if isinstance(missing, list):
                norm = []
                for item in missing:
                    if isinstance(item, str):
                        norm.append({
                            "clause_name": item,
                            "severity": "MEDIUM",
                            "impact_description": f"Standard {item} clause omitted from agreement.",
                            "suggested_language": ""
                        })
                    else:
                        norm.append(item)
                data["missing_clauses"] = norm

            # Normalize clause name in risks
            risks = data.get("risk_analysis")
            if isinstance(risks, list):
                for r in risks:
                    if isinstance(r, dict):
                        if (not r.get("clause_name") or r.get("clause_name") == "Clause") and r.get("section_title"):
                            r["clause_name"] = r["section_title"]

            return schema_cls.model_validate(data)
        return schema_cls.model_validate_json(json_str)

    # Structured JSON output extraction
    async def structured(
        self,
        messages: List[Dict[str, str]],
        pydantic_cls: Type[T],
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None
    ) -> T:
        primary = model or settings.PRIMARY_GROQ_MODEL
        fallback = settings.FAST_GROQ_MODEL

        json_msgs = list(messages)
        if not any("json" in m.get("content", "").lower() for m in json_msgs):
            json_msgs.insert(0, {
                "role": "system",
                "content": "You are a legal AI assistant. Output strictly in valid JSON format conforming to schema."
            })

        # Structured output via primary model
        try:
            llm = self.get_llm(model=primary, temperature=temperature, max_tokens=max_tokens)
            structured_llm = llm.with_structured_output(pydantic_cls, method="json_mode")
            res = await structured_llm.ainvoke(json_msgs)
            if isinstance(res, pydantic_cls):
                return res
            if isinstance(res, dict):
                return pydantic_cls.model_validate(res)
        except Exception:
            pass

        # Direct invoke with fallback model
        try:
            llm_fallback = self.get_llm(model=fallback, temperature=temperature, max_tokens=max_tokens)
            res = await llm_fallback.ainvoke(json_msgs)
            clean_json = self._extract_json(str(res.content))
            if clean_json:
                return self._coerce_schema(clean_json, pydantic_cls)
        except Exception:
            pass

        return pydantic_cls.model_validate({})

_engine = GroqLLMService()

async def llm_chat(messages: List[Dict[str, str]], model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> str:
    return await _engine.chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)

async def llm_structured(messages: List[Dict[str, str]], pydantic_cls: Type[T], model: Optional[str] = None, temperature: float = 0.0, max_tokens: Optional[int] = None) -> T:
    return await _engine.structured(messages, pydantic_cls, model=model, temperature=temperature, max_tokens=max_tokens)

def get_last_token_usage() -> Dict[str, int]:
    return _engine.get_last_usage()
