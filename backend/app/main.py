"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.schema_upgrade import apply_schema_upgrades
from app.routes import agent_pkg as agent_pkg_routes
from app.routes import alerts as alerts_routes
from app.routes import analyze as analyze_routes
from app.routes import auth as auth_routes
from app.routes import metrics as metrics_routes
from app.routes import remediation as remediation_routes
from app.routes import risk as risk_routes
from app.websocket import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await apply_schema_upgrades(conn)
    yield
    await engine.dispose()


app = FastAPI(title="UptimeIQ API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(metrics_routes.router)
app.include_router(alerts_routes.router)
app.include_router(analyze_routes.router)
app.include_router(risk_routes.router)
app.include_router(remediation_routes.router)
app.include_router(agent_pkg_routes.router)
app.include_router(ws_router)
