const net = require("net");

const server = net.createServer((clientSocket) => {
  const pgSocket = net.connect(5432, "127.0.0.1");

  clientSocket.pipe(pgSocket);
  pgSocket.pipe(clientSocket);

  clientSocket.on("error", () => {});
  pgSocket.on("error", () => {});
  clientSocket.on("close", () => pgSocket.destroy());
  pgSocket.on("close", () => clientSocket.destroy());
});

server.listen(5434, "127.0.0.1", () => {
  console.log("PostgreSQL proxy listening on 127.0.0.1:5434 -> 127.0.0.1:5432");
});
