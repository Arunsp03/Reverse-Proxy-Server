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
const axios_1 = __importDefault(require("axios"));
const { createServer } = node_http_1.default;
(0, dotenv_1.config)();
const PORT = process.env.PORT;
const BASE_URL = (_a = process.env.BASE_URL) !== null && _a !== void 0 ? _a : "";
const server = createServer((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let body = "";
        req.on("data", (chunk) => {
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
                const data = yield forwardRequest(url, method, body, headers);
                if ((data === null || data === void 0 ? void 0 : data.Message) === "This method is not supported") {
                    res.statusCode = 405; // Method Not Allowed
                }
                // console.log("data ",data);
                res.end(JSON.stringify(data));
            }
            catch (err) {
                console.error(err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Internal Server Error" }));
            }
        }));
    }
    catch (err) {
        console.error(err);
    }
}));
const forwardRequest = (url, method, body, headers) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (method == "GET") {
            const request = yield axios_1.default.get(url, { headers: filteredHeaders });
            const data = request.data;
            return data;
        }
        else if (method == "POST") {
            let parsedBody = {};
            if (body) {
                parsedBody = JSON.parse(body);
            }
            const request = yield axios_1.default.post(url, parsedBody, {
                headers: filteredHeaders,
            });
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
            });
            const data = request.data;
            return data;
        }
        else if (method == "PATCH") {
            let parsedBody = {};
            if (body) {
                parsedBody = JSON.parse(body);
            }
            const request = yield axios_1.default.patch(url, parsedBody, {
                headers: filteredHeaders,
            });
            const data = request.data;
            return data;
        }
        else if (method == "DELETE") {
            const request = yield axios_1.default.delete(url, { headers: filteredHeaders });
            return request.data;
        }
        console.log("else case");
        return { Message: "This method is not supported" };
    }
    catch (err) {
        console.error(err);
        return { error: "Upstream request failed" };
    }
});
server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
