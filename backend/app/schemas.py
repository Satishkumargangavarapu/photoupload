from typing import Literal
from pydantic import BaseModel, EmailStr, Field, model_validator


class AccessRequestIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    requested_role: Literal["event_manager", "team_member"]
    team_name: str | None = Field(default=None, max_length=120)
    manager_email: EmailStr | None = None
    manager_id: str | None = None

    @model_validator(mode="after")
    def team_request_needs_manager(self):
        if self.requested_role == "team_member" and not self.manager_email and not self.manager_id:
            raise ValueError("Choose the event manager whose team you want to join")
        if self.requested_role == "event_manager" and (self.manager_email or self.manager_id):
            raise ValueError("Event-manager requests cannot target another manager")
        return self


class DecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Literal["super_admin", "event_manager", "team_member"]
    team_name: str | None = None
    manager_id: str | None = None
    manager_name: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class EventIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class MemberIn(BaseModel):
    email: EmailStr


class DirectManagerInviteIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    team_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class DirectMemberInviteIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PublicTeamOut(BaseModel):
    id: str
    manager_name: str
    manager_email: EmailStr
    team_name: str


class ManagerSummaryOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    team_name: str
    members_count: int = 0
    events_count: int = 0
    created_at: str | None = None


class GalleryIn(BaseModel):
    photo_ids: list[str] = Field(default_factory=list)
    pin: str = Field(pattern=r"^\d{4}$")


class ShareLinkIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")
    photo_ids: list[str] | None = None


class ShareInfoOut(BaseModel):
    id: str
    event_id: str
    slug: str
    share_url: str
    pin: str | None = None
    is_published: bool
    photo_count: int = 0
    created_at: str | None = None


class PinIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")


class ActivityOut(BaseModel):
    id: str
    user_id: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    user_role: str | None = None
    action: str
    details: str
    event_id: str | None = None
    event_name: str | None = None
    created_at: str | None = None