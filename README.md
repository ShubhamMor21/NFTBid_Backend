# NFTBid Backend

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
</p>

A high-performance NFT auction platform backend built with NestJS, supporting real-time bidding, hybrid Web2/Web3 authentication, and decentralized event processing.

## 🚀 Key Features

- **Hybrid Authentication**: Support for standard Email/Password and Web3 Wallet-based login (Metamask/EVM).
- **Real-time Bidding**: Powered by Socket.io for instant bid updates and auction events.
- **Auction Engine**: Robust timed auction logic with automatic settlements.
- **Microservices Ready**: Decoupled architecture using RabbitMQ for background processing and Redis for high-speed caching.
- **Blockchain Integration**: Listeners for on-chain events to maintain database parity.
- **Role-Based Access Control (RBAC)**: Distinct permissions for Admin, Creator, and User.

## 🛠️ Technology Stack

- **Framework**: NestJS (v11)
- **Language**: TypeScript
- **Database**: MySQL (TypeORM)
- **Cache/Pub-Sub**: Redis
- **Messaging**: RabbitMQ
- **Real-time**: WebSockets (Socket.io)
- **Security**: Passport.js (JWT & Web3 Strategies), Helmet, Throttler

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/) & Docker Compose
- [NPM](https://www.npmjs.com/)

### 🚀 Local Setup (with Docker)

The easiest way to get started is using Docker Compose:

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd NFTBid_Backend
    ```

2.  **Configure Environment**:
    Copy `.env.example` to `.env` and update the values.
    ```bash
    cp .env.example .env
    ```

3.  **Run with Docker**:
    ```bash
    docker-compose up -d
    ```
    The API will be available at `http://localhost:3000/api/v1`.

### 💻 Manual Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run services**:
    Ensure MySQL, Redis, and RabbitMQ are running locally and update your `.env` accordingly.

3.  **Start the app**:
    ```bash
    # development
    npm run start:dev

    # production
    npm run start:prod
    ```

## 🧪 Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## ☁️ Deployment

This project is optimized for deployment on platforms like **Railway** or **Render**.
- The `Dockerfile` uses a multi-stage build for a lean production image.
- Ensure all environment variables (especially `DB_HOST`, `REDIS_HOST`, and `RABBITMQ_URL`) are correctly mapped in your cloud provider's dashboard.

## 🩺 Health Check

Monitor the system health at:
`GET /api/v1/health`

## 📜 License

This project is UNLICENSED.
