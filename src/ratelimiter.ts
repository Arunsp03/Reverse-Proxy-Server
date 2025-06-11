import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from './redisclient';
const opts = {
  // Basic options
  storeClient: redisClient,
  points: 1000, // Number of points
  duration: 60, // Per second(s)
  blockDuration: 0, // Do not block if consumed more than points
  keyPrefix: 'rlflx', // must be unique for limiters with different purpose
};

const rateLimiter = new RateLimiterRedis(opts);
export default rateLimiter;