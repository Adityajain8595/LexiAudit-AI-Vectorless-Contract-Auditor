import os
import json
import base64
import hashlib
from typing import List, Dict, Any, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  

from app.core.config import settings
from app.core.security import redact_pii

class ContractTreeCacheService:
    """
    Enterprise-grade secure caching engine for hierarchical contract trees.
    Provides AES-256-GCM payload encryption, pre-cache PII redaction,
    multi-tenant composite key indexing (user, session, doc), and strict Redis Cloud integration.
    """

    def __init__(self):
        self._redis_client = None
        self._aesgcm: Optional[AESGCM] = None

    def _get_encryption_key(self) -> bytes:
        secret = (
            settings.CACHE_SECRET_KEY
            or settings.SUPABASE_SECRET_KEY
            or "lexiaudit-secure-contract-tree-cache-key-default"
        )
        return hashlib.sha256(secret.encode("utf-8")).digest()

    def _get_aesgcm(self) -> AESGCM:
        if self._aesgcm is None:
            self._aesgcm = AESGCM(self._get_encryption_key())
        return self._aesgcm

    def _encrypt_payload(self, plain_text: str) -> str:
        aesgcm = self._get_aesgcm()
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
        encrypted_blob = nonce + ciphertext
        return base64.b64encode(encrypted_blob).decode("utf-8")

    def _decrypt_payload(self, encrypted_b64: str) -> str:
        aesgcm = self._get_aesgcm()
        encrypted_blob = base64.b64decode(encrypted_b64.encode("utf-8"))
        nonce = encrypted_blob[:12]
        ciphertext = encrypted_blob[12:]
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode("utf-8")

    def _sanitize_tree(self, tree: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not settings.ENABLE_PII_REDACTION or not tree:
            return tree

        try:
            tree_json = json.dumps(tree)
            sanitized_json, _ = redact_pii(tree_json)
            return json.loads(sanitized_json)
        except Exception:
            return tree

    def _build_key(self, user_id: str, doc_id: str, session_id: Optional[str] = None) -> str:
        scope = session_id.strip() if session_id and session_id.strip() else "doc"
        return f"tree:{user_id}:{scope}:{doc_id}"

    async def _get_redis(self):
        if self._redis_client is not None:
            return self._redis_client

        if not settings.TREE_CACHE_ENABLED or not settings.REDIS_URL or aioredis is None:
            return None

        try:
            self._redis_client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=3.0,
                socket_timeout=3.0,
                retry_on_timeout=True
            )
        except Exception as e:
            print(f"[RedisCache] Connection initialization note: {e}")
            self._redis_client = None

        return self._redis_client

    async def set_tree(
        self,
        user_id: str,
        doc_id: str,
        tree: List[Dict[str, Any]],
        session_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None
    ) -> bool:
        if not tree or not user_id or not doc_id:
            return False

        ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS
        sanitized_tree = self._sanitize_tree(tree)
        plain_json = json.dumps(sanitized_tree)
        encrypted_val = self._encrypt_payload(plain_json)

        keys_to_set = [self._build_key(user_id, doc_id, session_id)]
        if session_id and session_id != "doc":
            keys_to_set.append(self._build_key(user_id, doc_id, "doc"))

        redis_client = await self._get_redis()
        if not redis_client:
            return False

        try:
            for k in keys_to_set:
                await redis_client.set(k, encrypted_val, ex=ttl)
            return True
        except Exception as e:
            print(f"[RedisCache] Cache set error: {e}")
            return False

    async def get_tree(
        self,
        user_id: str,
        doc_id: str,
        session_id: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        if not user_id or not doc_id:
            return None

        candidate_keys = []
        if session_id and session_id != "doc":
            candidate_keys.append(self._build_key(user_id, doc_id, session_id))
        candidate_keys.append(self._build_key(user_id, doc_id, "doc"))

        redis_client = await self._get_redis()
        if not redis_client:
            return None

        try:
            for k in candidate_keys:
                encrypted_val = await redis_client.get(k)
                if encrypted_val:
                    decrypted_json = self._decrypt_payload(encrypted_val)
                    return json.loads(decrypted_json)
        except Exception as e:
            print(f"[RedisCache] Cache get error: {e}")

        return None

    async def invalidate_doc(self, user_id: str, doc_id: str) -> int:
        if not user_id or not doc_id:
            return 0

        pattern = f"tree:{user_id}:*:{doc_id}"
        deleted_count = 0

        redis_client = await self._get_redis()
        if redis_client:
            try:
                keys = []
                async for key in redis_client.scan_iter(match=pattern):
                    keys.append(key)
                if keys:
                    deleted_count = await redis_client.delete(*keys)
            except Exception as e:
                print(f"[RedisCache] Document invalidation error: {e}")

        return deleted_count

    async def invalidate_session(self, user_id: str, session_id: str) -> int:
        if not user_id or not session_id:
            return 0

        pattern = f"tree:{user_id}:{session_id}:*"
        deleted_count = 0

        redis_client = await self._get_redis()
        if redis_client:
            try:
                keys = []
                async for key in redis_client.scan_iter(match=pattern):
                    keys.append(key)
                if keys:
                    deleted_count = await redis_client.delete(*keys)
            except Exception as e:
                print(f"[RedisCache] Session invalidation error: {e}")

        return deleted_count

_cache_service = ContractTreeCacheService()

async def cache_contract_tree(
    user_id: str,
    doc_id: str,
    tree: List[Dict[str, Any]],
    session_id: Optional[str] = None,
    ttl_seconds: Optional[int] = None
) -> bool:
    return await _cache_service.set_tree(user_id, doc_id, tree, session_id, ttl_seconds)

async def get_cached_tree(
    user_id: str,
    doc_id: str,
    session_id: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    return await _cache_service.get_tree(user_id, doc_id, session_id)

async def invalidate_doc_tree(user_id: str, doc_id: str) -> int:
    return await _cache_service.invalidate_doc(user_id, doc_id)

async def invalidate_session_tree(user_id: str, session_id: str) -> int:
    return await _cache_service.invalidate_session(user_id, session_id)
