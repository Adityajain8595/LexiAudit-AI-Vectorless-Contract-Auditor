import asyncio
from typing import Tuple, List, Dict, Any, Optional
from pageindex import PageIndexClient
from app.core import settings

class PageIndexParser:
    """
    PageIndex client wrapper for tree-structured document parsing.
    """
    def __init__(self):
        self._client: Optional[PageIndexClient] = None

    def get_client(self) -> PageIndexClient:
        if self._client is None:
            if not settings.PAGEINDEX_API_KEY:
                raise ValueError("PAGEINDEX_API_KEY is not set in environment.")
            self._client = PageIndexClient(api_key=settings.PAGEINDEX_API_KEY)
        return self._client

    async def parse_document(self, file_path: str) -> Tuple[str, List[Dict[str, Any]]]:
        client = self.get_client()
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, client.submit_document, file_path)
        doc_id = result["doc_id"]

        while True:
            status_data = await loop.run_in_executor(None, client.get_document, doc_id)
            status = status_data.get("status")
            if status == "completed":
                break
            elif status == "failed":
                raise RuntimeError("PageIndex failed to build document tree structure.")
            await asyncio.sleep(2)

        try:
            tree_result = await loop.run_in_executor(
                None,
                lambda: client.get_tree(doc_id, node_summary=True, include_text=True)
            )
        except Exception:
            tree_result = await loop.run_in_executor(
                None,
                lambda: client.get_tree(doc_id, node_summary=True)
            )

        tree_nodes = tree_result.get("result", [])
        return doc_id, tree_nodes

_pageindex_parser = PageIndexParser()

async def process_pdf(file_path: str) -> Tuple[str, List[Dict[str, Any]]]:
    return await _pageindex_parser.parse_document(file_path)
