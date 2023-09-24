# Verwende das offizielle Node.js-Image als Basis
FROM node:14

# Setze das Arbeitsverzeichnis innerhalb des Containers
WORKDIR /app

# Kopiere die Anwendungsdateien (index.js, package.json, package-lock.json, public folder) in den Container
COPY package*.json ./
COPY index.js .
COPY public/* ./public/

# Installiere die Abhängigkeiten
RUN npm install

# Exponiere den Port, den deine Anwendung verwendet (3000 im Beispiel)
EXPOSE 3000

# Starte deine Anwendung beim Containerstart
CMD ["node", "index.js"]
