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
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeURLAndGenerateHash = exports.invalidateKeys = void 0;
const redisclient_1 = require("./redisclient");
const node_crypto_1 = require("node:crypto");
const invalidateKeys = (tagName) => __awaiter(void 0, void 0, void 0, function* () {
    const keys = yield redisclient_1.redisClient.smembers(tagName);
    if (keys.length) {
        yield redisclient_1.redisClient.del(...keys);
    }
    yield redisclient_1.redisClient.del(tagName);
});
exports.invalidateKeys = invalidateKeys;
const normalizeURLAndGenerateHash = (url) => {
    const urlObj = new URL(url);
    const orderedSearchParams = [...urlObj.searchParams.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("#");
    //console.log("orderded params ", orderedSearchParams);
    const normalizedPath = urlObj.pathname;
    const normalizedURL = orderedSearchParams
        ? `${normalizedPath}&${orderedSearchParams}`
        : normalizedPath;
    const hash = (0, node_crypto_1.createHash)("sha256").update(normalizedURL).digest("hex");
    return hash;
};
exports.normalizeURLAndGenerateHash = normalizeURLAndGenerateHash;
