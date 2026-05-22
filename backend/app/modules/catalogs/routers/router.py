from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import get_current_user
from app.common.deps.database import get_db
from app.db.models.area import Area
from app.db.models.product import Product
from app.db.models.project_type import ProjectType
from app.modules.catalogs.schemas import AreaRead, ProductRead, ProjectTypeRead

router = APIRouter(prefix="", tags=["catalogs"])


@router.get("/areas", response_model=list[AreaRead])
def list_areas(
    _: object = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[AreaRead]:
    return [
        AreaRead.model_validate(item)
        for item in db.scalars(select(Area).where(Area.is_active == True)).all()
    ]


@router.get("/project-types", response_model=list[ProjectTypeRead])
def list_project_types(
    _: object = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProjectTypeRead]:
    return [
        ProjectTypeRead.model_validate(item)
        for item in db.scalars(
            select(ProjectType).where(ProjectType.is_active == True)
        ).all()
    ]


@router.get("/products", response_model=list[ProductRead])
def list_products(
    _: object = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProductRead]:
    return [
        ProductRead.model_validate(item)
        for item in db.scalars(select(Product).where(Product.is_active == True)).all()
    ]
