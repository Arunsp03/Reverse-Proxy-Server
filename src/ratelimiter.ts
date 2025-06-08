import Redis from 'ioredis';
import { config } from 'dotenv';
import { RateLimiterRedis } from 'rate-limiter-flexible';
config();
const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: +(process.env.REDIS_PORT || 6379),
    enableOfflineQueue: false,
    retryStrategy: function (times) {

    if (times % 4 ==0) { 
      console.error("redisRetryError", 'Redis reconnect exhausted after 3 retries.');
      return null;
    }

    return 200;

  }
     });

redisClient.on('connect',()=>{
    console.log("Redis client has connected");
    
})

redisClient.on('connecting',()=>{
    console.log("Redis client is connecting");
    
})

redisClient.on('error', (err) => {
  console.error("Redis Client error ",err);
});

redisClient.on("reconnecting",(delay:number)=>{
console.log(`Redis is reconnecting in ${delay}ms ...`);
})

redisClient.on("end",()=>{
    console.log("Redis client has closed permanently (no more retries)");

})

redisClient.on("close",()=>{
    console.log("Redis client has closed.Reconnection may happen ");
   
})




const opts = {
  // Basic options
  storeClient: redisClient,
  points: 5, // Number of points
  duration: 60, // Per second(s)
  blockDuration: 0, // Do not block if consumed more than points
  keyPrefix: 'rlflx', // must be unique for limiters with different purpose
};

const rateLimiter = new RateLimiterRedis(opts);
export default rateLimiter;