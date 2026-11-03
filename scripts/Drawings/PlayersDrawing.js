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

        const slotSize = 36;
        const gap = 8;
        const columns = Math.floor((canvas.width - 16) / (slotSize + gap));
        let y = 16;
        for (const player of players) {
            if (y + 64 > canvas.height) break;
            this.drawTextItems(8, y + 12, player.nickname, context, '13px', 'white');

            const equipped = (player.items || []).filter((itemId) => Number(itemId) > 0);
            equipped.forEach((itemId, index) => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                const x = 8 + column * (slotSize + gap);
                const imageName = this.itemsInfo[itemId];
                const baseName = typeof imageName === 'string' ? imageName.split('@')[0] : '_default';
                const safeName = /^[A-Za-z0-9_]+$/.test(baseName) ? baseName : '_default';
                const imagePaths = [
                    `/images/Items/${safeName}.webp`,
                    `/images/Items/${safeName}.png`,
                ];
                let image;
                for (const imagePath of imagePaths) {
                    const candidate = this.settings.GetPreloadedImage(imagePath, 'Items');
                    if (candidate === undefined) this.loadImageOnce(imagePath, 'Items');
                    if (candidate) {
                        image = candidate;
                        break;
                    }
                }
                if (!image) {
                    const fallbackPath = '/images/Items/_default.webp';
                    image = this.settings.GetPreloadedImage(fallbackPath, 'Items');
                    if (image === undefined) this.loadImageOnce(fallbackPath, 'Items');
                }

                const iconY = y + 20 + row * 43;
                if (image) context.drawImage(image, x, iconY, slotSize, slotSize);
                if (devMode && imageName)
                    this.drawTextItems(x, iconY + slotSize + 8, String(itemId), context, '9px', '#aaa');

                const enchant = typeof imageName === 'string' ? imageName.match(/@(\d+)$/) : null;
                if (enchant && Number(enchant[1]) > 0) {
                    context.fillStyle = '#20232a';
                    context.fillRect(x + slotSize - 13, iconY + slotSize - 13, 13, 13);
                    this.drawTextItems(x + slotSize - 10, iconY + slotSize - 3, enchant[1], context, '9px', '#fff');
                }
            });

            const slotRows = Math.max(1, Math.ceil(equipped.length / columns));
            y += 24 + slotRows * 43;
            if (Number.isFinite(player.currentHealth) && Number.isFinite(player.initialHealth)) {
                this.drawTextItems(8, y, `${player.currentHealth}/${player.initialHealth}`, context, '11px', '#ff7777');
                y += 14;
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
