
from database import Base, engine
from models import StrategicSite

Base.metadata.create_all(bind=engine)

print("GeoIntel AI database initialized successfully.")
