import asyncio
from typing import Tuple, List, Dict, Any, Optional
from pageindex import PageIndexClient
from app.core import settings

# PageIndex tree parser client
class PageIndexParser:
    def __init__(self):
        self._client: Optional[PageIndexClient] = None

    def get_client(self) -> PageIndexClient:
        if self._client is None:
            if not settings.PAGEINDEX_API_KEY:
                raise ValueError("PAGEINDEX_API_KEY is not set in environment.")
            self._client = PageIndexClient(api_key=settings.PAGEINDEX_API_KEY)
        return self._client

    # Submit PDF document for parsing
    async def parse_document(self, path: str) -> Tuple[str, List[Dict[str, Any]]]:
        client = self.get_client()
        loop = asyncio.get_event_loop()
        res = await loop.run_in_executor(None, client.submit_document, path)
        doc_id = res["doc_id"]

        # Poll parsing status until completion
        while True:
            info = await loop.run_in_executor(None, client.get_document, doc_id)
            status = info.get("status")
            if status == "completed":
                break
            elif status == "failed":
                raise RuntimeError("Document parsing failed in PageIndex.")
            await asyncio.sleep(2)

        # Fetch parsed tree hierarchy
        try:
            tree_data = await loop.run_in_executor(None, lambda: client.get_tree(doc_id, node_summary=True, include_text=True))
        except Exception:
            tree_data = await loop.run_in_executor(None, lambda: client.get_tree(doc_id, node_summary=True))

        nodes = tree_data.get("result", [])
        return doc_id, nodes

_parser = PageIndexParser()

async def process_pdf(file_path: str) -> Tuple[str, List[Dict[str, Any]]]:
    return await _parser.parse_document(file_path)
