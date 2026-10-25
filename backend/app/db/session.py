from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    try:
        # Import models so metadata is populated before create_all
        import backend.app.db.models  # noqa: F401
    except ImportError:
        pass

    Base.metadata.create_all(bind=engine)
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        # Map of table -> list of (column_name, column_type)
        migrations = {
            "test_runs": [
                ("test_mode", "VARCHAR(50) DEFAULT 'universal_exploratory'"),
                ("baseline_profile", "VARCHAR(100) DEFAULT 'default'"),
            ],
            "test_cases": [
                ("objective", "TEXT"),
                ("expectation_source", "VARCHAR(100) DEFAULT 'deterministic_invariant'"),
                ("baseline_id", "VARCHAR(50)"),
                ("cleanup_requirements", "JSON DEFAULT '[]'"),
                ("test_data", "JSON DEFAULT '{}'"),
            ],
            "test_executions": [
                ("network_observations", "JSON DEFAULT '[]'"),
                ("step_records", "JSON DEFAULT '[]'"),
            ],
            "bug_findings": [
                ("dedup_key", "VARCHAR(100)"),
                ("failed_step_index", "INTEGER"),
                ("annotated_screenshot_url", "VARCHAR(500)"),
                ("screenshot_before_url", "VARCHAR(500)"),
                ("screenshot_after_url", "VARCHAR(500)"),
                ("category", "VARCHAR(100) DEFAULT 'Functional behavior and navigation'"),
                ("trust_score", "FLOAT DEFAULT 0.90"),
                ("trust_breakdown", "JSON DEFAULT '{}'"),
                ("expectation_source", "VARCHAR(100) DEFAULT 'Deterministic Invariant'"),
                ("expectation_justification", "TEXT"),
                ("detection_method", "VARCHAR(100) DEFAULT 'deterministic_assertion'"),
                ("likely_cause_hypothesis", "TEXT"),
                ("suggested_fix", "TEXT"),
                ("alternative_explanations", "TEXT"),
                ("reproduction_attempts", "INTEGER DEFAULT 1"),
                ("reproduction_outcomes", "JSON DEFAULT '[]'"),
                ("network_status", "JSON DEFAULT '{}'"),
                ("regression_test_id", "VARCHAR(50)"),
            ],
            "regression_tests": [
                ("provenance", "VARCHAR(50) DEFAULT 'passing_journey'"),
                ("is_approved", "BOOLEAN DEFAULT 1"),
            ]
        }

        with engine.begin() as conn:
            for table, cols in migrations.items():
                if table in table_names:
                    existing = [col["name"] for col in inspector.get_columns(table)]
                    for col_name, col_type in cols:
                        if col_name not in existing:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))

    except Exception as e:
        print(f"DB init migration notice: {e}")

init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
