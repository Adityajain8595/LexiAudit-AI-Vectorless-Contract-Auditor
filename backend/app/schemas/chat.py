from pydantic import BaseModel, Field, AliasChoices
from typing import List, Optional, Any

class TreeSearchOutput(BaseModel):
    node_list: List[str] = Field(default=[], validation_alias=AliasChoices("node_list", "nodes", "target_nodes", "selected_nodes", "ids"), description="List of target node_id strings to extract")

class RAGFollowUpOutput(BaseModel):
    suggested_queries: List[str] = Field(default=[], validation_alias=AliasChoices("suggested_queries", "queries", "follow_up_questions", "questions", "followup_queries"), description="List of 2 to 3 concise, context-aware follow-up legal questions")

class CitedNode(BaseModel):
    node_id: str
    title: str
    page_index: Any
    summary: str
    exact_text: str

class QueryRequest(BaseModel):
    session_id: str
    query: str

class QueryResponse(BaseModel):
    answer: str
    cited_nodes: List[CitedNode]
    suggested_queries: List[str] = []

class ChatSessionCreate(BaseModel):
    document_id: str
    title: Optional[str] = "Contract Audit Session"

class FeedbackRequest(BaseModel):
    trace_id: Optional[str] = None
    session_id: str
    score: float = Field(ge=0.0, le=1.0, description="1.0 for positive (thumbs up), 0.0 for negative (thumbs down)")
    comment: Optional[str] = None
