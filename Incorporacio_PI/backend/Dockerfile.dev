# Usamos una versión ligera de Node
FROM node:18-alpine

# Creamos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero los archivos de dependencias (para aprovechar la caché de Docker)
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Creamos la carpeta de uploads por si no existe
RUN mkdir -p uploads

# Exponemos el puerto 3001 (que configuramos antes)
EXPOSE 3001

# Comando para iniciar el servidor
CMD ["node", "server.js"]

