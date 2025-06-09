"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const redisclient_1 = require("./redisclient");
const opts = {
    // Basic options
    storeClient: redisclient_1.redisClient,
    points: 1000, // Number of points
    duration: 60, // Per second(s)
    blockDuration: 0, // Do not block if consumed more than points
    keyPrefix: 'rlflx', // must be unique for limiters with different purpose
};
const rateLimiter = new rate_limiter_flexible_1.RateLimiterRedis(opts);
exports.default = rateLimiter;
