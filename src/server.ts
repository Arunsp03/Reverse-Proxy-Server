import http from "node:http";
import { config } from "dotenv";
import cluster from "node:cluster";
import process from "node:process";
import axios from "axios";
import { availableParallelism } from "node:os";
import rateLimiter from "./ratelimiter";
const { createServer } = http;
config();
const numOfCPUs = availableParallelism();
const PORT = process.env.PORT;
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
      const ip:any=req.headers["x-forwarded-for"]||req.socket.remoteAddress ||  "unknown";
    //  console.log("remote address ",ip)
      try {
      await rateLimiter.consume(ip);
    } catch (rejRes:any) {
      res.statusCode = 429;
      res.setHeader('Retry-After', String(Math.ceil(rejRes.msBeforeNext / 1000)));
      return res.end(JSON.stringify({ error: 'Too Many Requests' }));
    }
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
          res.setHeader("Content-Type", "application/json");
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
      req.on('error',(err)=>{
        console.error("Request stream error ",err);
        res.statusCode=400;
        res.end(JSON.stringify({ error: "Invalid Stream Request" }))

        
      })
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
      } else if (method == "PUT") {
        let parsedBody = {};
        if (body) {
          parsedBody = JSON.parse(body);
        }

        const request = await axios.put(url, parsedBody, {
          headers: filteredHeaders,
        });
        const data = request.data;
        return data;
      } else if (method == "PATCH") {
        let parsedBody = {};
        if (body) {
          parsedBody = JSON.parse(body);
        }

        const request = await axios.patch(url, parsedBody, {
          headers: filteredHeaders,
        });
        const data = request.data;
        return data;
      } else if (method == "DELETE") {
        const request = await axios.delete(url, { headers: filteredHeaders });
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

}
