from pydantic import BaseModel, Field, AliasChoices
from typing import List, Optional

class ContextPrecisionOutput(BaseModel):
    precision_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("precision_score", "precision", "score"), description="Proportion of retrieved nodes that are factually relevant to answer the query")
    justification: str = Field(default="Precision evaluation completed.", validation_alias=AliasChoices("justification", "reasoning", "explanation"), description="Explanation of retrieved node relevance")

class ContextRecallOutput(BaseModel):
    recall_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("recall_score", "recall", "score"), description="Proportion of required contract clauses retrieved")
    justification: str = Field(default="Recall evaluation completed.", validation_alias=AliasChoices("justification", "reasoning", "explanation"), description="Explanation of retrieved vs required contract clauses")

class ContextRecallPrecisionOutput(BaseModel):
    precision_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("precision_score", "precision", "context_precision", "precision_val"), description="Proportion of retrieved nodes that are factually relevant to answer the query")
    recall_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("recall_score", "recall", "context_recall", "recall_val"), description="Proportion of required contract clauses retrieved")
    justification: str = Field(default="Context evaluation completed.", validation_alias=AliasChoices("justification", "reasoning", "explanation", "summary"), description="Detailed explanation of retrieved vs required clauses")

class FaithfulnessOutput(BaseModel):
    faithfulness_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("faithfulness_score", "faithfulness", "score"), description="1.0 if completely grounded in contract with zero hallucination, 0.0 if fabricated")
    hallucinated_statements: List[str] = Field(default=[], validation_alias=AliasChoices("hallucinated_statements", "hallucinations", "unsupported_claims", "unsupported_statements"), description="List of ungrounded or fabricated claims, if any")
    justification: str = Field(default="Faithfulness verified against cited contract provisions.", validation_alias=AliasChoices("justification", "reasoning", "explanation", "summary"), description="Verification of claims against cited text")

class AnswerRelevancyOutput(BaseModel):
    relevancy_score: float = Field(default=1.0, ge=0.0, le=1.0, validation_alias=AliasChoices("relevancy_score", "relevancy", "score", "answer_relevancy"), description="How directly and concisely the answer addresses the user's specific legal question")
    justification: str = Field(default="Answer relevancy assessment completed.", validation_alias=AliasChoices("justification", "reasoning", "explanation", "summary"), description="Assessment of query responsiveness")

class EvaluationReport(BaseModel):
    trace_id: Optional[str] = None
    session_id: Optional[str] = None
    query: str
    context_precision: float
    context_recall: float
    faithfulness: float
    answer_relevancy: float
    hallucinations: List[str] = []
    reasoning_summary: str
