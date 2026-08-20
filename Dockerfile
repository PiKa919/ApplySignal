FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json ./
RUN bun install --production --no-save

COPY src ./src
COPY docs ./docs
COPY README.md ./README.md
COPY data/applysignal.db ./data/applysignal.db
# Keep compatibility with the existing Render service-level override until its
# environment is synchronized to /app/data/applysignal.db.
COPY data/applysignal.db /tmp/applysignal.db

ENV APPLYSIGNAL_DB=/app/data/applysignal.db
ENV APPLYSIGNAL_LIVE_ONLY=true
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
