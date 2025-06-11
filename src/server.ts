import http from "node:http";
import { config } from "dotenv";
import cluster from "node:cluster";
import process from "node:process";
import axios from "axios";
import { availableParallelism } from "node:os";
import rateLimiter from "./ratelimiter";
import { redisClient } from "./redisclient";
import { invalidateKeys, normalizeURLAndGenerateHash } from "./utils";
const { createServer } = http;
config();
const numOfCPUs = availableParallelism();
const PORT = process.env.PORT;
const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE);
const BASE_URL: string = process.env.BASE_URL ?? "";
if (cluster.isPrimary) {
  //console.log(`Primary ${process.pid} is running`);
  for (let i = 0; i < numOfCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    //  console.log(`worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  //  console.log(`Worker ${process.pid} started`);
  const server = createServer(async (req, res) => {
    try {
      const ip: any =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      //  console.log("remote address ",ip)
      try {
        await rateLimiter.consume(ip);
      } catch (rejRes: any) {
        res.statusCode = 429;
        res.setHeader(
          "Retry-After",
          String(Math.ceil(rejRes.msBeforeNext / 1000))
        );
        return res.end(JSON.stringify({ error: "Too Many Requests" }));
      }
      let body = "";
      req.on("data", (chunk) => {
        if (body.length > MAX_BODY_SIZE) {
          res.statusCode = 413;
          return res.end("Payload Too Large");
        }
        try {
          body += chunk;
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
      req.on("end", async () => {
        try {
          const url: string = BASE_URL + req.url;
          const method: string | undefined = req.method;
          const headers = req.headers;

          const data = await forwardRequest(
            url,
            method,
            body,
            headers,
            req.url
          );
          res.setHeader("Content-Type", "application/json");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-Frame-Options", "DENY");
          res.setHeader("X-XSS-Protection", "1; mode=block");
          res.setHeader("Referrer-Policy", "no-referrer");
          res.setHeader(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
          );

          res.setHeader("Content-Security-Policy", "default-src 'self'");
          res.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

          if (data?.Message === "This method is not supported") {
            res.statusCode = 405;
          }

          res.end(JSON.stringify(data));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
      req.on("error", (err) => {
        console.error("Request stream error ", err);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid Stream Request" }));
      });
    } catch (err) {
      console.error(err);
    }
  });

  const forwardRequest = async (
    url: string,
    method: string | undefined,
    body: any,
    headers: any,
    requestUrl: string | undefined
  ) => {
    try {
      const hopByHopHeaders = [
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
      ];
      const filteredHeaders: any = {};
      for (const [key, value] of Object.entries(headers)) {
        if (!hopByHopHeaders.includes(key.toLowerCase())) {
          filteredHeaders[key] = value;
        }
      }
      const pathSegments = (requestUrl || "/").split("/").filter(Boolean);
      const tagName = pathSegments[0] ?? "General";
      const cacheTagName = `tag:${tagName}`;
      const hash = normalizeURLAndGenerateHash(url);
      // console.log('cache tag name ',cacheTagName);

      const cacheKey = `cache:${method}:${hash}`;
      if (method == "GET") {
       // console.log("Cache key ", cacheKey);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
       //   console.log("cache hit");

          return JSON.parse(cachedData);
        }

        const request = await axios.get(url, { headers: filteredHeaders });
        const data = request.data;
      //  console.log("cache miss");
        await redisClient.set(
          cacheKey,
          JSON.stringify(data),
          "EX",
          Number(process.env.CACHE_TTL) ?? 60
        );
        await redisClient.sadd(cacheTagName, cacheKey);
        return data;
      } else if (method == "POST") {
        let parsedBody = {};
        if (body) {
          parsedBody = JSON.parse(body);
        }
        await redisClient.del(cacheKey);
        const request = await axios.post(url, parsedBody, {
          headers: filteredHeaders,
          timeout: Number(process.env.UPSTREAM_AXIOS_REQUEST_TTL),
        });

        await invalidateKeys(cacheTagName);
        const data = request.data;
        return data;
      } else if (method == "PUT") {
        let parsedBody = {};
        if (body) {
          parsedBody = JSON.parse(body);
        }

        const request = await axios.put(url, parsedBody, {
          headers: filteredHeaders,
          timeout: Number(process.env.UPSTREAM_AXIOS_REQUEST_TTL),
        });
        const data = request.data;

        await invalidateKeys(cacheTagName);
        return data;
      } else if (method == "PATCH") {
        let parsedBody = {};
        if (body) {
          parsedBody = JSON.parse(body);
        }
        await redisClient.del(cacheKey);
        const request = await axios.patch(url, parsedBody, {
          headers: filteredHeaders,
          timeout: Number(process.env.UPSTREAM_AXIOS_REQUEST_TTL),
        });
        const data = request.data;

        await invalidateKeys(cacheTagName);
        return data;
      } else if (method == "DELETE") {
        const request = await axios.delete(url, {
          headers: filteredHeaders,
          timeout: Number(process.env.UPSTREAM_AXIOS_REQUEST_TTL),
        });
        await redisClient.del(cacheKey);

        await invalidateKeys(cacheTagName);
        return request.data;
      }
      // console.log("else case");

      return { Message: "This method is not supported" };
    } catch (err) {
      console.error(err);

      return { error: "Upstream request failed" };
    }
  };

  server.listen(PORT, () => {
    //console.log(`listening on port ${PORT}`);
  });
  process.on("SIGINT", async () => {
    console.log("Received SIGINT Signal.Cleaning up");
    server.close(() => {
      console.log("Closing Http Server");
    });
    try {
      await redisClient.quit();
      console.log("Redis Client Closed");
    } catch (err) {
      console.error(err);
    } finally {
      process.exit(0);
    }
  });
  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM Signal.Cleaning up");
    server.close(() => {
      console.log("Closing Http Server");
    });
    try {
      await redisClient.quit();
      console.log("Redis Client Closed");
    } catch (err) {
      console.error(err);
    } finally {
      process.exit(0);
    }
  });
}
