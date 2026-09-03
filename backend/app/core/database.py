import time
from supabase import create_client, Client
from .config import settings

_supabase_client: Client | None = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
            raise ValueError("SUPABASE_URL or SUPABASE_SECRET_KEY not set in environment.")
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
    return _supabase_client

def execute_db_query(builder, retries: int = 3, delay: float = 1.0):
    """
    Executes a Supabase / PostgREST query with automatic clock-skew retry for PGRST303 (JWT issued at future).
    """
    last_exc = None
    for attempt in range(retries):
        try:
            return builder.execute()
        except Exception as e:
            last_exc = e
            err_msg = str(e).lower()
            if ("jwt issued at future" in err_msg or "pgrst303" in err_msg) and attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
                continue
            raise e
    if last_exc:
        raise last_exc
