import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const adminDist = path.join(__dirname, 'admin', 'dist');
app.use('/admin', express.static(adminDist));
app.get(/^\/admin/, (req, res) => { res.sendFile(path.join(adminDist, 'index.html')); });
const srv = app.listen(5577, () => {
  console.log('OK');
  const http = require || (await import('http'));
});
