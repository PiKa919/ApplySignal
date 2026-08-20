FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json ./
RUN bun install --production --no-save

COPY src ./src
COPY docs ./docs
COPY README.md ./README.md

ENV APPLYSIGNAL_DB=/tmp/applysignal.db
ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "if [ ! -f \"$APPLYSIGNAL_DB\" ]; then bun run seed:fixture; fi; exec bun run src/index.ts"]
