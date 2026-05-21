#!/usr/bin/env node
/**
 * MotionAI — y-webrtc Signaling Server
 * Lightweight WebSocket server for WebRTC peer discovery.
 * No CRDT data flows through here — only signaling (offer/answer/ICE).
 */

import { WebSocketServer } from 'ws';
import http from 'http';

const port = process.env.PORT || 3005;
const topics = new Map(); // topicName → Set<WebSocket>

const send = (conn, msg) => {
  if (conn.readyState !== 0 && conn.readyState !== 1) return;
  try { conn.send(JSON.stringify(msg)); } catch { conn.close(); }
};

const onconnection = (conn) => {
  const subscribed = new Set();
  let pongReceived = true;

  const pingInterval = setInterval(() => {
    if (!pongReceived) { conn.close(); clearInterval(pingInterval); }
    else {
      pongReceived = false;
      try { conn.ping(); } catch { conn.close(); }
    }
  }, 30000);

  conn.on('pong', () => { pongReceived = true; });

  conn.on('close', () => {
    subscribed.forEach((t) => topics.get(t)?.delete(conn));
    subscribed.clear();
    clearInterval(pingInterval);
  });

  conn.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg?.type) return;

    switch (msg.type) {
      case 'subscribe':
        (msg.topics || []).forEach((t) => {
          if (typeof t !== 'string') return;
          if (!topics.has(t)) topics.set(t, new Set());
          topics.get(t).add(conn);
          subscribed.add(t);
        });
        break;

      case 'unsubscribe':
        (msg.topics || []).forEach((t) => topics.get(t)?.delete(conn));
        break;

      case 'publish':
        if (msg.topic) {
          const peers = topics.get(msg.topic);
          if (peers) peers.forEach((p) => send(p, msg));
        }
        break;

      case 'ping':
        send(conn, { type: 'pong' });
    }
  });
};

const server = http.createServer((req, res) => {
  // HTTP health endpoint — used by systemd watchdog and load balancers
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    const peers = Array.from(topics.entries()).map(([topic, conns]) => ({
      topic,
      peers: conns.size,
    }));
    res.end(JSON.stringify({ status: 'ok', peers, uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, onconnection);
});

// Graceful shutdown on SIGTERM/SIGINT
const shutdown = (signal) => {
  console.log(`[signaling] ${signal} received — closing...`);
  wss.close(() => {
    server.close(() => {
      console.log(`[signaling] server stopped`);
      process.exit(0);
    });
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(port, '0.0.0.0', () => {
  console.log(`[signaling] y-webrtc signaling server running on ws://localhost:${port}`);
});

