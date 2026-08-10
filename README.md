# Docker Step-by-Step: Reverse Proxy & Load Balancing with Express and Nginx

This project demonstrates how to set up an **Express.js Node.js application** behind an **Nginx Reverse Proxy** and scale it into a **Round-Robin Load Balancer** using **Docker Compose**.

---

## 📐 Architecture Overview

```
                          ┌────────────────────────┐
                          │    Browser / Client    │
                          │ http://localhost:8080  │
                          └───────────┬────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │    Nginx Container     │
                          │   (Port 80 inside)     │
                          └───────────┬────────────┘
                                      │
                   ┌──────────────────┼──────────────────┐
                   │                  │                  │
                   ▼                  ▼                  ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │ app1 (:5000) │   │ app2 (:5000) │   │ app3 (:5000) │
            │ INSTANCE=    │   │ INSTANCE=    │   │ INSTANCE=    │
            │ App-1        │   │ App-2        │   │ App-3        │
            └──────────────┘   └──────────────┘   └──────────────┘
```

---

## 📁 Directory Structure

```text
d:\Docker\
├── app/
│   ├── Dockerfile       # Instructions to containerize the Express app
│   ├── package.json     # Node.js dependencies (express)
│   └── server.js        # Express web application code
├── nginx/
│   └── nginx.conf       # Nginx configuration (reverse proxy & load balancer)
├── docker-compose.yml   # Multi-container orchestrator configuration
└── README.md            # Step-by-step project documentation
```

---

## 🚀 Phase 1: Single Container Reverse Proxy

In the first phase, we set up a single instance of the Express application running behind an Nginx reverse proxy.

### Step 1: Create the App Files (`/app`)

#### 1. `app/package.json`
Defines the Node.js project and installs Express:
```json
{
  "name": "docker-express-app",
  "version": "1.0.0",
  "description": "Express application inside Docker",
  "main": "server.js",
  "dependencies": {
    "express": "^4.19.2"
  }
}
```

#### 2. `app/server.js`
A basic Express server that listens on port `5000` (or `process.env.PORT`) and identifies its instance name:
```javascript
const express = require("express");
const os = require("os");

const app = express();

const PORT = process.env.PORT || 5000;
const INSTANCE = process.env.INSTANCE_NAME || os.hostname();

app.get("/", (req, res) => {
    res.send(`Hello World, I am from ${INSTANCE}`);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} from ${INSTANCE}`);
});
```

#### 3. `app/Dockerfile`
Packaging steps to build a lightweight Node.js Docker image:
```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

---

### Step 2: Configure Docker Compose for 1 Instance

Create `docker-compose.yml` in the root directory:
```yaml
services:
  app1:
    build: ./app
    environment:
      - INSTANCE_NAME=App-1

  nginx:  
    image: nginx:latest
    ports: 
      - "8080:80"  
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app1
```

- **`app1`**: Builds the image from `./app` directory and sets `INSTANCE_NAME=App-1`.
- **`nginx`**: Uses official `nginx:latest` image, maps host port `8080` to Nginx port `80`, and mounts custom `nginx.conf`.

---

### Step 3: Configure Nginx Reverse Proxy

Create `nginx/nginx.conf`:
```nginx
events {}

http {
    server {
        listen 80;

        location / {
            proxy_pass http://app1:5000;
        }
    }
}
```
> 💡 **Key Concept**: `app1:5000` uses Docker's internal DNS network where service name `app1` resolves to the container's IP address on port `5000`.

---

### Step 4: Run & Test Single Container Proxy

Run the following command in your terminal:
```bash
docker compose up --build
```
Open your browser and visit: **`http://localhost:8080`**  
Output: `Hello World, I am from App-1`

---

## ⚡ Phase 2: Multi-Instance Load Balancing

Now we scale our application to 3 instances (`app1`, `app2`, `app3`) and configure Nginx to balance requests round-robin.

### Step 1: Update `docker-compose.yml`

Add `app2` and `app3` services, and list them under `depends_on` for Nginx:
```yaml
services:
  app1:
    build: ./app
    environment:
      - INSTANCE_NAME=App-1

  app2:
    build: ./app
    environment:
      - INSTANCE_NAME=App-2

  app3:
    build: ./app
    environment:
      - INSTANCE_NAME=App-3

  nginx:  
    image: nginx:latest
    ports: 
      - "8080:80"  
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app1
      - app2
      - app3
```

---

### Step 2: Update `nginx/nginx.conf` with Upstream Load Balancer

Modify `nginx/nginx.conf` to include an `upstream` block targeting all three app instances:
```nginx
events {}

http {
    upstream backend {
        server app1:5000;
        server app2:5000;
        server app3:5000;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://backend;
        }
    }
}
```

- **`upstream backend { ... }`**: Defines a cluster of backend servers. By default, Nginx uses **Round-Robin** load balancing.
- **`proxy_pass http://backend;`**: Directs incoming requests on port `80` to the `backend` upstream group.

---

### Step 3: Run & Test Load Balancer

Rebuild and start all containers:
```bash
docker compose up --build
```

Open your browser and visit: **`http://localhost:8080`**

Refresh the page (`F5` or `Ctrl+R`) multiple times. You will see the responses alternate:
1. `Hello World, I am from App-1`
2. `Hello World, I am from App-2`
3. `Hello World, I am from App-3`
4. `Hello World, I am from App-1` ...

---

## 🔍 Key Takeaways & Common Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **`502 Bad Gateway`** | Port mismatch (e.g. `server.js` listens on 5000, but Nginx proxies to 3000). | Ensure upstream port in `nginx.conf` matches `PORT` in `server.js` (e.g. `:5000`). |
| **Obsolete `version` Warning** | `version: '3.9'` at the top of `docker-compose.yml`. | Remove the top-level `version` field (Compose v2 automatically detects specs). |
| **Daemon Connection Error** | Docker Desktop engine is stopped or frozen. | Start Docker Desktop and wait for the daemon icon to turn steady green. |

---

## 🛠️ Useful Commands Cheat Sheet

- **Start containers (interactive):**
  ```bash
  docker compose up --build
  ```
- **Start containers in background (detached):**
  ```bash
  docker compose up --build -d
  ```
- **Stop running containers:**
  ```bash
  docker compose down
  ```
- **View container logs:**
  ```bash
  docker compose logs -f
  ```
