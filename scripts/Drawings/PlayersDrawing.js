export class PlayersDrawing extends DrawingUtils {
    constructor(settings) {
        super(settings);
        this.itemsInfo = {};
    }

    updateItemsInfo(itemsInfo) {
        this.itemsInfo = itemsInfo;
    }

    drawItems(context, canvas, players, devMode) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!players.length) return;

        let x = 8;
        let y = 20;
        for (const player of players) {
            if (y + 48 > canvas.height) break;
            this.drawTextItems(x, y, player.nickname, context, '14px', 'white');
            if (Number.isFinite(player.currentHealth) && Number.isFinite(player.initialHealth)) {
                const health = `${player.currentHealth}/${player.initialHealth}`;
                this.drawTextItems(x + 190, y, health, context, '12px', '#ff7777');
            }

            y += 22;
            if (player.items?.length) {
                for (const itemId of player.items) {
                    const image = this.itemsInfo[itemId];
                    if (image && this.settings.GetPreloadedImage(image, 'Items') !== null)
                        this.DrawCustomImage(context, x + 20, y + 16, image, 'Items', 32);
                    x += 38;
                }
                if (devMode)
                    this.drawTextItems(x + 6, y + 20, player.items.join(' '), context, '11px', '#aaa');
                x = 8;
                y += 38;
            } else {
                this.drawTextItems(x, y, `${player.guildName || 'Sem guilda'}${player.allianceName ? ` · ${player.allianceName}` : ''}`, context, '11px', '#aaa');
                y += 28;
            }
        }
    }

    interpolate() {
        // Passive player movement coordinates are encrypted; do not invent a position.
    }

    invalidate() {
        // Players are listed separately and are not drawn at guessed coordinates.
    }
}
