FROM node:18
WORKDIR /app

# Sao chép package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install

# Sao chép source code vào trong container
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
