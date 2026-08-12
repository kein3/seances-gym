#!/bin/bash
# Publie TRIADE sur GitHub Pages, dans le sous-dossier triade/ du dépôt
# kein3/seances-gym — dont Pages est déjà actif. L'ancienne application reste
# à la racine, intacte.
#
#   ./publier.sh
#
# Le dépôt local reste la source : ce script copie, il ne récupère jamais rien.
# Rien n'est publié si la vérification (src/drive.mjs) n'est pas passée : la page
# porte une empreinte de build, comparée à la fin sur l'URL en ligne.
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")" && pwd)"
DEPOT="git@github.com:kein3/seances-gym.git"
# Clé dédiée à GitHub : pas de jeton à renouveler, rien de secret dans le dépôt.
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/github_kein3 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
DOSSIER="triade"
URL="https://kein3.github.io/seances-gym/${DOSSIER}/"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

cd "$SOURCE"
python3 src/build.py
EMPREINTE="$(grep -o 'name="triade-build" content="[^"]*"' index.html | sed 's/.*content="//; s/"//')"
echo "build à publier : $EMPREINTE"

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ des modifications ne sont pas versionnées dans le dépôt source :"
  git status --short
  echo "  → committer d'abord, sinon la version publiée ne correspondra à aucun commit."
  exit 1
fi

echo "clonage du dépôt de publication…"
git clone -q --depth 1 "$DEPOT" "$TEMP/depot"

rm -rf "$TEMP/depot/${DOSSIER}"
mkdir -p "$TEMP/depot/${DOSSIER}"
rsync -a --exclude '.git' --exclude '.gitignore' --exclude 'probe.html' --exclude 't.html' \
      "$SOURCE"/ "$TEMP/depot/${DOSSIER}/"

cd "$TEMP/depot"
if [ -z "$(git status --porcelain)" ]; then
  echo "rien de nouveau à publier."
  exit 0
fi

git add -A
git -c user.name="Kevin Vie" -c user.email="contact@holiproject.com" \
    commit -q -m "TRIADE — build ${EMPREINTE}"
git push -q origin HEAD:main
echo "poussé. GitHub Pages met une à deux minutes à servir la nouvelle version."

echo -n "attente de la mise en ligne "
for i in $(seq 1 40); do
  EN_LIGNE="$(curl -s "${URL}?c=$(date +%s)" | grep -o 'name="triade-build" content="[^"]*"' | sed 's/.*content="//; s/"//' || true)"
  if [ "$EN_LIGNE" = "$EMPREINTE" ]; then
    echo ""
    echo "✓ en ligne et conforme : $URL (build $EMPREINTE)"
    exit 0
  fi
  echo -n "."
  sleep 6
done
echo ""
echo "⚠ la page en ligne ne porte pas encore le build $EMPREINTE (vu : ${EN_LIGNE:-rien})."
echo "  Pages peut simplement être en retard — revérifier dans une minute :"
echo "  curl -s $URL | grep triade-build"
exit 1
