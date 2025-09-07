## Project overview

Kubernetes objects explained

Microservices architecture diagram (text-based in Markdown, you can later render it as an image if you want)

Deployment instructions (using Helm + cert-manager)

TLS/Ingress explanation

Here’s a draft README for your repo:

# 🎮 2D Survival Multiplayer Game – Kubernetes & Helm Deployment

This repository contains the Kubernetes Helm chart for deploying the 2D Survival Multiplayer Game on a Kubernetes cluster.
It follows a microservices architecture with separate services for frontend, authentication, and backend game server, all managed with Helm, Ingress, and cert-manager for TLS.

## 📂 Architecture Overview

The system is split into three main components:

1. # Client (Frontend)

Web-based game UI served to players.

Exposed to the internet via Ingress.

2. # Authentication Service

Handles login/registration.

Internal service, used by client and server.

3. # Game Server

Multiplayer backend logic.

Runs as a StatefulSet for stable network identity and persistence.

## 🛠️ Kubernetes Objects

# 1. Frontend (Client)

client-deployment.yaml → Deploys the game UI as a scalable Deployment.

client-service.yaml → Exposes the client app (via ClusterIP).

# 2. Authentication Service

auth-deployment.yaml → Deploys authentication microservice.

auth-service.yaml → Exposes the auth service for internal cluster use.

# 3. Game Server

server-statefulset.yaml → Deploys the game backend with stable identity & persistence.

server-service.yaml → Exposes the backend server for multiplayer connectivity.

# 4. Ingress & TLS

ingress.yaml → Routes traffic to client and backend APIs.

issuer.yaml (under cert-manager/) → Configures Let’s Encrypt Issuer for automated TLS certificates.

# 5. Helm Chart

Chart.yaml → Helm chart metadata.

values.yaml → Configurable settings (replicas, images, domains, resources).


<img width="822" height="542" alt="image" src="https://github.com/user-attachments/assets/0f2ed7db-24ea-463d-9091-1a0b4d1bad14" />


## 🚀 Deployment Steps

# Install cert-manager (for TLS certificates):

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.2/cert-manager.yaml


# Apply ClusterIssuer for Let’s Encrypt:

kubectl apply -f cert-manager/issuer.yaml


# Install the Helm chart:

helm install survival-game ./game-app


# Verify resources:

kubectl get pods,svc,ingress


## 🔐 Security & TLS

Ingress is configured with cert-manager Issuer for Let’s Encrypt.

HTTPS is automatically provisioned for game endpoints.

## 📊 DevOps Notes

Helm ensures repeatable deployments.

StatefulSet guarantees backend stability.

Ingress + cert-manager handles external routing & TLS.

Services decouple networking between frontend, backend, and auth microservices.
