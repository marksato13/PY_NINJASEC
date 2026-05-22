from sqlalchemy import select
from sqlalchemy.orm import Session


class Repository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, instance):
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def list_all(self, model):
        return self.db.scalars(select(model).order_by(model.id)).all()

    def get_by_id(self, model, entity_id: int):
        return self.db.get(model, entity_id)
