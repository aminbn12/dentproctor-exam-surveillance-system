from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from app.config import settings
from app.database import create_tables, get_db
from app.routes import auth, professors, residents, rooms, exams, assignments, history, admin, config_changes, proctors

# Créer les tables au démarrage
create_tables()

# Initialiser l'app FastAPI
app = FastAPI(
    title="APP surveillances UM6SS API",
    description="Système de surveillance des examens - Faculté de Médecine Dentaire",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# Routes de santé
@app.get("/health")
async def health_check():
    """Vérifier l'état de l'API"""
    return {"status": "✅ API healthy", "version": "1.0.0"}

@app.get("/")
async def root():
    """Route racine"""
    return {
        "message": "🎓 Bienvenue sur APP surveillances UM6SS API",
        "version": "1.0.0",
        "docs": "/docs",
        "environment": settings.ENVIRONMENT
    }

# Inclusion des routes
app.include_router(auth.router)
app.include_router(professors.router)
app.include_router(residents.router)
app.include_router(rooms.router)
app.include_router(proctors.router)
app.include_router(exams.router)
app.include_router(assignments.router)
app.include_router(history.router)
app.include_router(admin.router)
app.include_router(config_changes.router)

# Gestionnaire d'erreurs globaux
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    # Logger l'erreur (à faire plus tard avec logging)
    if settings.DEBUG:
        content = {"detail": f"❌ Erreur interne du serveur: {str(exc)}"}
    else:
        # En production, ne pas exposer les détails internes
        content = {"detail": "❌ Erreur interne du serveur"}
    return JSONResponse(status_code=500, content=content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
