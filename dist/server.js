"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const dotenv_1 = require("dotenv");
const node_cluster_1 = __importDefault(require("node:cluster"));
const node_process_1 = __importDefault(require("node:process"));
const axios_1 = __importDefault(require("axios"));
const node_os_1 = require("node:os");
const ratelimiter_1 = __importDefault(require("./ratelimiter"));
const redisclient_1 = require("./redisclient");
const utils_1 = require("./utils");
const { createServer } = node_http_1.default;
(0, dotenv_1.config)();
const numOfCPUs = (0, node_os_1.availableParallelism)();
const PORT = node_process_1.default.env.PORT;
const MAX_BODY_SIZE = Number(node_process_1.default.env.MAX_BODY_SIZE);
const BASE_URL = (_a = node_process_1.default.env.BASE_URL) !== null && _a !== void 0 ? _a : "";
if (node_cluster_1.default.isPrimary) {
    //console.log(`Primary ${process.pid} is running`);
    for (let i = 0; i < numOfCPUs; i++) {
        node_cluster_1.default.fork();
    }
    node_cluster_1.default.on("exit", (worker, code, signal) => {
        //  console.log(`worker ${worker.process.pid} died`);
        node_cluster_1.default.fork();
    });
}
else {
    //  console.log(`Worker ${process.pid} started`);
    const server = createServer((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
            //  console.log("remote address ",ip)
            try {
                yield ratelimiter_1.default.consume(ip);
            }
            catch (rejRes) {
                res.statusCode = 429;
                res.setHeader("Retry-After", String(Math.ceil(rejRes.msBeforeNext / 1000)));
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
                }
                catch (err) {
                    console.error(err);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "Internal Server Error" }));
                }
            });
            req.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const url = BASE_URL + req.url;
                    const method = req.method;
                    const headers = req.headers;
                    const data = yield forwardRequest(url, method, body, headers, req.url);
                    res.setHeader("Content-Type", "application/json");
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    res.setHeader("X-Frame-Options", "DENY");
                    res.setHeader("X-XSS-Protection", "1; mode=block");
                    res.setHeader("Referrer-Policy", "no-referrer");
                    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
                    res.setHeader("Content-Security-Policy", "default-src 'self'");
                    res.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
                    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                    if ((data === null || data === void 0 ? void 0 : data.Message) === "This method is not supported") {
                        res.statusCode = 405;
                    }
                    res.end(JSON.stringify(data));
                }
                catch (err) {
                    console.error(err);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "Internal Server Error" }));
                }
            }));
            req.on("error", (err) => {
                console.error("Request stream error ", err);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid Stream Request" }));
            });
        }
        catch (err) {
            console.error(err);
        }
    }));
    const forwardRequest = (url, method, body, headers, requestUrl) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
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
            const filteredHeaders = {};
            for (const [key, value] of Object.entries(headers)) {
                if (!hopByHopHeaders.includes(key.toLowerCase())) {
                    filteredHeaders[key] = value;
                }
            }
            const pathSegments = (requestUrl || "/").split("/").filter(Boolean);
            const tagName = (_a = pathSegments[0]) !== null && _a !== void 0 ? _a : "General";
            const cacheTagName = `tag:${tagName}`;
            const hash = (0, utils_1.normalizeURLAndGenerateHash)(url);
            // console.log('cache tag name ',cacheTagName);
            const cacheKey = `cache:${method}:${hash}`;
            if (method == "GET") {
                // console.log("Cache key ", cacheKey);
                const cachedData = yield redisclient_1.redisClient.get(cacheKey);
                if (cachedData) {
                    //   console.log("cache hit");
                    return JSON.parse(cachedData);
                }
                const request = yield axios_1.default.get(url, { headers: filteredHeaders });
                const data = request.data;
                //  console.log("cache miss");
                yield redisclient_1.redisClient.set(cacheKey, JSON.stringify(data), "EX", (_b = Number(node_process_1.default.env.CACHE_TTL)) !== null && _b !== void 0 ? _b : 60);
                yield redisclient_1.redisClient.sadd(cacheTagName, cacheKey);
                return data;
            }
            else if (method == "POST") {
                let parsedBody = {};
                if (body) {
                    parsedBody = JSON.parse(body);
                }
                yield redisclient_1.redisClient.del(cacheKey);
                const request = yield axios_1.default.post(url, parsedBody, {
                    headers: filteredHeaders,
                    timeout: Number(node_process_1.default.env.UPSTREAM_AXIOS_REQUEST_TTL),
                });
                yield (0, utils_1.invalidateKeys)(cacheTagName);
                const data = request.data;
                return data;
            }
            else if (method == "PUT") {
                let parsedBody = {};
                if (body) {
                    parsedBody = JSON.parse(body);
                }
                const request = yield axios_1.default.put(url, parsedBody, {
                    headers: filteredHeaders,
                    timeout: Number(node_process_1.default.env.UPSTREAM_AXIOS_REQUEST_TTL),
                });
                const data = request.data;
                yield (0, utils_1.invalidateKeys)(cacheTagName);
                return data;
            }
            else if (method == "PATCH") {
                let parsedBody = {};
                if (body) {
                    parsedBody = JSON.parse(body);
                }
                yield redisclient_1.redisClient.del(cacheKey);
                const request = yield axios_1.default.patch(url, parsedBody, {
                    headers: filteredHeaders,
                    timeout: Number(node_process_1.default.env.UPSTREAM_AXIOS_REQUEST_TTL),
                });
                const data = request.data;
                yield (0, utils_1.invalidateKeys)(cacheTagName);
                return data;
            }
            else if (method == "DELETE") {
                const request = yield axios_1.default.delete(url, {
                    headers: filteredHeaders,
                    timeout: Number(node_process_1.default.env.UPSTREAM_AXIOS_REQUEST_TTL),
                });
                yield redisclient_1.redisClient.del(cacheKey);
                yield (0, utils_1.invalidateKeys)(cacheTagName);
                return request.data;
            }
            // console.log("else case");
            return { Message: "This method is not supported" };
        }
        catch (err) {
            console.error(err);
            return { error: "Upstream request failed" };
        }
    });
    server.listen(PORT, () => {
        //console.log(`listening on port ${PORT}`);
    });
    node_process_1.default.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Received SIGINT Signal.Cleaning up");
        server.close(() => {
            console.log("Closing Http Server");
        });
        try {
            yield redisclient_1.redisClient.quit();
            console.log("Redis Client Closed");
        }
        catch (err) {
            console.error(err);
        }
        finally {
            node_process_1.default.exit(0);
        }
    }));
    node_process_1.default.on("SIGTERM", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Received SIGTERM Signal.Cleaning up");
        server.close(() => {
            console.log("Closing Http Server");
        });
        try {
            yield redisclient_1.redisClient.quit();
            console.log("Redis Client Closed");
        }
        catch (err) {
            console.error(err);
        }
        finally {
            node_process_1.default.exit(0);
        }
    }));
}
