from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True,
                              extra="forbid", allow_inf_nan=False)


class Message(Model):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class HealthSnapshot(Model):
    date: date
    time_zone: str = Field(min_length=1, max_length=80)
    captured_at: datetime
    steps: float | None = Field(default=None, ge=0, le=200000)
    active_energy_kcal: float | None = Field(default=None, ge=0, le=20000)
    exercise_minutes: float | None = Field(default=None, ge=0, le=1500)
    sleep_minutes: float | None = Field(default=None, ge=0, le=1500)
    weight_kg: float | None = Field(default=None, gt=0, le=700)


class CoachRequest(Model):
    message: str = Field(min_length=1, max_length=2000)
    date: date
    time_zone: str = Field(min_length=1, max_length=80)
    history: list[Message] = Field(default_factory=list, max_length=6)
    share_health: bool = False
    health: HealthSnapshot | None = None
    # Only the authenticated Java gateway constructs this context.
    context: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_health(self):
        if not self.share_health:
            self.health = None
        elif self.health is not None:
            if self.health.date != self.date or self.health.time_zone != self.time_zone:
                raise ValueError("Health snapshot must match the requested local day and timezone")
            if self.health.captured_at.tzinfo is None:
                raise ValueError("Health capture timestamp requires a timezone")
        return self


class ToolTrace(Model):
    name: str
    duration_ms: int


class CoachResponse(Model):
    run_id: str
    answer: str
    tools: list[ToolTrace]
    disclaimer: str = "AI-generated guidance. Verify with a healthcare professional."
