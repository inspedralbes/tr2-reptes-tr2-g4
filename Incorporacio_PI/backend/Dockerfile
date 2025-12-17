# Usa una imagen base de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia los archivos package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto de los archivos de la aplicación
COPY . .

# Expone el puerto en el que corre la aplicación
EXPOSE 3000

# Define el comando para iniciar la aplicación
CMD ["node", "server.js"]
