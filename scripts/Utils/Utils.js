
import { PlayersDrawing } from '../Drawings/PlayersDrawing.js';
import { HarvestablesDrawing } from '../Drawings/HarvestablesDrawing.js';
import { MobsDrawing } from '../Drawings/MobsDrawing.js';
import { ChestsDrawing } from '../Drawings/ChestsDrawing.js';
import { DungeonsDrawing } from '../Drawings/DungeonsDrawing.js';
import { MapDrawing } from '../Drawings/MapsDrawing.js';
import { WispCageDrawing } from '../Drawings/WispCageDrawing.js';
import { FishingDrawing } from '../Drawings/FishingDrawing.js';

import { TrackFootprintsDrawing } from '../Drawings/TrackFootprintsDrawing.js';
import { EventCodes } from './EventCodes.js';

import { PlayersHandler } from '../Handlers/PlayersHandler.js';
import { WispCageHandler } from '../Handlers/WispCageHandler.js';
import { FishingHandler } from '../Handlers/FishingHandler.js';
import { TrackFootprintsHandler } from '../Handlers/TrackFootprintsHandler.js';

var canvasMap = document.getElementById("mapCanvas");
var contextMap = canvasMap.getContext("2d");

var canvasGrid = document.getElementById("gridCanvas");
var contextGrid = canvasGrid.getContext("2d");

var canvas = document.getElementById("drawCanvas");
var context = canvas.getContext("2d");

var canvasOurPlayer = document.getElementById("ourPlayerCanvas");
var contextOurPlayer = canvasOurPlayer .getContext("2d");


var canvasItems = document.getElementById("thirdCanvas");
var contextItems = canvasItems.getContext("2d");

const settings = new Settings();



const harvestablesDrawing = new HarvestablesDrawing(settings);
const dungeonsHandler = new DungeonsHandler(settings);

var itemsInfo = new ItemsInfo();
var mobsInfo = new MobsInfo();

const itemsInfoPromise = itemsInfo.initItems();
mobsInfo.initMobs();

var map = new MapH(-1);
const mapsDrawing = new MapDrawing(settings);

const chestsHandler = new ChestsHandler();
const mobsHandler = new MobsHandler(settings);
mobsHandler.updateMobInfo(mobsInfo.moblist);


const harvestablesHandler = new HarvestablesHandler(settings);
const playersHandler = new PlayersHandler(settings);

const wispCageHandler = new WispCageHandler(settings);
const wispCageDrawing = new WispCageDrawing(settings);

const fishingHandler = new FishingHandler(settings);
const fishingDrawing = new FishingDrawing(settings);

const chestsDrawing = new ChestsDrawing(settings);
const mobsDrawing = new MobsDrawing(settings);
const playersDrawing = new PlayersDrawing(settings);
const dungeonsDrawing = new DungeonsDrawing(settings);
const trackFootprintsHandler = new TrackFootprintsHandler(settings);
const trackFootprintsDrawing = new TrackFootprintsDrawing(settings);
let playerAlert = null;
playersDrawing.updateItemsInfo(itemsInfo.iteminfo);
itemsInfoPromise
    .then(() => playersDrawing.updateItemsInfo(itemsInfo.iteminfo))
    .catch((error) => console.warn(`Não foi possível carregar o catálogo de itens: ${error.message}`));


let lpX = 0.0;
let lpY = 0.0;

const drawingUtils = new DrawingUtils();
drawingUtils.initCanvas(canvas, context);
drawingUtils.initGridCanvas(canvasGrid, contextGrid);
drawingUtils.InitOurPlayerCanvas(canvasOurPlayer, contextOurPlayer);




const socket = new WebSocket('ws://localhost:5002');
      
socket.addEventListener('open', (event) => {
  console.log('Connected to the WebSocket server.');

});

socket.addEventListener('message', (event) => {
  var data = JSON.parse(event.data);

  // Extract the string and dictionary from the object
  var extractedString = data.code;

  var extractedDictionary = JSON.parse(data.dictionary);

  if (extractedString === "players_snapshot") {
    playersHandler.clear();
    for (const playerEvent of extractedDictionary) {
      if (playerEvent?.parameters) onEvent(playerEvent.parameters, true);
    }
    return;
  }

  switch (extractedString)
  {
    case "request":
        onRequest(extractedDictionary["parameters"]);
        break;

    case "event":
        onEvent(extractedDictionary["parameters"]);
        break;

    case "response":
        onResponse(extractedDictionary["parameters"]);
        break;
  }
});


function onEvent(Parameters, suppressAlerts = false)
{
    const id = parseInt(Parameters[0]);
    const eventCode = Parameters[252];

    switch (eventCode) {
        
        case EventCodes.Track:
            const trackPosX = Parameters[1][0];
            const trackPosY = Parameters[1][1];
            const name = Parameters[3];
            trackFootprintsHandler.addFootprint(id, trackPosX, trackPosY, name);
            break;

        case EventCodes.Leave:
            playersHandler.removePlayer(id);
            mobsHandler.removeMist(id);
            mobsHandler.removeMob(id);
            dungeonsHandler.RemoveDungeon(id);
            chestsHandler.removeChest(id);
            fishingHandler.RemoveFish(id);
            trackFootprintsHandler.removeFootprint(id);
            break;

        case EventCodes.Move:
            const posX = Parameters[4];
            const posY = Parameters[5];
            mobsHandler.updateMistPosition(id, posX, posY);
            mobsHandler.updateMobPosition(id, posX, posY);
            trackFootprintsHandler.updateFootprintPosition(id, posX, posY);
            break;

        case EventCodes.NewPlayer:
            const detection = playersHandler.handleNewPlayerEvent(Parameters);
            if (!suppressAlerts && detection?.isNew && detection.player.faction === 255) {
                playerAlert = { nickname: detection.player.nickname, expiresAt: Date.now() + 7000 };
                if (settings.settingSound) {
                    const alertAudio = new Audio('/sounds/player.mp3');
                    alertAudio.play().catch(() => {});
                }
            }
            break;

        case EventCodes.NewSimpleHarvestableObjectList:
            harvestablesHandler.newSimpleHarvestableObject(Parameters);
            break;

        case EventCodes.NewHarvestableObject:
            harvestablesHandler.newHarvestableObject(id, Parameters);
            break;

        case EventCodes.HarvestableChangeState:
            harvestablesHandler.HarvestUpdateEvent(Parameters);
            break;

        case EventCodes.HarvestFinished:
            harvestablesHandler.harvestFinished(Parameters);
            break;

        case EventCodes.MobChangeState:
            mobsHandler.updateEnchantEvent(Parameters);
            break;

        case EventCodes.RegenerationHealthChanged:
            playersHandler.UpdatePlayerHealth(Parameters);
            break;

        case EventCodes.CharacterEquipmentChanged:
            playersHandler.updateItems(id, Parameters);
            break;

        case EventCodes.NewMob:
            mobsHandler.NewMobEvent(Parameters);
            break;

        case EventCodes.Mounted:
            playersHandler.handleMountedPlayerEvent(id, Parameters);
            break;

        case EventCodes.NewRandomDungeon:
            dungeonsHandler.dungeonEvent(Parameters);
            break;

        case EventCodes.NewLootChest:
            chestsHandler.addChestEvent(Parameters);
            break;

        case EventCodes.NewMistsCagedWisp:
            wispCageHandler.NewCageEvent(Parameters);
            break;

        case EventCodes.MistsWispCageOpened:
            wispCageHandler.CageOpenedEvent(Parameters);
            break;

        // TODO
        case EventCodes.NewFishingZoneObject:
            fishingHandler.NewFishEvent(Parameters);
            break;

        // TODO
        case EventCodes.FishingFinished:
            fishingHandler.FishingEnd(Parameters);
            break;
    
        default:
            break;
    }
};

function onRequest(Parameters)
{ 
    // Live Protocol18 captures show operation 22 carrying the current
    // position as a two-float array at parameter 1.
    if (Parameters[253] == 22)
    {
        const position = Parameters[1];
        if (Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1]))
        {
            lpX = position[0];
            lpY = position[1];
        }
    }
};

function onResponse(Parameters)
{
    // Player join new map
    if (Parameters[253] == 41)
    {
        if (Parameters[0] !== undefined && Parameters[0] !== null)
            map.id = String(Parameters[0]);
    }
    // All data on the player joining the map (us)
    else if (Parameters[253] == 2)
    {
        if (Parameters[8] !== undefined && Parameters[8] !== null)
            map.id = String(Parameters[8]);
        const position = Parameters[9];
        if (Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1]))
        {
            lpX = position[0];
            lpY = position[1];
        }
    }
};

requestAnimationFrame(gameLoop);

function render() {

    context.clearRect(0, 0, canvas.width, canvas.height);
    contextMap.clearRect(0, 0, canvasMap.width, canvasMap.height);

    mapsDrawing.Draw(contextMap, map);

    harvestablesDrawing.invalidate(context, harvestablesHandler.harvestableList);

    mobsDrawing.invalidate(context, mobsHandler.mobsList, mobsHandler.mistList);
    chestsDrawing.invalidate(context, chestsHandler.chestsList);
    wispCageDrawing.Draw(context, wispCageHandler.cages);
    fishingDrawing.Draw(context, fishingHandler.fishes);
    dungeonsDrawing.Draw(context, dungeonsHandler.dungeonList);
    playersDrawing.invalidate(context, playersHandler.playersInRange);
    trackFootprintsDrawing.invalidate(context, trackFootprintsHandler.footprintsList);
}

var previousTime = performance.now();

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}



function update() {

    const currentTime = performance.now();
    const deltaTime = currentTime - previousTime;
    const t = 1 - Math.exp(-Math.min(deltaTime, 100) / 70);


    if (settings.showMapBackground)
        mapsDrawing.interpolate(map, lpX, lpY, t);

    if (currentTime - lastHarvestablePrune >= 250)
    {
        harvestablesHandler.removeNotInRange(lpX, lpY);
        lastHarvestablePrune = currentTime;
    }
    harvestablesDrawing.interpolate(harvestablesHandler.harvestableList, lpX, lpY, t);


    mobsDrawing.interpolate(mobsHandler.mobsList, mobsHandler.mistList, lpX, lpY, t);


    chestsDrawing.interpolate(chestsHandler.chestsList, lpX, lpY, t);
    wispCageDrawing.Interpolate(wispCageHandler.cages, lpX, lpY, t);
    fishingDrawing.Interpolate(fishingHandler.fishes, lpX, lpY, t);
    dungeonsDrawing.interpolate(dungeonsHandler.dungeonList, lpX, lpY, t);
    playersDrawing.interpolate(playersHandler.playersInRange, lpX, lpY, t);
    trackFootprintsDrawing.interpolate(trackFootprintsHandler.footprintsList, lpX, lpY, t);

    previousTime = currentTime;
}

let lastHarvestablePrune = 0;

function renderPlayerList() {
    const panel = document.getElementById('playersPanel');
    const list = document.getElementById('playersList');
    const count = document.getElementById('playersCount');
    const alert = document.getElementById('playerAlert');
    if (!settings.settingDot) {
        panel.hidden = true;
        return;
    }
    panel.hidden = false;
    if (playerAlert && playerAlert.expiresAt > Date.now()) {
        alert.hidden = false;
        alert.textContent = `Hostil detectado: ${playerAlert.nickname}`;
    } else {
        playerAlert = null;
        alert.hidden = true;
        alert.textContent = '';
    }
    const players = playersHandler.playersInRange;
    count.textContent = `Players detected (${players.length})`;
    list.replaceChildren();

    if (players.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'player-meta';
        empty.textContent = 'Aguardando entradas de jogadores. Se o radar iniciou com você já nesta zona, troque de zona e volte para receber a lista inicial.';
        list.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const player of players) {
        const card = document.createElement('div');
        card.className = 'player-card';

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.nickname;

        const factionNames = {
            0: 'Passivo', 1: 'Martlock', 2: 'Lymhurst', 3: 'Bridgewatch',
            4: 'Fort Sterling', 5: 'Thetford', 6: 'Caerleon', 255: 'Hostil',
        };
        const faction = factionNames[player.faction] || `Facção ${player.faction}`;
        const meta = document.createElement('div');
        meta.className = `player-meta faction-${player.faction === 255 ? 'hostile' : 'other'}`;
        meta.textContent = [player.guildName, player.allianceName, faction].filter(Boolean).join(' · ');

        const gear = document.createElement('div');
        gear.className = 'player-meta';
        gear.textContent = `Equipamentos: ${player.items.length} · Habilidades: ${player.spells.length}`;

        const state = document.createElement('div');
        state.className = 'player-meta';
        const stateParts = [];
        if (player.currentHealth !== null && player.initialHealth !== null)
            stateParts.push(`Vida ${player.currentHealth}/${player.initialHealth}`);
        stateParts.push(player.mounted === null ? 'Montaria não informada' : player.mounted ? 'Montado' : 'A pé');
        state.textContent = stateParts.join(' · ');

        if (player.faction === 255) card.classList.add('player-hostile');
        card.append(name, meta, gear, state);
        fragment.appendChild(card);
    }
    list.appendChild(fragment);
}

function drawItems() {

    contextItems.clearRect(0, 0, canvasItems.width, canvasItems.height);

    if (settings.settingItems)
    {
        playersDrawing.drawItems(contextItems, canvasItems, playersHandler.playersInRange, settings.settingItemsDev);
    }
    renderPlayerList();
}
const intervalItems = 500;
setInterval(drawItems, intervalItems);

function refreshSettings()
{
    settings.update(settings);
    setDrawingViews();
}

window.addEventListener('storage', refreshSettings);
window.addEventListener('focus', refreshSettings);



document.getElementById("button").addEventListener("click", function () {

    chestsHandler.chestsList = [];
    dungeonsHandler.dungeonList = [];
    harvestablesHandler.harvestableList = [];
    mobsHandler.mobsList = [];
    mobsHandler.mistList = [];
    playersHandler.playersInRange = [];
    playersDrawing.images = {};
});

setDrawingViews();

function setDrawingViews() {
    // Move the equipment strip beside the map once; keep later user adjustments.
    if (localStorage.getItem('drawingSideBySideV2') !== 'true') {
        localStorage.setItem('itemsWindowMarginX', '520');
        localStorage.setItem('itemsWindowMarginY', '0');
        localStorage.setItem('itemsWidth', '420');
        localStorage.setItem('buttonMarginX', '1040');
        localStorage.setItem('drawingSideBySideV2', 'true');
    }
    const mainWindowMarginXValue = localStorage.getItem("mainWindowMarginX");
    const mainWindowMarginYValue = localStorage.getItem("mainWindowMarginY");
    const itemsWindowMarginXValue = localStorage.getItem("itemsWindowMarginX");
    const itemsWindowMarginYValue = localStorage.getItem("itemsWindowMarginY");
    const settingItemsBorderValue = localStorage.getItem("settingItemsBorder");
    const buttonMarginXValue = localStorage.getItem("buttonMarginX");
    const buttonMarginYValue = localStorage.getItem("buttonMarginY");

    const itemsWidthValue = localStorage.getItem("itemsWidth");
    const itemsHeightValue = localStorage.getItem("itemsHeight");

    // Check if the values exist in local storage and handle them
    if (mainWindowMarginXValue !== null) {
        document.getElementById('bottomCanvas').style.left = mainWindowMarginXValue + "px";
        document.getElementById('drawCanvas').style.left = mainWindowMarginYValue + "px";
    }

    if (mainWindowMarginYValue !== null) {
        document.getElementById('drawCanvas').style.top = mainWindowMarginYValue + "px";
        document.getElementById('bottomCanvas').style.top = mainWindowMarginYValue + "px";
    }

    if (itemsWindowMarginXValue !== null) {
        document.getElementById('thirdCanvas').style.left = itemsWindowMarginXValue + "px";
    }

    if (itemsWindowMarginYValue !== null) {
        document.getElementById('thirdCanvas').style.top = itemsWindowMarginYValue + "px";
    }

    if (itemsWidthValue !== null) {
        document.getElementById('thirdCanvas').style.width = itemsWidthValue + "px";
    }

    if (itemsHeightValue !== null) {
        document.getElementById('thirdCanvas').style.height = itemsHeightValue + "px";
    }

    if (settingItemsBorderValue !== null) {
        // Apply border based on the settingItemsBorderValue
        if (settingItemsBorderValue === "true") {

            document.getElementById('thirdCanvas').style.border = "2px solid grey";
        } else {

            document.getElementById('thirdCanvas').style.border = "none";
        }
    }

    if (buttonMarginXValue !== null) {
        document.getElementById('button').style.left = buttonMarginXValue + "px";
    }

    if (buttonMarginYValue !== null) {
        document.getElementById('button').style.top = buttonMarginYValue + "px";
    }



}
