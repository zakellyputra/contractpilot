"""Pydantic response models for the ContractPilot API."""

from pydantic import BaseModel


class KeyDate(BaseModel):
    date: str
    label: str
    type: str  # "deadline" | "renewal" | "termination" | "milestone"


class ClauseResult(BaseModel):
    clauseText: str
    clauseType: str
    riskLevel: str  # "high" | "medium" | "low"
    riskCategory: str  # "financial" | "compliance" | "operational" | "reputational"
    explanation: str
    concern: str | None = None
    suggestion: str | None = None
    k2Reasoning: str | None = None
    parentHeading: str | None = None
    subClauseIndex: int | None = None


class ReviewResult(BaseModel):
    contractType: str
    summary: str
    riskScore: int  # 0-100
    financialRisk: int
    complianceRisk: int
    operationalRisk: int
    reputationalRisk: int
    clauses: list[ClauseResult]
    actionItems: list[str]
    keyDates: list[KeyDate]


class AnalyzeResponse(BaseModel):
    review_id: str
    status: str
