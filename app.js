
const express = require('express');
const logger = require('./scripts/logger');
const PhotonParser = require('./scripts/classes/PhotonPacketParser');
let Cap;
let decoders;
try {
  ({ Cap, decoders } = require('cap'));
} catch (error) {
  logger.error(`O módulo nativo cap não carregou. Confirme Npcap e execute npm rebuild cap. Detalhe: ${error.message}`, error);
  process.exit(1);
}
const WebSocket = require('ws');

const fs = require("fs");

const { getAdapterIp } = require('./server-scripts/adapter-selector');



const app = express();


BigInt.prototype.toJSON = function() { return this.toString() }

app.use(express.static(__dirname + '/views'));
app.set('view engine', 'ejs');



app.get('/', (req, res) => {
  const viewName = 'main/home'; 
  res.render('layout', { mainContent: viewName});
});

app.get('/home', (req, res) => {
  const viewName = 'main/home'; 
  res.render('./layout', { mainContent: viewName});
});

app.get('/resources', (req, res) => {
  const viewName = 'main/resources'; 
  res.render('layout', { mainContent: viewName });
});

app.get('/enemies', (req, res) => {
  const viewName = 'main/enemies'; 
  res.render('layout', { mainContent: viewName });
});

app.get('/chests', (req, res) => {
  const viewName = 'main/chests'; 
  res.render('layout', { mainContent: viewName });
});

app.get('/map', (req, res) => {
  const viewName = 'main/map';
  const viewRequireName = 'main/require-map'

  fs.access("./images/Maps", function(error) {
    if (error)
    {
      res.render('layout', { mainContent: viewRequireName });
    }
    else
    {
      res.render('layout', { mainContent: viewName });
    }
  });
});

app.get('/ignorelist', (req, res) => {
  const viewName = 'main/ignorelist'; 
  res.render('layout', { mainContent: viewName });
});

app.get('/settings', (req, res) => {
  const viewName = 'main/settings'; 
  res.render('layout', { mainContent: viewName });
});




app.get('/drawing', (req, res) => {

  res.render('main/drawing');
});

app.get('/logout', (req, res) => {
  res.redirect('/');
});



app.use('/scripts', express.static(__dirname + '/scripts'))
app.use('/scripts/Handlers', express.static(__dirname + '/scripts/Handlers'))
app.use('/scripts/Drawings', express.static(__dirname + '/scripts/Drawings'))
app.use('/scripts/Utils', express.static(__dirname + '/scripts/Utils'));;
app.use('/images/Resources', express.static(__dirname + '/images/Resources'));
app.use('/images/Maps', express.static(__dirname + '/images/Maps'));
app.use('/images/Items', express.static(__dirname + '/images/Items'));
app.use('/images/Flags', express.static(__dirname + '/images/Flags'));
app.use('/sounds', express.static(__dirname + '/sounds'));
app.use('/config', express.static(__dirname + '/config'));



const port = 5001;
const host = '127.0.0.1';

async function start() {
  const interfaces = Cap.deviceList();
  if (!interfaces.length) throw new Error('Npcap não encontrou adaptadores. Confirme que o serviço Npcap está instalado e em execução.');

  const manager = new PhotonParser();
  const savedIp = fs.existsSync('ip.txt') ? fs.readFileSync('ip.txt', 'utf8').trim() : '';
  let adapterIp = savedIp;
  let device = adapterIp ? Cap.findDevice(adapterIp) : undefined;
  if (!device) {
    if (savedIp) logger.warn(`Adaptador salvo ${savedIp} não está disponível; selecione outro.`);
    adapterIp = await getAdapterIp();
    device = Cap.findDevice(adapterIp);
  }
  if (!device) throw new Error(`Npcap não reconhece o adaptador ${adapterIp}. Escolha um adaptador de rede ativo.`);
  fs.writeFileSync('ip.txt', adapterIp, 'utf8');

  const capture = new Cap();
  const buffer = Buffer.alloc(4096);
  try {
    capture.open(device, 'udp and (dst port 5056 or src port 5056)', buffer.length, buffer);
  } catch (error) {
    throw new Error(`Npcap não conseguiu abrir o adaptador ${adapterIp}. Execute PowerShell como Administrador e confirme que Npcap está ativo. Detalhe: ${error.message}`);
  }
  let lastPacketWarning = 0;
  capture.on('packet', (nbytes) => {
    try {
      let decoded = decoders.Ethernet(buffer);
      if (decoded.info.type !== decoders.PROTOCOL.ETHERNET.IPV4) return;
      decoded = decoders.IPV4(buffer, decoded.offset);
      if (decoded.info.protocol !== decoders.PROTOCOL.IP.UDP) return;
      decoded = decoders.UDP(buffer, decoded.offset);
      manager.handle(buffer.slice(decoded.offset, nbytes));
    } catch (error) {
      const now = Date.now();
      if (now - lastPacketWarning >= 5000) {
        logger.warn(`Falha ao decodificar pacote (avisos limitados a um por 5 segundos): ${error.message}`);
        lastPacketWarning = now;
      }
    }
  });

  const httpServer = app.listen(port, host);
  await new Promise((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
  }).catch((error) => {
    capture.close();
    if (error.code === 'EADDRINUSE') throw new Error(`A porta ${port} já está ocupada. Feche o processo que a utiliza ou libere a porta.`);
    throw error;
  });
  logger.info(`Interface web disponível em http://${host}:${port}; adaptador ${adapterIp}`);

  const wsServer = new WebSocket.Server({ port: 5002, host });
  wsServer.on('error', (error) => {
    const message = error.code === 'EADDRINUSE'
      ? 'A porta 5002 do WebSocket já está ocupada. Feche o processo que a utiliza ou libere a porta.'
      : 'Falha ao iniciar o servidor WebSocket local.';
    logger.error(message, error);
    capture.close();
    httpServer.close();
    process.exitCode = 1;
  });
  for (const eventName of ['event', 'request', 'response']) {
    manager.on(eventName, (dictionary) => {
      const message = JSON.stringify({ code: eventName, dictionary: JSON.stringify(dictionary) });
      wsServer.clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
    });
  }
  logger.info('Captura Npcap e WebSocket local iniciados.');
}

start().catch((error) => {
  logger.error(error.message, error);
  process.exitCode = 1;
});




