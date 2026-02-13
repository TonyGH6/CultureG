#!/bin/bash
# =============================================
# CultureG — Script de déploiement VPS
# =============================================
# Usage: ssh root@your-server "bash -s" < deploy.sh
# Ou bien: scp deploy.sh root@your-server: && ssh root@your-server bash deploy.sh
# =============================================

set -euo pipefail

DOMAIN="${DOMAIN:-cultureg.example.com}"
EMAIL="${EMAIL:-admin@example.com}"

echo "🚀 Déploiement CultureG sur $(hostname)"
echo "   Domaine: $DOMAIN"
echo ""

# ---- 1. Installer Docker si absent ----
if ! command -v docker &> /dev/null; then
    echo "📦 Installation de Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installé"
else
    echo "✅ Docker déjà installé"
fi

# ---- 2. Installer Docker Compose plugin si absent ----
if ! docker compose version &> /dev/null; then
    echo "📦 Installation de Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installé"
else
    echo "✅ Docker Compose déjà installé"
fi

# ---- 3. Cloner ou mettre à jour le repo ----
APP_DIR="/opt/cultureg"
REPO_URL="https://github.com/TonyGH6/CultureG.git"

if [ -d "$APP_DIR" ]; then
    echo "📥 Mise à jour du code..."
    cd "$APP_DIR"
    git pull origin main
else
    echo "📥 Clonage du repo..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ---- 4. Créer le .env si absent ----
if [ ! -f .env ]; then
    echo "⚙️  Création du .env..."
    cp .env.example .env
    
    # Générer un JWT_SECRET aléatoire
    JWT_SECRET=$(openssl rand -base64 48)
    sed -i "s|CHANGE_ME_min_32_chars_random_string_here_1234567890|$JWT_SECRET|g" .env
    
    # Générer un mot de passe PostgreSQL aléatoire
    PG_PASS=$(openssl rand -base64 24)
    sed -i "s|CHANGE_ME_super_secret_password|$PG_PASS|g" .env
    
    # Mettre le domaine
    sed -i "s|cultureg.example.com|$DOMAIN|g" .env
    
    echo "✅ .env créé avec des secrets aléatoires"
    echo "⚠️  Vérifie le fichier .env avant de continuer !"
    echo "   nano $APP_DIR/.env"
fi

# ---- 5. Mettre à jour le domaine dans la config Nginx ----
sed -i "s|cultureg.example.com|$DOMAIN|g" nginx/conf.d/default.conf

# ---- 6. Obtenir le certificat SSL (première fois) ----
if [ ! -d "certbot/conf/live/$DOMAIN" ]; then
    echo "🔒 Obtention du certificat SSL..."
    
    # D'abord, démarrer Nginx en HTTP seulement pour le challenge ACME
    # Créer une config temporaire sans SSL
    mkdir -p certbot/conf certbot/www
    
    # Créer config Nginx temporaire HTTP-only
    cat > nginx/conf.d/default.conf << 'TMPEOF'
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'CultureG - SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
TMPEOF
    
    # Démarrer Nginx
    docker compose up -d nginx
    sleep 3
    
    # Obtenir le certificat
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email
    
    # Restaurer la config Nginx complète avec SSL
    git checkout nginx/conf.d/default.conf
    sed -i "s|cultureg.example.com|$DOMAIN|g" nginx/conf.d/default.conf
    
    docker compose down
    echo "✅ Certificat SSL obtenu"
else
    echo "✅ Certificat SSL existant"
fi

# ---- 7. Build & Start ----
echo "🔨 Build des images Docker..."
docker compose build --no-cache

echo "🚀 Démarrage des services..."
docker compose up -d

echo ""
echo "================================================"
echo "✅ CultureG déployé avec succès !"
echo "================================================"
echo "   URL:     https://$DOMAIN"
echo "   API:     https://$DOMAIN/api"
echo "   Logs:    docker compose logs -f"
echo "   Status:  docker compose ps"
echo "================================================"
