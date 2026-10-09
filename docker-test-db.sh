#!/bin/bash
# Script para gestionar la base de datos de testing en Docker
# Uso: ./docker-test-db.sh [start|stop|restart|logs|status|clean]

set -e

COMPOSE_FILE="docker-compose.test.yml"
CONTAINER_NAME="contabily-postgres-test"

case "${1:-start}" in
  start)
    echo "🚀 Iniciando PostgreSQL de testing en puerto 5433..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo "⏳ Esperando a que la base de datos esté lista..."
    sleep 3
    docker compose -f "$COMPOSE_FILE" exec -T postgres-test pg_isready -U postgres -d contabily_test
    echo "✅ PostgreSQL listo en localhost:5433"
    echo "   Base de datos: contabily_test"
    echo "   Usuario: postgres"
    echo "   Contraseña: postgres"
    ;;

  stop)
    echo "🛑 Deteniendo PostgreSQL de testing..."
    docker compose -f "$COMPOSE_FILE" down
    echo "✅ Detenido"
    ;;

  restart)
    echo "🔄 Reiniciando PostgreSQL de testing..."
    docker compose -f "$COMPOSE_FILE" restart
    sleep 2
    docker compose -f "$COMPOSE_FILE" exec -T postgres-test pg_isready -U postgres -d contabily_test
    echo "✅ Reiniciado"
    ;;

  logs)
    echo "📋 Logs de PostgreSQL:"
    docker compose -f "$COMPOSE_FILE" logs -f postgres-test
    ;;

  status)
    echo "📊 Estado de contenedores:"
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  clean)
    echo "🧹 Limpiando PostgreSQL de testing (ELIMINA DATOS)..."
    read -p "¿Estás seguro? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker compose -f "$COMPOSE_FILE" down -v
      echo "✅ Limpieza completa"
    else
      echo "❌ Cancelado"
    fi
    ;;

  shell)
    echo "🐚 Abriendo shell en PostgreSQL..."
    docker compose -f "$COMPOSE_FILE" exec postgres-test psql -U postgres -d contabily_test
    ;;

  *)
    echo "Uso: $0 [start|stop|restart|logs|status|clean|shell]"
    echo ""
    echo "Comandos:"
    echo "  start   - Iniciar PostgreSQL en puerto 5433"
    echo "  stop    - Detener PostgreSQL"
    echo "  restart - Reiniciar PostgreSQL"
    echo "  logs    - Ver logs en tiempo real"
    echo "  status  - Ver estado de contenedores"
    echo "  clean   - Eliminar contenedores y volúmenes (DATOS PERDIDOS)"
    echo "  shell   - Abrir psql en el contenedor"
    exit 1
    ;;
esac