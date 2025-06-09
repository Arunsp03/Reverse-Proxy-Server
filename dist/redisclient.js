"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
exports.redisClient = new ioredis_1.default({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: +(process.env.REDIS_PORT || 6379),
    enableOfflineQueue: false,
    retryStrategy: function (times) {
        if (times % 4 == 0) {
            console.error("redisRetryError", 'Redis reconnect exhausted after 3 retries.');
            return null;
        }
        return 200;
    }
});
exports.redisClient.on('connect', () => {
    console.log("Redis client has connected");
});
exports.redisClient.on('connecting', () => {
    console.log("Redis client is connecting");
});
exports.redisClient.on('error', (err) => {
    console.error("Redis Client error ", err);
});
exports.redisClient.on("reconnecting", (delay) => {
    console.log(`Redis is reconnecting in ${delay}ms ...`);
});
exports.redisClient.on("end", () => {
    console.log("Redis client has closed permanently (no more retries)");
});
exports.redisClient.on("close", () => {
    console.log("Redis client has closed.Reconnection may happen ");
});
