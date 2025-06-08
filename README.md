# Node.js HTTP Reverse Proxy with Redis Rate Limiting

This project is a simple HTTP reverse proxy server built with Node.js that forwards requests to another server. It uses Redis to limit how many requests each user can make and can run multiple processes to handle more traffic.

## Features

- Forwards HTTP requests (GET, POST, PUT, PATCH, DELETE) to a backend URL.
- Limits requests per user IP using Redis.
- Automatically reconnects to Redis if the connection drops.
- Uses Node.js clustering to use all CPU cores for better performance.
