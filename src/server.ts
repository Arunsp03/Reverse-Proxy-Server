import http from "node:http";
import { config } from "dotenv";
import axios from "axios";
const { createServer } = http;
config();
const PORT = process.env.PORT;
const BASE_URL: string = process.env.BASE_URL ?? "";
const server = createServer(async (req, res) => {
  try {
    let body = "";
    req.on("data", (chunk) => {
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

       
        const data = await forwardRequest(url, method, body, headers);
         if (data?.Message === "This method is not supported") {
      res.statusCode = 405; // Method Not Allowed
    }
// console.log("data ",data);

        res.end(JSON.stringify(data));
      } catch (err) {
        console.error(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    });
  } catch (err) {
    console.error(err);
  }
});

const forwardRequest = async (
  url: string,
  method: string | undefined,
  body: any,
  headers: any
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
    if (method == "GET") {
      const request = await axios.get(url, { headers: filteredHeaders });
      const data = request.data;
      return data;
    } else if (method == "POST") {
      let parsedBody = {};
      if (body) {
        parsedBody = JSON.parse(body);
      }

      const request = await axios.post(url, parsedBody, {
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

      const request = await axios.put(url, parsedBody, {
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

      const request = await axios.patch(url, parsedBody, {
        headers: filteredHeaders,
      });
      const data = request.data;
      return data;
    }
    else if (method == "DELETE") {
  const request = await axios.delete(url, { headers: filteredHeaders });
  return request.data;
}
console.log("else case");

    return { Message: "This method is not supported" };
  } catch (err) {
    console.error(err);

    return { error: "Upstream request failed" };
  }
};

server.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
