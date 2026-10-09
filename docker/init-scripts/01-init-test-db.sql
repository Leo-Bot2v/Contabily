-- Script de inicialización para la base de datos de testing
-- Se ejecuta automáticamente al crear el contenedor PostgreSQL

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Configuración de zona horaria
SET timezone = 'UTC';

-- Comentario para identificar la BD
COMMENT ON DATABASE contabily_test IS 'Base de datos de testing para Contabily - Puerto 5433';