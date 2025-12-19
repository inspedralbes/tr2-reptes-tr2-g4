# Usamos Node ligero
FROM node:22-alpine

# Carpeta de trabajo
WORKDIR /app

# Copiamos dependencias e instalamos
COPY package*.json ./
RUN npm install

# Copiamos el código fuente
COPY . .

# Exponemos el puerto de Vite (normalmente 5173)
EXPOSE 3000

# Arrancamos en modo desarrollo y EXXPONEMOS la red (--host)
CMD ["npm", "run", "dev", "--", "--host"]