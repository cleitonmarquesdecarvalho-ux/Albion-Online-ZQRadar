const os = require('node:os');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

async function getAdapterIp() {
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    (entries || [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal && entry.address !== '127.0.0.1')
      .map((entry) => ({ name, address: entry.address }))
  );
  if (!candidates.length) throw new Error('Nenhum adaptador IPv4 ativo foi encontrado. Verifique a conexão de rede.');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      console.log('Selecione o adaptador usado pela conexão do jogo:');
      candidates.forEach((item, index) => console.log(`  ${index + 1}. ${item.name} — ${item.address}`));
      const answer = (await rl.question('Número do adaptador: ')).trim();
      const index = Number(answer) - 1;
      if (Number.isInteger(index) && index >= 0 && index < candidates.length) return candidates[index].address;
      console.log('Seleção inválida. Digite um dos números listados.\n');
    }
  } finally {
    rl.close();
  }
}

module.exports = { getAdapterIp };
