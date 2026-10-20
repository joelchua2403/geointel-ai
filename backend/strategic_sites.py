
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import StrategicSite

router = APIRouter(
    prefix="/api/strategic-sites",
    tags=["Strategic Sites"],
)


class SiteBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    description: str = ""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    enabled: bool = True


class SiteCreate(SiteBase):
    id: str | None = None


class SiteUpdate(SiteBase):
    pass


class SiteResponse(SiteBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[SiteResponse])
def list_sites(db: Session = Depends(get_db)):
    return db.scalars(
        select(StrategicSite).order_by(StrategicSite.name)
    ).all()


@router.post(
    "",
    response_model=SiteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_site(
    payload: SiteCreate,
    db: Session = Depends(get_db),
):
    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Site name cannot be empty",
        )

    existing = db.scalar(
        select(StrategicSite).where(
            StrategicSite.name == name
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A site with this name already exists",
        )

    site_id = payload.id or str(uuid4())

    if db.get(StrategicSite, site_id):
        raise HTTPException(
            status_code=409,
            detail="A site with this ID already exists",
        )

    site = StrategicSite(
        id=site_id,
        name=name,
        category=payload.category,
        description=payload.description,
        lat=payload.lat,
        lng=payload.lng,
        enabled=payload.enabled,
    )

    db.add(site)
    db.commit()
    db.refresh(site)

    return site


@router.put("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: str,
    payload: SiteUpdate,
    db: Session = Depends(get_db),
):
    site = db.get(StrategicSite, site_id)

    if not site:
        raise HTTPException(
            status_code=404,
            detail="Strategic site not found",
        )

    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Site name cannot be empty",
        )

    duplicate = db.scalar(
        select(StrategicSite).where(
            StrategicSite.name == name,
            StrategicSite.id != site_id,
        )
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A site with this name already exists",
        )

    site.name = name
    site.category = payload.category
    site.description = payload.description
    site.lat = payload.lat
    site.lng = payload.lng
    site.enabled = payload.enabled

    db.commit()
    db.refresh(site)

    return site


@router.delete("/{site_id}", status_code=204)
def delete_site(
    site_id: str,
    db: Session = Depends(get_db),
):
    site = db.get(StrategicSite, site_id)

    if not site:
        raise HTTPException(
            status_code=404,
            detail="Strategic site not found",
        )

    db.delete(site)
    db.commit()
