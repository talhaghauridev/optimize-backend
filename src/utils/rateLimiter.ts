import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
   minuteRequests: number[];
   burstRequests: number[];
}

export class RateLimiter {
   private limits: Map<string, RateLimitEntry>;
   private readonly MINUTE_LIMIT = 10;
   private readonly BURST_LIMIT = 5;
   private readonly MINUTE_WINDOW = 60 * 1000; // 60 seconds
   private readonly BURST_WINDOW = 10 * 1000; // 10 seconds

   constructor() {
      this.limits = new Map();

      setInterval(() => {
         const now = Date.now();
         for (const [key, entry] of this.limits.entries()) {
            if (entry.minuteRequests.length === 0 || now - entry.minuteRequests[0] > this.MINUTE_WINDOW * 2) {
               this.limits.delete(key);
            }
         }
      }, 120000);
   }

   middleware() {
      return (req: Request, res: Response, next: NextFunction) => {
         const identifier = this.getIdentifier(req);

         if (this.isRateLimited(identifier)) {
            return res.status(429).json({
               success: false,
               message: "Rate limit exceeded. Please try again later.",
               error: "TOO_MANY_REQUESTS",
               retryAfter: "10 seconds"
            });
         }

         this.recordRequest(identifier);
         next();
      };
   }

   private isRateLimited(identifier: string): boolean {
      const now = Date.now();
      const entry = this.limits.get(identifier);

      if (!entry) return false;

      entry.minuteRequests = entry.minuteRequests.filter((timestamp) => now - timestamp < this.MINUTE_WINDOW);
      entry.burstRequests = entry.burstRequests.filter((timestamp) => now - timestamp < this.BURST_WINDOW);

      const minuteExceeded = entry.minuteRequests.length >= this.MINUTE_LIMIT;
      const burstExceeded = entry.burstRequests.length >= this.BURST_LIMIT;

      return minuteExceeded || burstExceeded;
   }

   private recordRequest(identifier: string): void {
      const now = Date.now();
      const entry = this.limits.get(identifier) || {
         minuteRequests: [],
         burstRequests: []
      };

      entry.minuteRequests.push(now);
      entry.burstRequests.push(now);

      this.limits.set(identifier, entry);
   }

   private getIdentifier(req: Request): string {
      return req.ip || req.socket.remoteAddress || "unknown";
   }

   clear(): void {
      this.limits.clear();
   }
}
