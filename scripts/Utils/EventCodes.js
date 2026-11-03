export const EventCodes =
{
    Leave: 1,
    Move: 3,
    NewPlayer: 29,
    NewSimpleHarvestableObject: -1, // Not verified against current Protocol18 traffic.
    NewSimpleHarvestableObjectList: 39,
    NewHarvestableObject: 40,
    HarvestableChangeState: 46,
    MobChangeState: 47,
    HarvestFinished: 61,
    Respawn: 88,
    RegenerationHealthChanged: 91,
    CharacterEquipmentChanged: 90,
    NewTreasureChest: 117,
    NewMob: 123,
    Mounted: 210,
    MountStart: 211,
    MountCancel: 212,
    NewRandomDungeon: -1, // Current event layout/code not verified for this handler.
    NewLootChest: 392,
    NewMistsCagedWisp: -1,
    MistsWispCageOpened: -1,

    FishingFinished: 357,
    NewFishingZoneObject: 360,
    Track: -1,
    TrackNotFound: -1,
}
