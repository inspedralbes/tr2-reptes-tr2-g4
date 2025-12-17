# Etapa de compilación (build)
FROM node:20-alpine AS build

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de definición de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos del frontend
COPY . .

# Compila la aplicación para producción
RUN npm run build

# Etapa de servicio (serve)
FROM nginx:stable-alpine

# Copia los archivos compilados de la etapa anterior al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expone el puerto 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
