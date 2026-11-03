class Player {
    constructor(id, nickname, guildName, allianceName, faction, items, spells) {
        this.id = String(id);
        this.nickname = nickname;
        this.guildName = guildName || '';
        this.allianceName = allianceName || '';
        this.faction = Number.isFinite(faction) ? faction : 0;
        this.flagId = this.faction;
        this.items = Array.isArray(items) ? items : [];
        this.spells = Array.isArray(spells) ? spells : [];
        this.currentHealth = null;
        this.initialHealth = null;
        this.mounted = false;
        this.detectedAt = Date.now();
    }
}

export class PlayersHandler {
    constructor(settings) {
        this.playersInRange = [];
        this.settings = settings;
        this.maxTrackedPlayers = 100;
        this.ignorePlayers = [];
        this.ignoreGuilds = [];
        this.ignoreAlliances = [];

        for (const entry of this.settings.ignoreList || []) {
            const name = String(entry?.Name || '').trim().toUpperCase();
            if (!name) continue;
            if (entry.Type === 'Guild') this.ignoreGuilds.push(name);
            else if (entry.Type === 'Alliance') this.ignoreAlliances.push(name);
            else this.ignorePlayers.push(name);
        }
    }

    getPlayersInRange() {
        return [...this.playersInRange];
    }

    handleNewPlayerEvent(parameters) {
        // Protocol18 NewCharacter (29): these identity/equipment fields are
        // observed in current captures. No plaintext position is available.
        const id = parameters[0];
        const nickname = parameters[1];
        if (id === undefined || typeof nickname !== 'string' || !nickname.trim()) return;

        const guildName = typeof parameters[8] === 'string' ? parameters[8] : '';
        const allianceName = typeof parameters[51] === 'string' ? parameters[51] : '';
        const faction = Number(parameters[53] ?? 0);
        const items = Array.isArray(parameters[40]) ? parameters[40] : [];
        const spells = Array.isArray(parameters[43]) ? parameters[43] : [];
        const nameKey = nickname.trim().toUpperCase();
        const guildKey = guildName.trim().toUpperCase();
        const allianceKey = allianceName.trim().toUpperCase();

        if (this.ignorePlayers.includes(nameKey)
            || this.ignoreGuilds.includes(guildKey)
            || this.ignoreAlliances.includes(allianceKey)) return;

        const playerId = String(id);
        let player = this.playersInRange.find((entry) => entry.id === playerId);
        if (!player) {
            if (this.playersInRange.length >= this.maxTrackedPlayers) this.playersInRange.shift();
            player = new Player(playerId, nickname, guildName, allianceName, faction, items, spells);
            this.playersInRange.push(player);
            return;
        }

        player.nickname = nickname;
        player.guildName = guildName;
        player.allianceName = allianceName;
        player.faction = Number.isFinite(faction) ? faction : player.faction;
        player.flagId = player.faction;
        if (items.length) player.items = items;
        if (spells.length) player.spells = spells;
        player.detectedAt = Date.now();
    }

    handleMountedPlayerEvent(id, parameters) {
        const mounted = parameters[11] === 'true' || parameters[11] === true || parameters[10] == '-1';
        this.updatePlayerMounted(id, mounted);
    }

    updatePlayerMounted(id, mounted) {
        const player = this.playersInRange.find((entry) => entry.id === String(id));
        if (player) player.mounted = Boolean(mounted);
    }

    updateItems(id, parameters) {
        const player = this.playersInRange.find((entry) => entry.id === String(id));
        const items = parameters[2];
        if (player && Array.isArray(items)) player.items = items;
    }

    UpdatePlayerHealth(parameters) {
        const player = this.playersInRange.find((entry) => entry.id === String(parameters[0]));
        if (!player) return;
        if (Number.isFinite(parameters[2])) player.currentHealth = parameters[2];
        if (Number.isFinite(parameters[3])) player.initialHealth = parameters[3];
    }

    updatePlayerPosition() {
        // Intentionally unused: passive player movement coordinates are encrypted.
    }

    removePlayer(id) {
        const playerId = String(id);
        this.playersInRange = this.playersInRange.filter((entry) => entry.id !== playerId);
    }

    clear() {
        this.playersInRange = [];
    }
}
